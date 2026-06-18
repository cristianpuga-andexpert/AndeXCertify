import nodemailer, { Transporter } from 'nodemailer';

// ─── SMTP transport (lazy singleton) ───────────────────────────────────────────
// Reads configuration from environment variables. If SMTP is not configured,
// emails are logged to the console instead of being sent (safe for local dev).

const SMTP_HOST   = process.env.SMTP_HOST   || '';
const SMTP_PORT   = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';     // true for port 465, false for 587/STARTTLS
const SMTP_USER   = process.env.SMTP_USER   || '';
const SMTP_PASS   = process.env.SMTP_PASS   || '';
const SMTP_FROM   = process.env.SMTP_FROM   || 'AndeXCertify <no-reply@andexcertify.cl>';
const APP_URL     = process.env.APP_URL     || 'http://localhost:3000';

export const isSmtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!isSmtpConfigured) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   SMTP_HOST,
      port:   SMTP_PORT,
      secure: SMTP_SECURE,
      auth:   { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

interface MailInput {
  to:      string;
  subject: string;
  html:    string;
  text?:   string;
}

/**
 * Sends an email via SMTP. If SMTP is not configured, logs the message to the
 * console instead (so local development works without credentials).
 * Never throws — failures are logged so they don't break the request flow.
 */
export async function sendMail({ to, subject, html, text }: MailInput): Promise<boolean> {
  const tx = getTransporter();
  if (!tx) {
    console.log(`\n[Email] SMTP not configured — would send to ${to}`);
    console.log(`[Email] Subject: ${subject}`);
    console.log(`[Email] (set SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable real sending)\n`);
    return false;
  }
  try {
    await tx.sendMail({ from: SMTP_FROM, to, subject, html, text });
    console.log(`[Email] Sent "${subject}" to ${to}`);
    return true;
  } catch (err: any) {
    console.error(`[Email] Failed to send to ${to}:`, err.message);
    return false;
  }
}

// ─── Branded template wrapper ───────────────────────────────────────────────────

function layout(title: string, bodyHtml: string): string {
  return `
  <div style="background:#0f172a;padding:40px 0;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <div style="background:#6366f1;padding:24px 32px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">AndeXCertify</h1>
      </div>
      <div style="padding:32px;">
        <h2 style="margin:0 0 16px;color:#0f172a;font-size:18px;font-weight:800;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:11px;">Un producto de AndeXpert Solutions</p>
      </div>
    </div>
  </div>`;
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#6366f1;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:12px;font-weight:700;font-size:14px;">${label}</a>`;
}

// ─── Specific emails ────────────────────────────────────────────────────────────

/** Invitation to join a tenant — recipient sets their own password. */
export async function sendInvitationEmail(opts: {
  to:           string;
  token:        string;
  organization: string;
  inviterName?: string;
}): Promise<boolean> {
  const link = `${APP_URL}/set-password?token=${opts.token}`;
  const intro = opts.inviterName
    ? `${opts.inviterName} te ha invitado a unirte a`
    : 'Has sido invitado a unirte a';
  const html = layout('Activa tu cuenta', `
    <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.6;">
      ${intro} <strong>${opts.organization}</strong> en AndeXCertify, la plataforma de
      certificación para OTECs.
    </p>
    <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
      Haz clic en el siguiente botón para definir tu contraseña y acceder al sistema:
    </p>
    <p style="margin:0 0 24px;">${button(link, 'Definir mi contraseña')}</p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
      Este enlace expira en 7 días. Si no esperabas esta invitación, puedes ignorar este correo.
    </p>
  `);
  return sendMail({ to: opts.to, subject: `Invitación a ${opts.organization} — AndeXCertify`, html });
}

/** Password reset link. */
export async function sendPasswordResetEmail(opts: {
  to:    string;
  token: string;
}): Promise<boolean> {
  const link = `${APP_URL}/reset-password?token=${opts.token}`;
  const html = layout('Restablece tu contraseña', `
    <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
      Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón
      para crear una nueva:
    </p>
    <p style="margin:0 0 24px;">${button(link, 'Restablecer contraseña')}</p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
      Este enlace expira en 1 hora. Si no solicitaste esto, ignora este correo.
    </p>
  `);
  return sendMail({ to: opts.to, subject: 'Restablece tu contraseña — AndeXCertify', html });
}
