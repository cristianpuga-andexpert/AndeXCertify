import { eq, and, sql } from 'drizzle-orm';
import { db } from '../index';
import {
  tenants, tenantUsers,
  TenantRow, TenantInsert,
  TenantUserRow, TenantUserInsert,
} from '../schema';

// ─── Tenant CRUD ──────────────────────────────────────────────────────────────

export async function createTenant(
  data: { name: string; rut: string; createdBy: string }
): Promise<TenantRow> {
  const insert: TenantInsert = {
    name:      data.name,
    rut:       data.rut,
    createdBy: data.createdBy,
  };
  const [row] = await db.insert(tenants).values(insert).returning();
  return row;
}

export async function getTenantById(id: string): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id));
  return rows[0] ?? null;
}

/** Superadmin only — returns every tenant regardless of owner. */
export async function listAllTenants(): Promise<TenantRow[]> {
  return db.select().from(tenants);
}

export async function updateTenantPlan(
  tenantId: string,
  plan: TenantRow['plan'],
  expiry: Date | null
): Promise<TenantRow | null> {
  const rows = await db
    .update(tenants)
    .set({ plan, planExpiry: expiry })
    .where(eq(tenants.id, tenantId))
    .returning();
  return rows[0] ?? null;
}

export async function setTenantActive(
  tenantId: string,
  active: boolean
): Promise<TenantRow | null> {
  const rows = await db
    .update(tenants)
    .set({ active })
    .where(eq(tenants.id, tenantId))
    .returning();
  return rows[0] ?? null;
}

// ─── Domain resolution & management ─────────────────────────────────────────

/** Look up a tenant by its platform subdomain slug (e.g. 'laboralcap'). */
export async function getTenantBySubdomain(subdomain: string): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(eq(tenants.subdomain, subdomain.toLowerCase()));
  return rows[0] ?? null;
}

/**
 * Look up a tenant by its verified custom domain (e.g. 'certify.laboralcap.cl').
 * Only returns a tenant whose domain ownership has been verified.
 */
export async function getTenantByVerifiedCustomDomain(domain: string): Promise<TenantRow | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(and(
      eq(tenants.customDomain, domain.toLowerCase()),
      eq(tenants.customDomainVerified, true),
    ));
  return rows[0] ?? null;
}

/** Assigns/updates the platform subdomain slug for a tenant. */
export async function setTenantSubdomain(tenantId: string, subdomain: string): Promise<TenantRow | null> {
  const rows = await db
    .update(tenants)
    .set({ subdomain: subdomain.toLowerCase() })
    .where(eq(tenants.id, tenantId))
    .returning();
  return rows[0] ?? null;
}

/**
 * Sets (or replaces) the pending custom domain for a tenant and stores the
 * DNS-verification token. Marks the domain as unverified until proven.
 */
export async function setTenantCustomDomain(
  tenantId: string,
  domain: string | null,
  verifyToken: string | null,
): Promise<TenantRow | null> {
  const rows = await db
    .update(tenants)
    .set({
      customDomain:         domain ? domain.toLowerCase() : null,
      domainVerifyToken:    verifyToken,
      customDomainVerified: false,
    })
    .where(eq(tenants.id, tenantId))
    .returning();
  return rows[0] ?? null;
}

/** Marks a tenant's custom domain as verified (ownership proven via DNS). */
export async function markCustomDomainVerified(tenantId: string): Promise<TenantRow | null> {
  const rows = await db
    .update(tenants)
    .set({ customDomainVerified: true, domainVerifyToken: null })
    .where(eq(tenants.id, tenantId))
    .returning();
  return rows[0] ?? null;
}

// ─── TenantUser CRUD ──────────────────────────────────────────────────────────

export async function addUserToTenant(
  tenantId: string,
  userId: string,
  role: TenantUserRow['role'],
  email: string
): Promise<TenantUserRow> {
  const insert: TenantUserInsert = { tenantId, userId, role, email };
  const [row] = await db
    .insert(tenantUsers)
    .values(insert)
    .onConflictDoUpdate({
      target: [tenantUsers.tenantId, tenantUsers.userId],
      set: { role, email },
    })
    .returning();
  return row;
}

/** Returns all tenants a user belongs to (used by auth middleware). */
export async function getUserTenants(userId: string): Promise<TenantUserRow[]> {
  return db
    .select()
    .from(tenantUsers)
    .where(eq(tenantUsers.userId, userId));
}

/**
 * Returns a map of tenantId → user count for all tenants.
 * Used by the superadmin dashboard to show users-per-OTEC.
 */
export async function getTenantUserCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      tenantId: tenantUsers.tenantId,
      count:    sql<number>`cast(count(*) as integer)`,
    })
    .from(tenantUsers)
    .groupBy(tenantUsers.tenantId);
  return Object.fromEntries(rows.map(r => [r.tenantId, r.count]));
}

/**
 * Promotes a user to superadmin on all their existing tenant memberships.
 * Used by the server bootstrap to ensure the configured superadmin has the right role.
 */
export async function setUserRoleSuperadmin(userId: string): Promise<void> {
  await db
    .update(tenantUsers)
    .set({ role: 'superadmin' })
    .where(eq(tenantUsers.userId, userId));
}

/** Returns the specific membership row for a user in a tenant. */
export async function getTenantUser(
  tenantId: string,
  userId: string
): Promise<TenantUserRow | null> {
  const rows = await db
    .select()
    .from(tenantUsers)
    .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.userId, userId)));
  return rows[0] ?? null;
}
