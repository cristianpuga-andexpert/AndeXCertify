import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../index';
import { invitations, InvitationRow, InvitationInsert } from '../schema';

export async function createInvitation(data: {
  email:     string;
  tenantId:  string;
  role:      InvitationRow['role'];
  token:     string;
  invitedBy: string | null;
  expiresAt: Date;
}): Promise<InvitationRow> {
  // Remove any prior pending invitation for the same email+tenant
  await db.delete(invitations).where(
    and(eq(invitations.email, data.email), eq(invitations.tenantId, data.tenantId), isNull(invitations.acceptedAt))
  );
  const insert: InvitationInsert = data;
  const [row] = await db.insert(invitations).values(insert).returning();
  return row;
}

export async function getInvitationByToken(token: string): Promise<InvitationRow | null> {
  const rows = await db.select().from(invitations).where(eq(invitations.token, token));
  return rows[0] ?? null;
}

/** Pending (not yet accepted) invitations for a tenant. */
export async function getPendingInvitationsByTenant(tenantId: string): Promise<InvitationRow[]> {
  return db.select().from(invitations).where(
    and(eq(invitations.tenantId, tenantId), isNull(invitations.acceptedAt))
  );
}

export async function markInvitationAccepted(token: string): Promise<void> {
  await db.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.token, token));
}

/** Deletes a pending invitation, scoped to its tenant to prevent cross-tenant deletion. */
export async function deleteInvitation(id: string, tenantId: string): Promise<void> {
  await db.delete(invitations).where(
    and(eq(invitations.id, id), eq(invitations.tenantId, tenantId))
  );
}
