import type { Request } from 'express';
import { db } from '../index';
import { auditLogs } from '../schema';

/**
 * Writes one row to audit_logs.  Never throws — failures are logged to stderr
 * so that audit logging never breaks the main request/response cycle.
 *
 * @param tenantId  UUID of the tenant, or null for cross-tenant events (e.g. failed login)
 * @param userId    ID of the acting user, or null when the user is unknown
 * @param action    Dot-separated action name, e.g. 'user.login', 'certificate.generated'
 * @param resource  Affected resource type, e.g. 'auth', 'course', 'certificate'
 * @param resourceId  Optional ID of the specific resource (course UUID, enrollment UUID, …)
 * @param req       Express request — used to extract IP address and user-agent
 */
export async function logAudit(
  tenantId:   string | null,
  userId:     string | null,
  action:     string,
  resource:   string,
  resourceId?: string,
  req?:       Request,
): Promise<void> {
  try {
    // Prefer X-Forwarded-For (set by the reverse proxy / load-balancer) over socket IP
    const ipAddress = req
      ? ((req.headers['x-forwarded-for'] as string | undefined)
          ?.split(',')[0].trim() ?? req.ip ?? null)
      : null;
    const userAgent = req ? (req.headers['user-agent'] ?? null) : null;

    await db.insert(auditLogs).values({
      tenantId:   tenantId ?? null,
      userId:     userId ?? null,
      action,
      resource,
      resourceId: resourceId ?? null,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    // Must never surface to the caller
    console.error('[Audit] Failed to write log entry:', err);
  }
}
