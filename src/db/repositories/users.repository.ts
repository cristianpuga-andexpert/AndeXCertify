import { eq, and, lt } from 'drizzle-orm';
import { db } from '../index';
import {
  users, refreshTokens, passwordResetTokens,
  UserRow, UserInsert,
} from '../schema';

// ─── Users ────────────────────────────────────────────────────────────────────

export async function createUser(
  email: string,
  passwordHash: string,
  firstName?: string,
  lastName?: string,
): Promise<UserRow> {
  const insert: UserInsert = { email, passwordHash, firstName, lastName };
  const [row] = await db.insert(users).values(insert).returning();
  return row;
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.email, email));
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, id));
  return rows[0] ?? null;
}

export async function updateUserPassword(
  userId: string,
  newHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ passwordHash: newHash, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<void> {
  await db
    .update(users)
    .set({ active, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function listUsers(): Promise<Omit<UserRow, 'passwordHash'>[]> {
  const rows = await db.select().from(users);
  return rows.map(({ passwordHash: _ph, ...rest }) => rest);
}

// ─── Refresh tokens ───────────────────────────────────────────────────────────

export async function createRefreshToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db.insert(refreshTokens).values({ userId, token, expiresAt });
}

export async function getRefreshToken(
  token: string,
): Promise<{ userId: string; expiresAt: Date } | null> {
  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token));
  if (!rows[0]) return null;
  return { userId: rows[0].userId, expiresAt: rows[0].expiresAt };
}

export async function deleteRefreshToken(token: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token));
}

export async function deleteAllUserRefreshTokens(userId: string): Promise<void> {
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
}

// ─── Password reset tokens ────────────────────────────────────────────────────

export async function createPasswordResetToken(
  userId: string,
  token: string,
  expiresAt: Date,
): Promise<void> {
  // Delete any existing tokens for this user first
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.insert(passwordResetTokens).values({ userId, token, expiresAt });
}

export async function getPasswordResetToken(
  token: string,
): Promise<{ userId: string; expiresAt: Date } | null> {
  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token));
  if (!rows[0]) return null;
  return { userId: rows[0].userId, expiresAt: rows[0].expiresAt };
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
}
