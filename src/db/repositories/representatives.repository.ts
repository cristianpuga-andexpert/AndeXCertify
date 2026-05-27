import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { representatives, RepRow, RepInsert } from '../schema';
import { Representative } from '../../types';

function rowToRep(row: RepRow): Representative {
  return {
    id:           row.id,
    name:         row.name,
    rut:          row.rut,
    signatureUrl: row.signatureUrl,
    createdAt:    row.createdAt instanceof Date
                    ? row.createdAt.toISOString()
                    : String(row.createdAt),
  };
}

export async function listRepresentativesByUser(userId: string): Promise<Representative[]> {
  const rows = await db
    .select()
    .from(representatives)
    .where(eq(representatives.userId, userId));
  return rows.map(rowToRep);
}

export async function getRepresentativeById(
  id: string,
  userId: string
): Promise<Representative | null> {
  const rows = await db
    .select()
    .from(representatives)
    .where(and(eq(representatives.id, id), eq(representatives.userId, userId)));
  return rows[0] ? rowToRep(rows[0]) : null;
}

export async function createRepresentative(
  userId: string,
  data: Omit<Representative, 'id' | 'createdAt'>
): Promise<Representative> {
  const insert: RepInsert = {
    userId,
    name:         data.name,
    rut:          data.rut,
    signatureUrl: data.signatureUrl,
  };
  const [row] = await db.insert(representatives).values(insert).returning();
  return rowToRep(row);
}

export async function removeRepresentative(id: string, userId: string): Promise<void> {
  await db
    .delete(representatives)
    .where(and(eq(representatives.id, id), eq(representatives.userId, userId)));
}
