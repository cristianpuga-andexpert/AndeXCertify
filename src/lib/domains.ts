import { promises as dns } from 'node:dns';

/**
 * Platform base domain under which tenant subdomains are served, e.g.
 * 'certify.tudominio.cl' → tenants live at '<slug>.certify.tudominio.cl'.
 * Configured via BASE_DOMAIN; falls back to localhost for development.
 */
export const BASE_DOMAIN = (process.env.BASE_DOMAIN || 'localhost').toLowerCase();

/** DNS TXT record host used for custom-domain ownership verification. */
export function verifyRecordHost(customDomain: string): string {
  return `_andexcertify-challenge.${customDomain}`;
}

export type HostResolution =
  | { kind: 'root' }                              // the platform's own app
  | { kind: 'subdomain'; subdomain: string }      // <slug>.<BASE_DOMAIN>
  | { kind: 'custom'; domain: string };           // a tenant's own domain

/**
 * Classifies an incoming Host header into one of three routing cases.
 * Strips any port and lowercases. Reserved subdomains (www, app, api) and the
 * bare base domain resolve to the platform root, not a tenant.
 */
export function resolveHost(rawHost: string | undefined): HostResolution {
  const host = (rawHost || '').split(':')[0].trim().toLowerCase();
  if (!host) return { kind: 'root' };

  const RESERVED = new Set(['www', 'app', 'api', 'admin', 'storage']);

  // localhost / bare base domain → platform root
  if (host === BASE_DOMAIN || host === 'localhost' || host === '127.0.0.1') {
    return { kind: 'root' };
  }

  // <slug>.<BASE_DOMAIN> → subdomain tenant
  const suffix = `.${BASE_DOMAIN}`;
  if (host.endsWith(suffix)) {
    const slug = host.slice(0, -suffix.length);
    // Only single-label slugs are tenants; reserved labels are the root app.
    if (!slug.includes('.') && slug && !RESERVED.has(slug)) {
      return { kind: 'subdomain', subdomain: slug };
    }
    return { kind: 'root' };
  }

  // Anything else is a tenant's own custom domain.
  return { kind: 'custom', domain: host };
}

/**
 * Turns a free-text tenant name into a valid subdomain slug:
 * lowercase, alphanumeric + hyphens, no leading/trailing/double hyphens.
 */
export function slugifySubdomain(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 40);
}

/** Validates a custom domain looks like a real hostname (basic sanity check). */
export function isValidDomain(domain: string): boolean {
  const d = domain.trim().toLowerCase();
  if (d.length > 253) return false;
  return /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d);
}

/**
 * Checks whether the expected verification token is published as a DNS TXT
 * record for the given custom domain. Returns true on a match.
 */
export async function checkDomainTxtToken(customDomain: string, token: string): Promise<boolean> {
  try {
    const records = await dns.resolveTxt(verifyRecordHost(customDomain));
    // resolveTxt returns string[][] (each record may be chunked).
    return records.some(chunks => chunks.join('').trim() === token);
  } catch {
    return false; // NXDOMAIN / no record / lookup error → not verified
  }
}
