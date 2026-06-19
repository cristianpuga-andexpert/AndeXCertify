import 'dotenv/config';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { fileURLToPath, pathToFileURL } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";
import { uploadFromBase64, deleteFile, getSignedUrl, isLocalStorage } from './src/lib/storage';
import { and, eq } from 'drizzle-orm';
import { db } from './src/db/index';
import { tenantUsers } from './src/db/schema';
import { requireAuth, requireSuperAdmin, requireTenantAdmin, AuthRequest } from './src/lib/auth-middleware';
import {
  hashPassword, verifyPassword,
  generateAccessToken, generateRefreshToken, refreshTokenExpiresAt,
  generateResetToken, resetTokenExpiresAt,
} from './src/lib/auth';
import {
  validate, RegisterSchema, LoginSchema, ChangePasswordSchema, CourseSchema, EnrollmentSchema,
  CreateTenantSchema, InviteUserSchema, AcceptInvitationSchema, PlatformSettingsSchema,
} from './src/lib/validators';
import { sendInvitationEmail, sendPasswordResetEmail } from './src/lib/email';
import {
  // ── Audit ─────────────────────────────────────────────────────────────────
  logAudit,
  // ── Users / auth ──────────────────────────────────────────────────────────
  createUser, getUserByEmail, getUserById, updateUserPassword, setUserActive, listUsers,
  createRefreshToken, getRefreshToken, deleteRefreshToken, deleteAllUserRefreshTokens,
  createPasswordResetToken, getPasswordResetToken, deletePasswordResetToken,
  // ── Invitations / platform settings ─────────────────────────────────────────
  createInvitation, getInvitationByToken, getPendingInvitationsByTenant,
  markInvitationAccepted, deleteInvitation,
  getPlatformSettings, updatePlatformSettings,
  // ── Courses / enrolments / settings / reps / templates ───────────────────
  listCoursesByUser, getCourseById, createCourse, updateCourse, removeCourse,
  listEnrollmentsByCourse, getEnrollmentById, createEnrollment, updateEnrollment,
  removeEnrollment, countEnrollmentsByUser,
  getSettingsByUser, upsertSettings,
  listRepresentativesByUser, createRepresentative, removeRepresentative,
  listTemplatesByUser, getTemplateById, createTemplate, removeTemplate,
  // ── Tenants ───────────────────────────────────────────────────────────────
  createTenant, getTenantById, listAllTenants, updateTenantPlan, setTenantActive,
  addUserToTenant, getUserTenants, getTenantUserCounts, setUserRoleSuperadmin, getTenantUser,
  getTenantBySubdomain, getTenantByVerifiedCustomDomain,
  setTenantSubdomain, setTenantCustomDomain, markCustomDomainVerified,
} from './src/db/repositories';
import {
  BASE_DOMAIN, resolveHost, slugifySubdomain, isValidDomain,
  checkDomainTxtToken, verifyRecordHost,
} from './src/lib/domains';

// Random URL-safe token for invitations (32 bytes → 64 hex chars)
function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
function invitationExpiresAt(): Date {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
}

// ─── Refresh-token cookie ─────────────────────────────────────────────────────
// The refresh token lives in an httpOnly cookie so it is unreachable from JS
// (XSS cannot steal it). SameSite=strict + path-scoping to /api/auth mitigate
// CSRF: the cookie is only ever sent to the auth endpoints that consume it.
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days (matches token TTL)

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production', // requires HTTPS in prod
    sameSite: 'strict' as const,
    path:     '/api/auth',
    maxAge:   REFRESH_COOKIE_MAX_AGE,
  };
}

function setRefreshCookie(res: import('express').Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, refreshCookieOptions());
}

function clearRefreshCookie(res: import('express').Response): void {
  // clearCookie must use the same path/options the cookie was set with.
  const { maxAge, ...opts } = refreshCookieOptions();
  res.clearCookie(REFRESH_COOKIE, opts);
}

// ─── Subdomain allocation ─────────────────────────────────────────────────────
/**
 * Derives a unique subdomain slug from a tenant name, appending a numeric
 * suffix on collision (laboralcap, laboralcap-2, ...). Falls back to a random
 * slug when the name yields nothing usable.
 */
