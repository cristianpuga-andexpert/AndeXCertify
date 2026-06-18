import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './auth';

/**
 * DEV_MODE bypasses authentication entirely, so it must NEVER be honoured in
 * production — even if the env var leaks into a prod deployment. We gate it
 * behind a hard NODE_ENV check evaluated once at module load.
 */
const DEV_BYPASS_ENABLED =
  process.env.NODE_ENV !== 'production' && process.env.DEV_MODE === 'true';

if (process.env.NODE_ENV === 'production' && process.env.DEV_MODE === 'true') {
  console.warn(
    '[auth] DEV_MODE=true was ignored because NODE_ENV=production. ' +
    'Authentication is fully enforced.',
  );
}

export interface AuthRequest extends Request {
  userId:   string;
  email:    string;
  tenantId: string;
  role:     string;
}

/**
 * Verifies the Bearer JWT issued by our own auth system.
 * In DEV_MODE the check is bypassed and synthetic values are injected.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // ── DEV mode bypass (never active in production) ─────────────────────────────
  if (DEV_BYPASS_ENABLED) {
    (req as AuthRequest).userId   = process.env.DEV_USER_ID   || 'dev-00000000-0000-0000-0000-000000000001';
    (req as AuthRequest).email    = 'dev@andex.local';
    (req as AuthRequest).tenantId = process.env.DEV_TENANT_ID || '00000000-0000-0000-0000-000000000001';
    (req as AuthRequest).role     = process.env.DEV_ROLE      || 'admin';
    next();
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    (req as AuthRequest).userId   = payload.userId;
    (req as AuthRequest).email    = payload.email;
    (req as AuthRequest).tenantId = payload.tenantId;
    (req as AuthRequest).role     = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Secondary guard — must come after requireAuth.
 * Rejects the request unless the resolved role is 'superadmin'.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if ((req as AuthRequest).role !== 'superadmin') {
    res.status(403).json({ error: 'Superadmin required' });
    return;
  }
  next();
}

/**
 * Secondary guard — must come after requireAuth.
 * Rejects the request unless the caller administers the current tenant
 * (role 'admin' for their tenant, or a platform 'superadmin'). Use this on
 * tenant user-management endpoints so non-admin members (instructor, empresa,
 * alumno) cannot invite/disable/remove users or escalate privileges.
 */
export function requireTenantAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = (req as AuthRequest).role;
  if (role !== 'admin' && role !== 'superadmin') {
    res.status(403).json({ error: 'Permiso insuficiente: se requiere rol de administrador' });
    return;
  }
  next();
}
