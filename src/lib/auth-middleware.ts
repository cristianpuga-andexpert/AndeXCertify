import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId: string;
}

/**
 * Express middleware that validates a Supabase JWT from the Authorization header.
 * Sets req.userId with the Supabase user UUID (sub claim).
 *
 * Requires: SUPABASE_JWT_SECRET environment variable.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // DEV mode: bypass all JWT verification for local development
  if (process.env.DEV_MODE === 'true') {
    (req as AuthRequest).userId =
      process.env.DEV_USER_ID || 'dev-00000000-0000-0000-0000-000000000001';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.SUPABASE_JWT_SECRET;

  if (!secret) {
    console.error('[Auth] SUPABASE_JWT_SECRET is not configured');
    res.status(500).json({ error: 'Server auth configuration error' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { sub: string };
    (req as AuthRequest).userId = payload.sub;
    next();
  } catch (err: any) {
    res.status(401).json({ error: 'Invalid or expired token', details: err.message });
  }
}