async function generateUniqueSubdomain(name: string): Promise<string> {
  const base = slugifySubdomain(name) || `otec-${crypto.randomBytes(3).toString('hex')}`;
  let candidate = base;
  let n = 1;
  while (await getTenantBySubdomain(candidate)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

// ─── Storage key authorization ────────────────────────────────────────────────
/**
 * Validates that a template storage key belongs to the caller's tenant.
 * Keys have the form `templates/<uploaderUserId>/<uuid>.<ext>`; the uploader
 * must be a member of the requesting tenant. Rejects path traversal and any
 * key outside the templates/ namespace, so this endpoint can never be used to
 * read arbitrary objects in the bucket.
 */
async function isTemplateKeyInTenant(key: unknown, tenantId: string): Promise<boolean> {
  if (typeof key !== 'string' || key.includes('..') || key.includes('\\')) return false;
  const parts = key.split('/');
  if (parts.length < 3 || parts[0] !== 'templates' || !parts[1]) return false;
  return !!(await getTenantUser(tenantId, parts[1]));
}

// Removed unused/deprecated PDF engines as requested by user (mammoth, pdfmake, html-to-pdfmake)

const execAsync = promisify(exec);
// Works in both ESM (tsx dev) and CJS (esbuild --format=cjs production build)
// In CJS, import.meta.url is undefined; fall back to process.argv[1]
const __filename = (() => {
  try {
    const u = (import.meta as { url?: string }).url;
    return u ? fileURLToPath(u) : process.argv[1];
  } catch {
    return process.argv[1];
  }
})();
const __dirname = path.dirname(__filename);


interface StampConfig {
  useCustomStamp: boolean;
  customStampName: string;
  lema: string;
  orgName: string;
  orgRut: string;
  stampStyle?: 'circular_double' | 'circular_horizontal' | 'circular_dots' | 'oval' | 'square';
}

async function compositeSignatureWithStamp(
  signatureBase64: string,
  cfg: StampConfig
): Promise<Buffer> {
  const W = 400;
  const H = 400;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d') as any;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const stampColor = '#4338ca'; // Indigo 700
  const style = cfg.stampStyle || 'circular_double';

  // --- STAMP DRAWING ---
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = stampColor;
  ctx.lineWidth = 2.5;

  // Main Shape
  if (style === 'square') {
    const size = 340;
    const radius = 20;
    ctx.beginPath();
    ctx.moveTo(cx - size / 2 + radius, cy - size / 2);
    ctx.lineTo(cx + size / 2 - radius, cy - size / 2);
    ctx.quadraticCurveTo(cx + size / 2, cy - size / 2, cx + size / 2, cy - size / 2 + radius);
    ctx.lineTo(cx + size / 2, cy + size / 2 - radius);
    ctx.quadraticCurveTo(cx + size / 2, cy + size / 2, cx + size / 2 - radius, cy + size / 2);
    ctx.lineTo(cx - size / 2 + radius, cy + size / 2);
    ctx.quadraticCurveTo(cx - size / 2, cy + size / 2, cx - size / 2, cy + size / 2 - radius);
    ctx.lineTo(cx - size / 2, cy - size / 2 + radius);
    ctx.quadraticCurveTo(cx - size / 2, cy - size / 2, cx - size / 2 + radius, cy - size / 2);
    ctx.stroke();
  } else if (style === 'oval') {
    ctx.beginPath();
    ctx.ellipse(cx, cy, 180, 130, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Circular styles
    if (style === 'circular_dots') {
      ctx.setLineDash([5, 10]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 160, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash

    if (style === 'circular_double') {
      ctx.beginPath();
      ctx.arc(cx, cy, 145, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    if (style === 'circular_horizontal') {
      ctx.beginPath();
      ctx.moveTo(cx - 150, cy);
      ctx.lineTo(cx + 150, cy);
      ctx.stroke();
    }
  }

  // Top Curved Text (Organization Name)
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = stampColor;
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const title = (cfg.useCustomStamp ? cfg.customStampName : cfg.orgName).toUpperCase();
  const subText = (cfg.lema || "CERTIFICACIÓN DIGITAL").toUpperCase();
  
  if (style === 'oval' || style.startsWith('circular')) {
    const titleR = style === 'oval' ? 140 : 150;
    const arcLen = Math.PI * 0.8;
    const startAngle = -Math.PI / 2 - arcLen / 2;
    
    for (let i = 0; i < title.length; i++) {
      const angle = startAngle + (i + 0.5) * (arcLen / title.length);
      ctx.save();
      const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
      const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
      ctx.translate(cx + xOffset, cy + yOffset);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillText(title[i], 0, 0);
      ctx.restore();
    }

    // Bottom Curved Text
    ctx.font = '18px Arial, sans-serif';
    const subStartAngle = Math.PI / 2 - arcLen / 2;
    for (let i = 0; i < subText.length; i++) {
        const angle = subStartAngle + (i + 0.5) * (arcLen / subText.length);
        ctx.save();
        const xOffset = style === 'oval' ? titleR * 1.2 * Math.cos(angle) : titleR * Math.cos(angle);
        const yOffset = style === 'oval' ? titleR * 0.9 * Math.sin(angle) : titleR * Math.sin(angle);
        ctx.translate(cx + xOffset, cy + yOffset);
        ctx.rotate(angle - Math.PI / 2);
        ctx.fillText(subText[i], 0, 0);
        ctx.restore();
    }
  } else if (style === 'square') {
    ctx.font = 'bold 22px Arial, sans-serif';
    ctx.fillText(title, cx, cy - 120);
    ctx.font = '16px Arial, sans-serif';
    ctx.fillText(subText, cx, cy + 120);
  }

  // Center Static Text
  ctx.globalAlpha = 0.6;
  if (style === 'circular_horizontal') {
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.fillText('FIRMA', cx, cy - 30);
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(cfg.orgRut || '', cx, cy + 30);
  } else {
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(cfg.orgRut || 'RUT INSTITUCIONAL', cx, cy + (style === 'square' ? 30 : 0));
  }

  ctx.restore();

  // --- SIGNATURE DRAWING ---
  if (signatureBase64 && signatureBase64.length > 10) {
    const sigData = signatureBase64.includes(',')
      ? signatureBase64.split(',')[1] : signatureBase64;
    const sigBuffer = Buffer.from(sigData, 'base64');
    const sigImg = await loadImage(sigBuffer);
    
    // Fit signature within the stamp area, with some padding and offset
    const sigW = 320;
    const sigH = sigW / (sigImg.width / sigImg.height);
    ctx.drawImage(sigImg, cx - sigW / 2, cy - sigH / 2, sigW, sigH);
  }

  return canvas.toBuffer('image/png') as unknown as Buffer;
}

async function generateRenderedDocx(templateBase64: string, data: any, images: any, stampConfig: StampConfig): Promise<Buffer> {
  const base64Data = templateBase64.includes(',')
    ? templateBase64.split(',')[1]
    : templateBase64;

  if (!base64Data) throw new Error("No template data received");

  const content = Buffer.from(base64Data, 'base64');

  let zip: any;
  try {
    zip = new PizZip(content);
  } catch (zipErr: any) {
    throw new Error("El archivo no es un .docx válido: " + zipErr.message);
  }

  const signatureBase64 = images.FIRMA_OTEC || images.FIRMA || '';

  // Generar imagen compuesta firma + timbre
  let firmaSelloBase64 = '';
  try {
    const buf = await compositeSignatureWithStamp(signatureBase64, stampConfig);
    firmaSelloBase64 = 'data:image/png;base64,' + buf.toString('base64');
  } catch (e) {
    console.error('❌ Error generando firma+timbre:', e);
  }

  const processedImages: Record<string, string> = {
    QR: images.QR || '',
    FIRMA_OTEC: firmaSelloBase64,
    FIRMA: firmaSelloBase64,
    TIMBRE: '', 
  };

  const imageBoxSizes: Record<string, [number, number]> = {};

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      const xmlContent = zip.files[fileName].asText();
      const markers = ['QR', 'FIRMA_OTEC', 'FIRMA', 'TIMBRE'];
      markers.forEach(marker => {
        const markerIdx = xmlContent.indexOf('{{' + marker + '}}');
        if (markerIdx === -1) return;
        const txbxStart = xmlContent.lastIndexOf('<w:txbxContent>', markerIdx);
        if (txbxStart === -1) return;
        const chunkBefore = xmlContent.substring(0, txbxStart);
        const extentMatch = chunkBefore.match(
          /.*<(?:wp:extent|a:ext)\s+cx="(\d+)"\s+cy="(\d+)"[^/]*\/>/s
        );
        if (!extentMatch) return;
        const cxEmu = parseInt(extentMatch[1]);
        const cyEmu = parseInt(extentMatch[2]);
        const paddingH = (91440 + 91440) / 9525;
        const paddingV = (45720 + 45720) / 9525;
        let pxW = Math.round(cxEmu / 9525 - paddingH);
        let pxH = Math.round(cyEmu / 9525 - paddingV);
        if (marker === 'QR') {
          pxW = Math.round(pxW * 0.95);
          pxH = Math.round(pxH * 0.95);
          const side = Math.min(pxW, pxH);
          pxW = side; pxH = side;
        }
        if (marker === 'FIRMA_OTEC' || marker === 'FIRMA') {
          pxW = Math.round(pxW * 0.95);
          pxH = Math.round(pxH * 0.95);
        }
        imageBoxSizes[marker] = [pxW, pxH];
      });
    }
  });

  const imageTagsWithData = Object.keys(processedImages).filter(tag => {
    const val = processedImages[tag];
    return val && val.length > 0;
  });

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      let xmlContent = zip.files[fileName].asText();
      xmlContent = xmlContent.replace(
        /(<w:txbxContent>)([\s\S]*?)(<\/w:txbxContent>)/g,
        (_match: string, open: string, inner: string, close: string) => {
          const cleaned = inner.replace(
            /<w:p\s[^>]*>\s*<w:pPr>[\s\S]*?<\/w:pPr>\s*<\/w:p>\s*/g,
            ''
          );
          return open + cleaned + close;
        }
      );
      zip.file(fileName, xmlContent);
    }
  });

  Object.keys(zip.files).forEach((fileName: string) => {
    if (fileName.endsWith('.xml')) {
      let xmlContent = zip.files[fileName].asText();
      ['QR', 'FIRMA_OTEC', 'FIRMA', 'TIMBRE'].forEach(tag => {
        const regex = new RegExp(`\\{\\{\\s*${tag}\\s*\\}\\}`, 'g');
        xmlContent = xmlContent.replace(regex, imageTagsWithData.includes(tag) ? `{{%${tag}}}` : '');
      });
      zip.file(fileName, xmlContent);
    }
  });

  const imageOptions = {
    centered: false,
    getImage(tagValue: string) {
      const imgBase64 = processedImages[tagValue];
      if (!imgBase64 || !imgBase64.length) return null;
      const raw = imgBase64.includes(',') ? imgBase64.split(',')[1] : imgBase64;
      if (!raw) return null;
      try { return Buffer.from(raw, 'base64'); } catch { return null; }
    },
    getSize(_img: Buffer, tagValue: string) {
      if (imageBoxSizes[tagValue]) {
        const [targetW, targetH] = imageBoxSizes[tagValue];
        if (tagValue === 'FIRMA' || tagValue === 'FIRMA_OTEC') {
          // Maintain 1:1 aspect ratio for the stamp+signature composite
          const side = Math.min(targetW, targetH);
          return [side, side];
        }
        return [targetW, targetH];
      }
      if (tagValue === 'QR') return [89, 62];
      if (tagValue === 'FIRMA' || tagValue === 'FIRMA_OTEC') return [94, 62];
      return [100, 100];
    }
  };

  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    modules: [new ImageModule(imageOptions)]
  });

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

