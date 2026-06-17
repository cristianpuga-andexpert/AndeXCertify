import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Resolves a required secret. In production a missing or weak secret is a
 * fatal misconfiguration — we crash on boot rather than silently running with
 * an insecure default that would let anyone forge tokens. In development we
 * fall back to a clearly-marked placeholder for convenience.
 */
function requireSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (IS_PROD) {
    if (!value || value.length < 32 || value.includes('change-in-production')) {
      throw new Error(
        `[auth] ${name} must be set to a strong secret (>= 32 chars) in production. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`,
      );
    }
    return value;
  }
  return value ?? `dev-${name.toLowerCase()}-change-in-production`;
}

const ACCESS_SECRET  = requireSecret('JWT_ACCESS_SECRET');
const REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');

const ACCESS_EXPIRY  = '15m';

export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export interface JwtPayload {
  userId:   string;
  email:    string;
  tenantId: string;
  role:     string;
}

// ─── Password ─────────────────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Access token ─────────────────────────────────────────────────────────────

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

// ─── Refresh token ────────────────────────────────────────────────────────────

/** Returns a cryptographically random 128-char hex string. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

/** Returns the expiry Date for a new refresh token. */
export function refreshTokenExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);
  return d;
}

// ─── Password reset token ─────────────────────────────────────────────────────

/** Returns a cryptographically random 64-char hex token. */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Reset tokens expire in 1 hour. */
export function resetTokenExpiresAt(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}
