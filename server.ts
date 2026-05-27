import 'dotenv/config';
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import { fileURLToPath, pathToFileURL } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { exec, execSync } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import crypto from "crypto";
import os from "os";
import { uploadFromBase64, deleteFile, getSignedUrl } from './src/lib/storage';
import { requireAuth, AuthRequest } from './src/lib/auth-middleware';
import {
  listCoursesByUser, getCourseById, createCourse, updateCourse, removeCourse,
  listEnrollmentsByCourse, getEnrollmentById, createEnrollment, updateEnrollment, removeEnrollment, countEnrollmentsByUser,
  getSettingsByUser, upsertSettings,
  listRepresentativesByUser, createRepresentative, removeRepresentative,
  listTemplatesByUser, getTemplateById, createTemplate, removeTemplate,
} from './src/db/repositories';

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

function findLibreOfficeBinary(): string | null {
  const candidates = [
    "soffice",
    "libreoffice",
    "/usr/bin/soffice",
    "/usr/bin/libreoffice",
    "/opt/libreoffice/program/soffice",
    // Windows paths
    "C:\\Program Files\\LibreOffice\\program\\soffice.exe",
    "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe",
  ];

  console.log("[PDF Conversion] Ejecutando validación previa:");
  try {
    const outSoffice = execSync("which soffice").toString().trim();
    console.log(`[PDF Conversion] which soffice: ${outSoffice}`);
  } catch (e: any) {
    console.log(`[PDF Conversion] which soffice: not found`);
  }

  try {
    const outLibre = execSync("which libreoffice").toString().trim();
    console.log(`[PDF Conversion] which libreoffice: ${outLibre}`);
  } catch (e: any) {
    console.log(`[PDF Conversion] which libreoffice: not found`);
  }

  for (const candidate of candidates) {
    try {
      execSync(`${candidate} --version`, { stdio: "ignore" });
      return candidate;
    } catch {}
  }

  return null;
}

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