/**
 * Resolves the LibreOffice binary path cross-platform.
 *  - Override with LIBREOFFICE_PATH env var (any OS).
 *  - Windows: looks for soffice.exe in standard install dirs.
 *  - Linux/Docker/macOS: uses `libreoffice` (the Docker image installs it).
 */
function getLibreOfficeCmd(): string {
  if (process.env.LIBREOFFICE_PATH) return `"${process.env.LIBREOFFICE_PATH}"`;
  if (process.platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    ];
    for (const c of candidates) {
      try { require('fs').accessSync(c); return `"${c}"`; } catch { /* keep looking */ }
    }
    return 'soffice'; // fall back to PATH
  }
  return 'libreoffice';
}

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const tempDir  = os.tmpdir();
  const docxPath = path.join(tempDir, `cert_${uniqueId}.docx`);
  const pdfPath  = path.join(tempDir, `cert_${uniqueId}.pdf`);

  try {
    // 1. Write DOCX to temp file
    await fs.writeFile(docxPath, docxBuffer);

    // 2. Convert with LibreOffice headless (cross-platform: soffice.exe on Windows,
    //    libreoffice in the Docker image / Linux).
    const command = `${getLibreOfficeCmd()} --headless --convert-to pdf --outdir "${tempDir}" "${docxPath}"`;
    console.log(`[PDF] ${command}`);
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
      if (stdout) console.log(`[PDF] stdout: ${stdout.trim()}`);
      if (stderr) console.log(`[PDF] stderr: ${stderr.trim()}`);
    } catch (err: any) {
      throw new Error(`LibreOffice conversion failed: ${err.message}`);
    }

    // 3. Verify output exists
    try {
      await fs.access(pdfPath);
    } catch {
      throw new Error(`Converted PDF not found at expected path: ${pdfPath}`);
    }

    // 4. Read and return
    const pdfBuffer = await fs.readFile(pdfPath);
    console.log(`[PDF] Conversion successful — ${pdfBuffer.length} bytes`);
    return pdfBuffer;

  } finally {
    // 5. Clean up temp files regardless of outcome
    await fs.unlink(docxPath).catch(() => {});
    await fs.unlink(pdfPath).catch(() => {});
  }
}

/**
 * Ensures the user configured via SUPERADMIN_USER_ID has the 'superadmin' role.
 * Runs once on every server startup — safe to run repeatedly (idempotent).
 *
 * Flow:
 *   - If the user has no tenant yet → creates a "Sistema" tenant and adds them as superadmin.
 *   - If the user already has memberships but none are superadmin → promotes all to superadmin.
 *   - If already superadmin → no-op (just logs confirmation).
 */
async function bootstrapSuperadmin(): Promise<void> {
  const userId = process.env.SUPERADMIN_USER_ID;
  const email  = process.env.SUPERADMIN_EMAIL || '';
  if (!userId) return; // env var not set — skip

  try {
    const memberships = await getUserTenants(userId);

    if (memberships.length === 0) {
      const tenant = await createTenant({ name: 'Sistema AndeXCertify', rut: '', createdBy: userId });
      await addUserToTenant(tenant.id, userId, 'superadmin', email);
      console.log(`[Bootstrap] ✔ Superadmin tenant created for user ${userId}`);
    } else if (!memberships.some(m => m.role === 'superadmin')) {
      await setUserRoleSuperadmin(userId);
      console.log(`[Bootstrap] ✔ Superadmin role assigned to existing user ${userId}`);
    } else {
      console.log(`[Bootstrap] ✔ Superadmin already configured (user ${userId})`);
    }
  } catch (err: any) {
    console.error('[Bootstrap] ✘ Failed to configure superadmin:', err.message);
  }
}

