import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { certificateTemplates, TemplateRow, TemplateInsert } from '../schema';
import { CertificateTemplate } from '../../types';

// fileData in CertificateTemplate now holds the S3 key (not Base64).
// isCompressed is irrelevant with S3 — always false.
function rowToTemplate(row: TemplateRow): CertificateTemplate {
  return {
    id:           row.id,
    name:         row.name,
    type:         row.type as CertificateTemplate['type'],
    fileData:     row.s3Key,   // S3 key stored in the fileData field of the TS interface
    fileName:     row.fileName,
    isCompressed: false,
    createdAt:    row.createdAt instanceof Date
                    ? row.createdAt.toISOString()
                    : String(row.createdAt),
    createdBy:    row.userId,
  };
}

export async function listTemplatesByUser(userId: string): Promise<CertificateTemplate[]> {
  const rows = await db
    .select()
    .from(certificateTemplates)
    .where(eq(certificateTemplates.userId, userId));
  return rows.map(rowToTemplate);
}

export async function getTemplateById(id: string): Promise<CertificateTemplate | null> {
  const rows = await db
    .select()
    .from(certificateTemplates)
    .where(eq(certificateTemplates.id, id));
  return rows[0] ? rowToTemplate(rows[0]) : null;
}

export async function createTemplate(
  userId: string,
  data: { name: string; type: 'sence' | 'non-sence'; s3Key: string; fileName: string }
): Promise<CertificateTemplate> {
  const insert: TemplateInsert = {
    userId,
    name:     data.name,
    type:     data.type,
    s3Key:    data.s3Key,
    fileName: data.fileName,
  };
  const [row] = await db.insert(certificateTemplates).values(insert).returning();
  return rowToTemplate(row);
}

export async function removeTemplate(id: string, userId: string): Promise<void> {
  await db
    .delete(certificateTemplates)
    .where(and(eq(certificateTemplates.id, id), eq(certificateTemplates.userId, userId)));
}