async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  const uniqueId = crypto.randomBytes(16).toString("hex");
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `temp_${uniqueId}.docx`);
  const outputPath = path.join(tempDir, `temp_${uniqueId}.pdf`);

  // Log paths
  console.log(`[PDF Conversion] Ruta del DOCX temporal: ${inputPath}`);
  console.log(`[PDF Conversion] Ruta de salida PDF esperada: ${outputPath}`);

  try {
    // 1. Write the processed dynamic DOCX file to the temporary area
    await fs.writeFile(inputPath, docxBuffer);

    // 2. Perform validation to find the available LibreOffice binary
    const libreOfficeBinary = findLibreOfficeBinary();

    if (!libreOfficeBinary) {
      throw new Error(
        "LibreOffice no está instalado en el servidor. Instálalo con: sudo apt update && sudo apt install -y libreoffice. " +
        "Nota: En entornos sandboxed o serverless (como Google AI Studio, Vercel, Firebase Hosting, Netlify), " +
        "LibreOffice no está disponible de forma nativa. Para producción, debes desplegar este backend en un servidor propio, VPS, " +
        "Cloud Run con Docker, Render, Railway o servidor Ubuntu donde puedas instalar LibreOffice."
      );
    }

    console.log(`[PDF Conversion] Binario LibreOffice usado: ${libreOfficeBinary}`);

    // Assemble the conversion command
    const command = `"${libreOfficeBinary}" --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`;
    console.log(`[PDF Conversion] Comando ejecutado: ${command}`);

    // Convert docx directly to PDF using the located LibreOffice binary
    try {
      await execAsync(command);
    } catch (err: any) {
      console.error("[PDF Conversion] Error durante la ejecución del comando:", err);
      throw new Error(`LibreOffice conversion process error. Details: ${err.message}`);
    }

    // Check if output file exists
    try {
      await fs.access(outputPath);
    } catch {
      throw new Error(`El archivo PDF convertido no se encontró en la ruta esperada: ${outputPath}`);
    }

    // 3. Read the beautifully converted high-fidelity PDF from disk
    const pdfBuffer = await fs.readFile(outputPath);
    console.log(`[PDF Conversion] Conversión exitosa. Tamaño del PDF: ${pdfBuffer.length} bytes`);
    return pdfBuffer;

  } catch (err: any) {
    console.error("❌ High-fidelity LibreOffice conversion failed:", err);
    throw new Error(`Failed to convert certificate DOCX to PDF: ${err.message}`);
  } finally {
    // 4. Secure resources by unlinking temporary inputs and outputs
    console.log("[PDF Conversion] Iniciando limpieza de archivos temporales...");
    await fs.unlink(inputPath).catch((e) => console.log(`[PDF Conversion Cleanup] No se pudo borrar ${inputPath}: ${e.message}`));
    await fs.unlink(outputPath).catch((e) => console.log(`[PDF Conversion Cleanup] No se pudo borrar ${outputPath}: ${e.message}`));
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // DEV mode: serve locally stored files (replaces S3 for local development)
  if (process.env.DEV_MODE === 'true') {
    const devStoragePath = path.join(process.cwd(), 'dev-storage');
    app.use('/dev-storage', express.static(devStoragePath));
    console.log(`[DEV] Serving local storage from ${devStoragePath}`);
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

  app.post("/api/generate-certificate-pdf", async (req, res) => {
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
      const docxBuf = await generateRenderedDocx(resolvedBase64, data, images, cfg);
      const pdfBuf = await convertDocxToPdf(docxBuf);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=certificate.pdf');
      res.send(pdfBuf);

    } catch (err: any) {
      console.error("Critical PDF Error:", err);
      res.status(500).json({ error: "PDF conversion failed", details: err.message });
    }
  });

  app.post("/api/generate-certificate", async (req, res) => {
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
  app.post("/api/templates/upload", async (req, res) => {
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
   * DELETE /api/templates/s3
   * Deletes a template file from S3.
   * Body: { s3Key: string }
   */
  app.delete("/api/templates/s3", async (req, res) => {
    try {
      const { s3Key } = req.body as { s3Key: string };
      if (!s3Key) {
        res.status(400).json({ error: "s3Key is required" });
        return;
      }
      await deleteFile(s3Key);
      res.json({ ok: true });
    } catch (err: any) {
      console.error("[S3 Delete] Error:", err);
      res.status(500).json({ error: "Delete failed", details: err.message });
    }
  });

  /**
   * GET /api/templates/signed-url?key=templates/...
   * Returns a pre-signed URL for temporary access to a private S3 object.
   */
  app.get("/api/templates/signed-url", async (req, res) => {
    try {
      const key = req.query.key as string;
      if (!key) {
        res.status(400).json({ error: "key query parameter is required" });
        return;
      }
      const url = await getSignedUrl(key);
      res.json({ url });
    } catch (err: any) {
      console.error("[S3 Signed URL] Error:", err);
      res.status(500).json({ error: "Could not generate signed URL", details: err.message });
    }
  });

  // ─────────────────────────────────────────────────────────────────────────

  // ─── COURSES ─────────────────────────────────────────────────────────────
  app.get('/api/courses', requireAuth, async (req, res) => {
    try {
      const list = await listCoursesByUser((req as AuthRequest).userId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/courses', requireAuth, async (req, res) => {
    try {
      const course = await createCourse((req as AuthRequest).userId, req.body);
      res.status(201).json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      const course = await getCourseById(req.params.id);
      if (!course || course.createdBy !== (req as AuthRequest).userId) {
        res.status(404).json({ error: 'Curso no encontrado' }); return;
      }
      res.json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      const course = await updateCourse(req.params.id, (req as AuthRequest).userId, req.body);
      if (!course) { res.status(404).json({ error: 'Curso no encontrado' }); return; }
      res.json(course);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/courses/:id', requireAuth, async (req, res) => {
    try {
      await removeCourse(req.params.id, (req as AuthRequest).userId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── ENROLLMENTS ─────────────────────────────────────────────────────────
  app.get('/api/courses/:courseId/enrollments', requireAuth, async (req, res) => {
    try {
      const list = await listEnrollmentsByCourse(req.params.courseId, (req as AuthRequest).userId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/enrollment-counts', requireAuth, async (req, res) => {
    try {
      const counts = await countEnrollmentsByUser((req as AuthRequest).userId);
      res.json(counts);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/enrollments', requireAuth, async (req, res) => {
    try {
      const enrollment = await createEnrollment((req as AuthRequest).userId, req.body);
      res.status(201).json(enrollment);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/enrollments/:id', requireAuth, async (req, res) => {
    try {
      const enrollment = await updateEnrollment(req.params.id, (req as AuthRequest).userId, req.body);
      if (!enrollment) { res.status(404).json({ error: 'Inscripción no encontrada' }); return; }
      res.json(enrollment);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/enrollments/:id', requireAuth, async (req, res) => {
    try {
      await removeEnrollment(req.params.id, (req as AuthRequest).userId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── SETTINGS ────────────────────────────────────────────────────────────
  app.get('/api/settings', requireAuth, async (req, res) => {
    try {
      const settings = await getSettingsByUser((req as AuthRequest).userId);
      res.json(settings || {});
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.put('/api/settings', requireAuth, async (req, res) => {
    try {
      const settings = await upsertSettings((req as AuthRequest).userId, req.body);
      res.json(settings);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── REPRESENTATIVES ─────────────────────────────────────────────────────
  app.get('/api/representatives', requireAuth, async (req, res) => {
    try {
      const list = await listRepresentativesByUser((req as AuthRequest).userId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/representatives', requireAuth, async (req, res) => {
    try {
      const rep = await createRepresentative((req as AuthRequest).userId, req.body);
      res.status(201).json(rep);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/representatives/:id', requireAuth, async (req, res) => {
    try {
      await removeRepresentative(req.params.id, (req as AuthRequest).userId);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  // ─── TEMPLATES (DB records) ──────────────────────────────────────────────
  app.get('/api/templates', requireAuth, async (req, res) => {
    try {
      const list = await listTemplatesByUser((req as AuthRequest).userId);
      res.json(list);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get('/api/templates/:id', requireAuth, async (req, res) => {
    try {
      const tpl = await getTemplateById(req.params.id);
      if (!tpl || tpl.createdBy !== (req as AuthRequest).userId) {
        res.status(404).json({ error: 'Plantilla no encontrada' }); return;
      }
      res.json(tpl);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.post('/api/templates', requireAuth, async (req, res) => {
    try {
      const { name, type, s3Key, fileName } = req.body;
      const tpl = await createTemplate((req as AuthRequest).userId, { name, type, s3Key, fileName });
      res.status(201).json(tpl);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.delete('/api/templates/:id', requireAuth, async (req, res) => {
    try {
      await removeTemplate(req.params.id, (req as AuthRequest).userId);
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

      const [settings, representatives] = await Promise.all([
        getSettingsByUser(course.createdBy),
        listRepresentativesByUser(course.createdBy),
      ]);

      let templateS3Key: string | null = null;
      const builtIn = ['modern', 'diploma', 'classic', 'tech', 'minimal'];
      if (course.templateId && !builtIn.includes(course.templateId)) {
        const tpl = await getTemplateById(course.templateId);
        templateS3Key = tpl?.fileData ?? null;
      }

      res.json({ enrollment, course, settings: settings || {}, representatives, templateS3Key });
    } catch (err: any) {
      console.error('[validate]', err);
      res.status(500).json({ error: 'No fue posible verificar el certificado. Intente nuevamente.' });
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