async function startServer() {
  await bootstrapSuperadmin();

  const app = express();
  const PORT = 3000;

  // ─── Security headers (Helmet) ────────────────────────────────────────────
  // CSP deshabilitado aquí — necesita configurarse por dominio en producción
  // (la CSP por defecto de Helmet bloquea los scripts inline de Vite/React)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));

  // ─── CORS ─────────────────────────────────────────────────────────────────
  app.use(cors({
    // Multi-tenant origins are dynamic: every OTEC is served from its own
    // subdomain (<slug>.BASE_DOMAIN) or its own verified custom domain. Accept
    // the base domain, any of its subdomains, verified custom domains, and any
    // origin explicitly listed in ALLOWED_ORIGINS.
    origin: async (origin, callback) => {
      if (!origin) { callback(null, true); return; } // curl / server-to-server
      const allowed = (process.env.ALLOWED_ORIGINS || '')
        .split(',').map(s => s.trim()).filter(Boolean);
      if (allowed.includes(origin)) { callback(null, true); return; }
      try {
        const host = new URL(origin).hostname.toLowerCase();
        if (host === BASE_DOMAIN || host.endsWith(`.${BASE_DOMAIN}`)) {
          callback(null, true); return;
        }
        if (await getTenantByVerifiedCustomDomain(host)) { callback(null, true); return; }
      } catch { /* malformed origin → reject below */ }
      callback(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials:    true,
    methods:        ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id'],
  }));

  // ─── Body parsing — 10 MB global; 50 MB overridden per upload route ───────
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // ─── Cookies (refresh token is stored in an httpOnly cookie) ──────────────
  app.use(cookieParser());

  // ─── Rate limiters ────────────────────────────────────────────────────────
  const loginLimiter = rateLimit({
    windowMs:        15 * 60 * 1000, // 15 min window
    max:             5,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: 'Demasiados intentos. Intente nuevamente en 15 minutos.' },
  });

  // Broader limiter for other sensitive auth endpoints (registration, token
  // refresh, password-reset request). Prevents account-enumeration and
  // token-grinding abuse while staying generous enough for normal use.
  const authLimiter = rateLimit({
    windowMs:        15 * 60 * 1000,
    max:             30,
    standardHeaders: true,
    legacyHeaders:   false,
    message:         { error: 'Demasiadas solicitudes. Intente nuevamente más tarde.' },
  });

  // ─── Health check ─────────────────────────────────────────────────────────
  // Public, unauthenticated liveness probe for Docker/uptime monitors.
  app.get('/api/health', (_req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  });

  // ─── Auth endpoints ───────────────────────────────────────────────────────

  /** POST /api/auth/register — create account, tenant and return tokens */
  app.post('/api/auth/register', authLimiter, validate(RegisterSchema), async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body as {
        email: string; password: string; firstName?: string; lastName?: string;
      };

      // Public registration is gated by a platform-wide toggle (default OFF).
      // Escape hatch: the VERY FIRST user is always allowed so the platform can
      // be bootstrapped on a fresh database (this user becomes the superadmin).
      const settings   = await getPlatformSettings();
      const allUsers   = await listUsers();
      const isFirstUser = allUsers.length === 0;
      if (!settings.publicRegistrationEnabled && !isFirstUser) {
        res.status(403).json({
          error: 'El registro público está deshabilitado. Solicita una invitación al administrador.',
        });
        return;
      }

      const existing = await getUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: 'Este email ya está registrado' }); return;
      }

      const passwordHash = await hashPassword(password);
      const user         = await createUser(email, passwordHash, firstName, lastName);

      // Auto-create default tenant for new user
      const tenant     = await createTenant({ name: email, rut: '', createdBy: user.id });
      const membership = await addUserToTenant(tenant.id, user.id, 'admin', email);

      const payload = { userId: user.id, email, tenantId: tenant.id, role: membership.role };
      const accessToken  = generateAccessToken(payload);
      const refreshToken = generateRefreshToken();
      await createRefreshToken(user.id, refreshToken, refreshTokenExpiresAt());

      setRefreshCookie(res, refreshToken);
      res.status(201).json({
        accessToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      });
    } catch (err: any) {
      console.error('[Auth] Register error:', err);
      res.status(500).json({ error: 'Error al registrar usuario', details: err.message });
    }
  });

  /** POST /api/auth/login — rate-limited, returns tokens */
  app.post('/api/auth/login', loginLimiter, validate(LoginSchema), async (req, res) => {
    try {
      const { email, password } = req.body as { email: string; password: string };

      const user = await getUserByEmail(email);
      if (!user) {
        void logAudit(null, null, 'user.login.failed', 'auth', undefined, req);
        res.status(401).json({ error: 'Correo o contraseña incorrectos' }); return;
      }
      if (!user.active) {
        void logAudit(null, user.id, 'user.login.disabled', 'auth', user.id, req);
        res.status(403).json({ error: 'Cuenta desactivada. Contacte al administrador.' }); return;
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        void logAudit(null, user.id, 'user.login.failed', 'auth', user.id, req);
        res.status(401).json({ error: 'Correo o contraseña incorrectos' }); return;
      }

      // Resolve active tenant
      const memberships = await getUserTenants(user.id);
      if (memberships.length === 0) {
        // Shouldn't happen, but handle gracefully
        const tenant     = await createTenant({ name: email, rut: '', createdBy: user.id });
        const membership = await addUserToTenant(tenant.id, user.id, 'admin', email);
        memberships.push(membership);
      }

      const requestedId = req.headers['x-tenant-id'] as string | undefined;
      const active = (requestedId && memberships.find(m => m.tenantId === requestedId)) || memberships[0];

      const payload = { userId: user.id, email, tenantId: active.tenantId, role: active.role };
      const accessToken  = generateAccessToken(payload);
      const refreshToken = generateRefreshToken();
      await createRefreshToken(user.id, refreshToken, refreshTokenExpiresAt());

      void logAudit(active.tenantId, user.id, 'user.login', 'auth', user.id, req);

      setRefreshCookie(res, refreshToken);
      res.json({
        accessToken,
        user:    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        tenants: memberships,
      });
    } catch (err: any) {
      console.error('[Auth] Login error:', err);
      res.status(500).json({ error: 'Error al iniciar sesión', details: err.message });
    }
  });

  /**
   * POST /api/auth/refresh — refresh token rotation
   * A stolen refresh token can only be used ONCE: the old token is deleted
   * before the new pair is issued, so replaying it returns 401.
   */
  app.post('/api/auth/refresh', authLimiter, async (req, res) => {
    try {
      // Refresh token comes from the httpOnly cookie (never the request body).
      const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (!refreshToken) { res.status(401).json({ error: 'No autenticado' }); return; }

      // 1. Look up token
      const record = await getRefreshToken(refreshToken);
      if (!record) { clearRefreshCookie(res); res.status(401).json({ error: 'Refresh token inválido' }); return; }

      // 2. Check expiry BEFORE deleting (avoid unnecessary DB writes on expired tokens)
      if (record.expiresAt < new Date()) {
        await deleteRefreshToken(refreshToken);
        clearRefreshCookie(res);
        res.status(401).json({ error: 'Refresh token expirado' }); return;
      }

      // 3. DELETE old token immediately (rotation — token can no longer be replayed)
      await deleteRefreshToken(refreshToken);

      // 4. Validate user is still active
      const user = await getUserById(record.userId);
      if (!user || !user.active) { clearRefreshCookie(res); res.status(401).json({ error: 'Usuario no disponible' }); return; }

      const memberships = await getUserTenants(user.id);
      const active      = memberships[0];
      if (!active) { clearRefreshCookie(res); res.status(401).json({ error: 'Sin tenant asignado' }); return; }

      // 5. Generate new token pair and persist new refresh token
      const payload         = { userId: user.id, email: user.email, tenantId: active.tenantId, role: active.role };
      const newAccessToken  = generateAccessToken(payload);
      const newRefreshToken = generateRefreshToken();
      await createRefreshToken(user.id, newRefreshToken, refreshTokenExpiresAt());

      // 6. Rotate the refresh cookie; return only the access token to JS.
      setRefreshCookie(res, newRefreshToken);
      res.json({ accessToken: newAccessToken });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al renovar token', details: err.message });
    }
  });

  /** POST /api/auth/logout — invalidate refresh token */
  app.post('/api/auth/logout', async (req, res) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
      if (refreshToken) await deleteRefreshToken(refreshToken);
      clearRefreshCookie(res);
      void logAudit(null, null, 'user.logout', 'auth', undefined, req);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cerrar sesión', details: err.message });
    }
  });

  /** GET /api/auth/me — current user info + tenants */
  app.get('/api/auth/me', requireAuth, async (req, res) => {
    try {
      const { userId } = req as AuthRequest;
      const user       = await getUserById(userId);
      if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

      const memberships = await getUserTenants(userId);
      res.json({
        user:    { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        tenants: memberships,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al obtener usuario', details: err.message });
    }
  });

  /** POST /api/auth/change-password */
  app.post('/api/auth/change-password', requireAuth, validate(ChangePasswordSchema), async (req, res) => {
    try {
      const { userId }                       = req as AuthRequest;
      const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

      const user = await getUserById(userId);
      if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }

      const valid = await verifyPassword(currentPassword, user.passwordHash);
      if (!valid) { res.status(401).json({ error: 'Contraseña actual incorrecta' }); return; }

      const newHash = await hashPassword(newPassword);
      await updateUserPassword(userId, newHash);
      await deleteAllUserRefreshTokens(userId); // force re-login everywhere

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cambiar contraseña', details: err.message });
    }
  });

  /** POST /api/auth/forgot-password */
  app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
      const { email } = req.body as { email: string };
      // Always return the same message to avoid email enumeration
      const message = 'Si el correo existe, recibirás un enlace de recuperación.';

      const user = await getUserByEmail(email);
      if (user) {
        const token     = generateResetToken();
        const expiresAt = resetTokenExpiresAt();
        await createPasswordResetToken(user.id, token, expiresAt);
        await sendPasswordResetEmail({ to: email, token });
      }

      res.json({ message });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al procesar solicitud', details: err.message });
    }
  });

  /** POST /api/auth/reset-password */
  app.post('/api/auth/reset-password', authLimiter, async (req, res) => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      if (!newPassword || newPassword.length < 8) {
        res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' }); return;
      }

      const record = await getPasswordResetToken(token);
      if (!record) { res.status(400).json({ error: 'Token inválido o ya utilizado' }); return; }
      if (record.expiresAt < new Date()) {
        await deletePasswordResetToken(token);
        res.status(400).json({ error: 'El enlace de recuperación ha expirado' }); return;
      }

      const newHash = await hashPassword(newPassword);
      await updateUserPassword(record.userId, newHash);
      await deleteAllUserRefreshTokens(record.userId);
      await deletePasswordResetToken(token);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al restablecer contraseña', details: err.message });
    }
  });

  // ─── Invitation flow (public) ─────────────────────────────────────────────

  /** GET /api/auth/invitation/:token — validate an invite and return its info */
  app.get('/api/auth/invitation/:token', async (req, res) => {
    try {
      const inv = await getInvitationByToken(req.params.token);
      if (!inv || inv.acceptedAt) {
        res.status(404).json({ error: 'Invitación inválida o ya utilizada' }); return;
      }
      if (inv.expiresAt < new Date()) {
        res.status(410).json({ error: 'La invitación ha expirado' }); return;
      }
      const tenant = await getTenantById(inv.tenantId);
      res.json({ email: inv.email, organization: tenant?.name ?? '', role: inv.role });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al validar invitación', details: err.message });
    }
  });

  /** POST /api/auth/accept-invitation — invitee sets password, account is created/activated */
  app.post('/api/auth/accept-invitation', validate(AcceptInvitationSchema), async (req, res) => {
    try {
      const { token, password, firstName, lastName } = req.body as {
        token: string; password: string; firstName?: string; lastName?: string;
      };

      const inv = await getInvitationByToken(token);
      if (!inv || inv.acceptedAt) {
        res.status(404).json({ error: 'Invitación inválida o ya utilizada' }); return;
      }
      if (inv.expiresAt < new Date()) {
        res.status(410).json({ error: 'La invitación ha expirado' }); return;
      }

      // Create the user if it doesn't exist yet, otherwise update its password.
      const passwordHash = await hashPassword(password);
      let user = await getUserByEmail(inv.email);
      if (user) {
        await updateUserPassword(user.id, passwordHash);
        if (!user.active) await setUserActive(user.id, true);
      } else {
        user = await createUser(inv.email, passwordHash, firstName, lastName);
      }

      // Add to the tenant with the invited role, then mark invitation accepted.
      const membership = await addUserToTenant(inv.tenantId, user.id, inv.role, inv.email);
      await markInvitationAccepted(token);

      // Auto-login: issue tokens.
      const payload = { userId: user.id, email: user.email, tenantId: inv.tenantId, role: membership.role };
      const accessToken  = generateAccessToken(payload);
      const refreshToken = generateRefreshToken();
      await createRefreshToken(user.id, refreshToken, refreshTokenExpiresAt());

      void logAudit(inv.tenantId, user.id, 'user.invitation.accepted', 'auth', user.id, req);

      setRefreshCookie(res, refreshToken);
      res.status(201).json({
        accessToken,
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
      });
    } catch (err: any) {
      console.error('[Auth] Accept invitation error:', err);
      res.status(500).json({ error: 'Error al aceptar invitación', details: err.message });
    }
  });

  // ─── User management endpoints (admin) ────────────────────────────────────

  /** GET /api/admin/users — list users in current tenant */
  app.get('/api/admin/users', requireAuth, requireTenantAdmin, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const members      = await db.select().from(tenantUsers).where(eq(tenantUsers.tenantId, tenantId));
      const memberIds    = new Set(members.map(m => m.userId));
      const rows         = await listUsers();
      const tenantRows   = rows.filter(u => memberIds.has(u.id));
      res.json({
        users: tenantRows.map(u => ({
          id:          u.id,
          email:       u.email,
          displayName: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
          role:        members.find(m => m.userId === u.id)?.role ?? 'admin',
          isActive:    u.active,
          createdAt:   u.createdAt.toISOString(),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al listar usuarios', details: err.message });
    }
  });

  /**
   * POST /api/admin/create-user — invite a user into the current tenant.
   * No password is set here: an invitation email is sent and the invitee
   * defines their own password via /set-password?token=...
   */
  app.post('/api/admin/create-user', requireAuth, requireTenantAdmin, validate(InviteUserSchema), async (req, res) => {
    try {
      const { tenantId, userId: inviterId } = req as AuthRequest;
      const { email, displayName, role } = req.body as {
        email: string; displayName?: string; role: string;
      };

      // If the user already belongs to this tenant, reject.
      const existing = await getUserByEmail(email);
      if (existing) {
        const already = await getTenantUser(tenantId, existing.id);
        if (already) { res.status(409).json({ error: 'Este usuario ya pertenece a la organización' }); return; }
      }

      const token = generateInviteToken();
      await createInvitation({
        email, tenantId, role: role as any, token,
        invitedBy: inviterId, expiresAt: invitationExpiresAt(),
      });

      const tenant = await getTenantById(tenantId);
      const sent   = await sendInvitationEmail({
        to: email, token,
        organization: tenant?.name ?? 'tu organización',
        inviterName:  displayName || undefined,
      });

      void logAudit(tenantId, inviterId, 'user.invited', 'auth', email, req);

      // In dev (no SMTP) return the link so it can be opened manually.
      const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}/set-password?token=${token}`;
      res.status(201).json({ success: true, emailSent: sent, inviteLink: sent ? undefined : inviteLink });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al invitar usuario', details: err.message });
    }
  });

  /** GET /api/admin/invitations — pending invitations for the current tenant */
  app.get('/api/admin/invitations', requireAuth, requireTenantAdmin, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const list = await getPendingInvitationsByTenant(tenantId);
      res.json({
        invitations: list.map(i => ({
          id: i.id, email: i.email, role: i.role,
          createdAt: i.createdAt.toISOString(), expiresAt: i.expiresAt.toISOString(),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al listar invitaciones', details: err.message });
    }
  });

  /** DELETE /api/admin/invitations/:id — cancel a pending invitation */
  app.delete('/api/admin/invitations/:id', requireAuth, requireTenantAdmin, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      await deleteInvitation(req.params.id, tenantId); // scoped to caller's tenant
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al cancelar invitación' });
    }
  });

  /** PATCH /api/admin/users/:id — toggle active status */
  app.patch('/api/admin/users/:id', requireAuth, requireTenantAdmin, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const { isActive } = req.body as { isActive: boolean };

      // Only allow toggling users who belong to the caller's tenant — never
      // arbitrary platform users (would otherwise allow locking out other
      // tenants' users or the superadmin).
      const membership = await getTenantUser(tenantId, req.params.id);
      if (!membership) { res.status(404).json({ error: 'Usuario no encontrado en la organización' }); return; }

      await setUserActive(req.params.id, isActive);
      void logAudit(tenantId, (req as AuthRequest).userId,
        isActive ? 'user.enabled' : 'user.disabled', 'auth', req.params.id, req);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al actualizar usuario' });
    }
  });

  /** DELETE /api/admin/users/:id — remove user from tenant (not from users table) */
  app.delete('/api/admin/users/:id', requireAuth, requireTenantAdmin, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      await db.delete(tenantUsers).where(
        and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, req.params.id))
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al eliminar usuario' });
    }
  });

  // Local storage: serve files from ./dev-storage (replaces S3 when STORAGE_DRIVER=local
  // or DEV_MODE=true). Decoupled from auth so you can run real auth + local files.
  if (isLocalStorage()) {
    const devStoragePath = path.join(process.cwd(), 'dev-storage');
    app.use('/dev-storage', express.static(devStoragePath));
    console.log(`[Local Storage] Serving files from ${devStoragePath}`);
  }

  /**
   * Resolves the template content as a base64 string.
   * Accepts either a pre-encoded base64 string or an S3 key (fetched on-demand).
   */
  async function resolveTemplateBase64(
    templateBase64: string | undefined,
    templateS3Key: string | undefined
  ): Promise<string> {
    if (templateBase64) return templateBase64;
    if (templateS3Key) {
      const signedUrl = await getSignedUrl(templateS3Key);
      const response = await fetch(signedUrl);
      if (!response.ok) throw new Error(`Failed to fetch template from S3: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer).toString('base64');
    }
    throw new Error('Either templateBase64 or templateS3Key must be provided');
  }

  app.post("/api/generate-certificate-pdf", express.json({ limit: '50mb' }), requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const { templateBase64, templateS3Key, data, images, stampConfig } = req.body;
      const cfg: StampConfig = stampConfig || {
        useCustomStamp: false,
        customStampName: '',
        lema: '',
        orgName: (data as Record<string, string>).EMPRESA_OTEC || 'OTEC',
        orgRut: (data as Record<string, string>).RUT_EMPRESA_OTEC || '',
      };

      const resolvedBase64 = await resolveTemplateBase64(templateBase64, templateS3Key);
      const docxBuf = await generateRenderedDocx(resolvedBase64, data, images, cfg);
      const pdfBuf = await convertDocxToPdf(docxBuf);

      void logAudit(tenantId, userId, 'certificate.generated', 'certificate', undefined, req);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
      res.send(pdfBuf);

    } catch (err: any) {
      console.error("Critical PDF Error:", err);
      res.status(500).json({ error: "PDF conversion failed", details: err.message });
    }
  });

  app.post("/api/generate-certificate", express.json({ limit: '50mb' }), requireAuth, async (req, res) => {
    try {
      const { templateBase64, templateS3Key, data, images, stampConfig } = req.body;
      const cfg: StampConfig = stampConfig || {
        useCustomStamp: false,
        customStampName: '',
        lema: '',
        orgName: (data as Record<string, string>).EMPRESA_OTEC || 'OTEC',
        orgRut: (data as Record<string, string>).RUT_EMPRESA_OTEC || '',
      };

      const resolvedBase64 = await resolveTemplateBase64(templateBase64, templateS3Key);
      const out = await generateRenderedDocx(resolvedBase64, data, images, cfg);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename=certificate.docx');
      res.send(out);

    } catch (err: any) {
      console.error("Critical Error:", err);
      let message = "Generation failed";
      if (err.name === "TemplateError") message = "Error en la plantilla: " + err.message;
      else if (err.message?.includes("end of central directory")) message = "Archivo .docx inválido o corrupto.";
      res.status(500).json({ error: message, details: err.message });
    }
  });

  // ─── Template S3 endpoints ────────────────────────────────────────────────

  /**
   * POST /api/templates/upload
   * Uploads a DOCX template to S3 and returns the S3 key.
   * Body: { fileData: string (base64, with or without data-URI prefix),
   *         fileName: string, userId: string }
   * Response: { s3Key: string, publicUrl: string }
   */
  app.post("/api/templates/upload", express.json({ limit: '50mb' }), requireAuth, async (req, res) => {
    try {
      const { fileData, fileName, userId } = req.body as {
        fileData: string;
        fileName: string;
        userId: string;
      };
      if (!fileData || !fileName || !userId) {
        res.status(400).json({ error: "fileData, fileName and userId are required" });
        return;
      }
      const ext = path.extname(fileName) || '.docx';
      const s3Key = `templates/${userId}/${crypto.randomUUID()}${ext}`;
      const publicUrl = await uploadFromBase64(
        fileData,
        s3Key,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
      res.json({ s3Key, publicUrl });
    } catch (err: any) {
      console.error("[S3 Upload] Error:", err);
      res.status(500).json({ error: "Upload failed", details: err.message });
    }
  });

  /**
   * GET /api/templates/signed-url?key=templates/...
   * Returns a pre-signed URL for temporary access to a private template object.
   * Authenticated + tenant-scoped: the key must belong to the caller's tenant,
   * so it cannot be used to read arbitrary objects or other tenants' templates.
   * (Public certificate validation gets its URL from /api/public/validate.)
   */
  app.get("/api/templates/signed-url", requireAuth, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const key = req.query.key as string;
      if (!key) {
        res.status(400).json({ error: "key query parameter is required" });
        return;
      }
      if (!(await isTemplateKeyInTenant(key, tenantId))) {
        res.status(403).json({ error: "Acceso denegado a este recurso" });
        return;
      }
      const url = await getSignedUrl(key);
      res.json({ url });
    } catch (err: any) {
      console.error("[S3 Signed URL] Error:", err);
      res.status(500).json({ error: "Could not generate signed URL" });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────

  // ─── IDENTITY (role / tenant for current session) ────────────────────────
  app.get('/api/me', requireAuth, (req, res) => {
    const { userId, tenantId, role } = req as AuthRequest;
    res.json({ userId, tenantId, role });
  });

  // ─── COURSES ─────────────────────────────────────────────────────────────
  app.get('/api/courses', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const list = await listCoursesByUser(userId, tenantId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/courses', requireAuth, validate(CourseSchema), async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const course = await createCourse(userId, tenantId, req.body);
      void logAudit(tenantId, userId, 'course.created', 'course', course.id, req);
      res.status(201).json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const course = await getCourseById(req.params.id);
      if (!course || course.tenantId !== tenantId) {
        res.status(404).json({ error: 'Curso no encontrado' }); return;
      }
      res.json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const course = await updateCourse(req.params.id, userId, tenantId, req.body);
      if (!course) { res.status(404).json({ error: 'Curso no encontrado' }); return; }
      res.json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      await removeCourse(req.params.id, userId, tenantId);
      void logAudit(tenantId, userId, 'course.deleted', 'course', req.params.id, req);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── ENROLLMENTS ─────────────────────────────────────────────────────────
  app.get('/api/courses/:courseId/enrollments', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const list = await listEnrollmentsByCourse(req.params.courseId, userId, tenantId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/enrollment-counts', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const counts = await countEnrollmentsByUser(userId, tenantId);
      res.json(counts);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/enrollments', requireAuth, validate(EnrollmentSchema), async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const enrollment = await createEnrollment(userId, tenantId, req.body);
      res.status(201).json(enrollment);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/enrollments/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const enrollment = await updateEnrollment(req.params.id, userId, tenantId, req.body);
      if (!enrollment) { res.status(404).json({ error: 'Inscripción no encontrada' }); return; }
      res.json(enrollment);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/enrollments/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      await removeEnrollment(req.params.id, userId, tenantId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const settings = await getSettingsByUser(userId, tenantId);
      res.json(settings || {});
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/settings', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const settings = await upsertSettings(userId, tenantId, req.body);
      res.json(settings);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── REPRESENTATIVES ─────────────────────────────────────────────────────
  app.get('/api/representatives', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const list = await listRepresentativesByUser(userId, tenantId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/representatives', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const rep = await createRepresentative(userId, tenantId, req.body);
      void logAudit(tenantId, userId, 'representative.created', 'representative', rep.id, req);
      res.status(201).json(rep);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/representatives/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      await removeRepresentative(req.params.id, userId, tenantId);
      void logAudit(tenantId, userId, 'representative.deleted', 'representative', req.params.id, req);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── TEMPLATES (DB records) ──────────────────────────────────────────────
  app.get('/api/templates', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const list = await listTemplatesByUser(userId, tenantId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/templates/:id', requireAuth, async (req, res) => {
    try {
      const { tenantId } = req as AuthRequest;
      const tpl = await getTemplateById(req.params.id);
      if (!tpl || tpl.tenantId !== tenantId) {
        res.status(404).json({ error: 'Plantilla no encontrada' }); return;
      }
      res.json(tpl);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/templates', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      const { name, type, s3Key, fileName } = req.body;
      const tpl = await createTemplate(userId, tenantId, { name, type, s3Key, fileName });
      void logAudit(tenantId, userId, 'template.uploaded', 'template', tpl.id, req);
      res.status(201).json(tpl);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
      const { userId, tenantId } = req as AuthRequest;
      // Resolve the template first (tenant-checked) so we can delete its file.
      const tpl = await getTemplateById(req.params.id);
      if (tpl && tpl.tenantId !== tenantId) {
        res.status(404).json({ error: 'Plantilla no encontrada' }); return;
      }
      await removeTemplate(req.params.id, userId, tenantId);
      // Best-effort delete of the backing storage object (server-side, so the
      // client never supplies a raw storage key).
      if (tpl?.fileData) {
        await deleteFile(tpl.fileData).catch(e => console.warn('[S3 Delete]', e?.message));
      }
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── PUBLIC: certificate validation (no auth) ────────────────────────────
  app.get('/api/public/validate/:enrollmentId', async (req, res) => {
    try {
      const enrollment = await getEnrollmentById(req.params.enrollmentId);
      if (!enrollment) { res.status(404).json({ error: 'Certificado no encontrado' }); return; }

      const course = await getCourseById(enrollment.courseId);
      if (!course) { res.status(404).json({ error: 'Curso no encontrado' }); return; }

      // course.tenantId and course.createdBy are available after the multi-tenant migration.
      const [settings, representatives] = await Promise.all([
        getSettingsByUser(course.createdBy, course.tenantId),
        listRepresentativesByUser(course.createdBy, course.tenantId),
      ]);

      // Resolve the signed template URL server-side (capability-scoped to this
      // enrollment) so the public page never receives a raw storage key.
      let templateUrl: string | null = null;
      const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
      if (course.templateId && !builtIn.includes(course.templateId)) {
        const tpl = await getTemplateById(course.templateId);
        if (tpl?.fileData) templateUrl = await getSignedUrl(tpl.fileData);
      }

      res.json({ enrollment, course, settings: settings || {}, representatives, templateUrl });
    } catch (err: any) {
      console.error('[validate]', err);
      res.status(500).json({ error: 'No fue posible verificar el certificado. Intente nuevamente.' });
    }
  });

  // ─── SUPERADMIN: tenant management ───────────────────────────────────────
  /**
   * POST /api/admin/tenants — superadmin creates a new OTEC and invites its
   * first admin by email. The admin sets their own password via the invitation.
   */
  app.post('/api/admin/tenants', requireAuth, requireSuperAdmin, validate(CreateTenantSchema), async (req, res) => {
    try {
      const { userId } = req as AuthRequest;
      const { name, rut, adminEmail, plan, planExpiry } = req.body as {
        name: string; rut: string; adminEmail: string;
        plan?: 'starter' | 'pro' | 'business'; planExpiry?: string | null;
      };

      // 1. Create the tenant + assign an always-available subdomain
      const tenant = await createTenant({ name, rut, createdBy: userId });
      const subdomain = await generateUniqueSubdomain(name);
      const tenantWithDomain = await setTenantSubdomain(tenant.id, subdomain) ?? tenant;

      // 2. Apply plan if provided (default is 'starter' from the schema)
      if (plan || planExpiry) {
        await updateTenantPlan(tenant.id, (plan ?? 'starter') as any, planExpiry ? new Date(planExpiry) : null);
      }

      // 3. Invite the admin by email (account created when they set their password)
      const token = generateInviteToken();
      await createInvitation({
        email: adminEmail, tenantId: tenant.id, role: 'admin', token,
        invitedBy: userId, expiresAt: invitationExpiresAt(),
      });
      const sent = await sendInvitationEmail({ to: adminEmail, token, organization: name });

      void logAudit(tenant.id, userId, 'tenant.created', 'tenant', tenant.id, req);

      const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}/set-password?token=${token}`;
      res.status(201).json({ tenant: tenantWithDomain, emailSent: sent, inviteLink: sent ? undefined : inviteLink });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Platform settings (superadmin) ───────────────────────────────────────

  /** GET /api/admin/platform-settings — global config (public registration, etc.) */
  app.get('/api/admin/platform-settings', requireAuth, requireSuperAdmin, async (_req, res) => {
    try {
      const settings = await getPlatformSettings();
      res.json(settings);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /** PUT /api/admin/platform-settings — toggle public registration, etc. */
  app.put('/api/admin/platform-settings', requireAuth, requireSuperAdmin, validate(PlatformSettingsSchema), async (req, res) => {
    try {
      const updated = await updatePlatformSettings(req.body);
      void logAudit(null, (req as AuthRequest).userId, 'platform.settings.updated', 'platform', undefined, req);
      res.json(updated);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /** GET /api/public/config — unauthenticated: non-secret client config */
  app.get('/api/public/config', (_req, res) => {
    res.json({ baseDomain: BASE_DOMAIN });
  });

  /** GET /api/public/registration-status — unauthenticated: is signup open? */
  app.get('/api/public/registration-status', async (_req, res) => {
    try {
      const settings = await getPlatformSettings();
      res.json({
        enabled:      settings.publicRegistrationEnabled,
        plan:         settings.defaultSignupPlan,
        billingCycle: settings.signupBillingCycle,
      });
    } catch {
      res.json({ enabled: false });
    }
  });

  app.get('/api/admin/tenants', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const list = await listAllTenants();
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/admin/tenants/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { plan, planExpiry, active } = req.body as {
        plan?: string; planExpiry?: string | null; active?: boolean;
      };
      const tenantId = req.params.id;
      let result = await getTenantById(tenantId);
      if (!result) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }

      if (plan !== undefined) {
        result = await updateTenantPlan(
          tenantId,
          plan as Parameters<typeof updateTenantPlan>[1],
          planExpiry ? new Date(planExpiry) : null
        ) ?? result;
      }
      if (active !== undefined) {
        result = await setTenantActive(tenantId, active) ?? result;
      }
      res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/admin/tenant-user-counts', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const counts = await getTenantUserCounts();
      res.json(counts);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/admin/tenants/:id', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const result = await setTenantActive(req.params.id, false);
      if (!result) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── Tenant domains (superadmin) ──────────────────────────────────────────

  /** PUT /api/admin/tenants/:id/subdomain — set/change the platform subdomain */
  app.put('/api/admin/tenants/:id/subdomain', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { subdomain } = req.body as { subdomain?: string };
      const slug = slugifySubdomain(subdomain || '');
      if (!slug) { res.status(400).json({ error: 'Subdominio inválido' }); return; }

      const existing = await getTenantBySubdomain(slug);
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: 'Ese subdominio ya está en uso' }); return;
      }
      const updated = await setTenantSubdomain(req.params.id, slug);
      if (!updated) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }
      void logAudit(req.params.id, (req as AuthRequest).userId, 'tenant.subdomain.updated', 'tenant', req.params.id, req);
      res.json({ tenant: updated, fullDomain: `${slug}.${BASE_DOMAIN}` });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /**
   * POST /api/admin/tenants/:id/custom-domain — register a tenant's own domain.
   * Generates a DNS-verification token and returns the records the tenant must
   * create. The domain stays inactive until verified.
   */
  app.post('/api/admin/tenants/:id/custom-domain', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const { domain } = req.body as { domain?: string };
      const d = (domain || '').trim().toLowerCase();
      if (!isValidDomain(d)) { res.status(400).json({ error: 'Dominio inválido' }); return; }

      const existing = await getTenantByVerifiedCustomDomain(d);
      if (existing && existing.id !== req.params.id) {
        res.status(409).json({ error: 'Ese dominio ya está en uso por otra OTEC' }); return;
      }

      const verifyToken = crypto.randomBytes(16).toString('hex');
      const updated = await setTenantCustomDomain(req.params.id, d, verifyToken);
      if (!updated) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }

      void logAudit(req.params.id, (req as AuthRequest).userId, 'tenant.customdomain.requested', 'tenant', req.params.id, req);
      res.json({
        tenant: updated,
        // DNS records the tenant must publish:
        dns: {
          ownership: { type: 'TXT', host: verifyRecordHost(d), value: verifyToken },
          routing:   { type: 'CNAME', host: d, value: BASE_DOMAIN },
        },
      });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /** POST /api/admin/tenants/:id/custom-domain/verify — check the DNS TXT token */
  app.post('/api/admin/tenants/:id/custom-domain/verify', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const tenant = await getTenantById(req.params.id);
      if (!tenant) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }
      if (!tenant.customDomain || !tenant.domainVerifyToken) {
        res.status(400).json({ error: 'No hay un dominio pendiente de verificación' }); return;
      }

      const ok = await checkDomainTxtToken(tenant.customDomain, tenant.domainVerifyToken);
      if (!ok) {
        res.status(422).json({
          verified: false,
          error: 'No se encontró el registro TXT de verificación. La propagación DNS puede tardar.',
        });
        return;
      }

      const updated = await markCustomDomainVerified(tenant.id);
      void logAudit(tenant.id, (req as AuthRequest).userId, 'tenant.customdomain.verified', 'tenant', tenant.id, req);
      res.json({ verified: true, tenant: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  /** DELETE /api/admin/tenants/:id/custom-domain — remove the custom domain */
  app.delete('/api/admin/tenants/:id/custom-domain', requireAuth, requireSuperAdmin, async (req, res) => {
    try {
      const updated = await setTenantCustomDomain(req.params.id, null, null);
      if (!updated) { res.status(404).json({ error: 'Tenant no encontrado' }); return; }
      res.json({ tenant: updated });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── On-demand TLS gate (consumed by Caddy, not the browser) ───────────────
  /**
   * GET /api/internal/tls-check?domain=<host>
   * Caddy's on-demand TLS "ask" endpoint: returns 200 only for hostnames we are
   * willing to issue a certificate for (the base domain, any tenant subdomain,
   * or a verified custom domain). Any other host gets 403, which blocks
   * certificate-issuance abuse / Let's Encrypt rate-limit exhaustion.
   */
  app.get('/api/internal/tls-check', async (req, res) => {
    try {
      const domain = String(req.query.domain || '').toLowerCase();
      if (!domain) { res.sendStatus(400); return; }

      const r = resolveHost(domain);
      if (r.kind === 'root') { res.sendStatus(200); return; }
      if (r.kind === 'subdomain') {
        res.sendStatus((await getTenantBySubdomain(r.subdomain)) ? 200 : 403);
        return;
      }
      // custom domain — only if verified
      res.sendStatus((await getTenantByVerifiedCustomDomain(r.domain)) ? 200 : 403);
    } catch {
      res.sendStatus(403);
    }
  });

  /**
   * GET /api/public/branding — unauthenticated: resolves the tenant for the
   * current Host header so the login page can show the right OTEC's identity.
   */
  app.get('/api/public/branding', async (req, res) => {
    try {
      const r = resolveHost(req.headers.host);
      let tenant = null;
      if (r.kind === 'subdomain')      tenant = await getTenantBySubdomain(r.subdomain);
      else if (r.kind === 'custom')    tenant = await getTenantByVerifiedCustomDomain(r.domain);

      if (!tenant || !tenant.active) { res.json({ tenant: null }); return; }
      res.json({ tenant: { id: tenant.id, name: tenant.name } });
    } catch {
      res.json({ tenant: null });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');

    // Hashed assets (JS/CSS chunks) can be cached aggressively by URL.
    // index.html must NEVER be cached so the browser always gets fresh
    // chunk references after a redeploy (prevents "Failed to fetch dynamically
    // imported module" errors caused by stale chunk hashes).
    app.use(express.static(distPath, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    }));

    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
