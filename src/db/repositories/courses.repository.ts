import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { courses, CourseRow, CourseInsert } from '../schema';
import { Course, CourseType, CourseStatus, QRDestination, SenceData } from '../../types';

function toISO(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString();
  return d instanceof Date ? d.toISOString() : d;
}

function rowToCourse(row: CourseRow): Course {
  return {
    id:             row.id,
    tenantId:       row.tenantId,
    nameReference:  row.nameReference,
    nameVisible:    row.nameVisible,
    type:           row.type as CourseType,
    expirationDate: row.expirationDate ?? undefined,
    qrDestination:  row.qrDestination as QRDestination,
    status:         row.status as CourseStatus,
    isSence:        row.isSence,
    senceData:      (row.senceData as SenceData) ?? undefined,
    templateId:     row.templateId ?? undefined,
    customAssetUrl: row.customAssetUrl ?? undefined,
    description:    row.description ?? undefined,
    createdAt:      toISO(row.createdAt),
    createdBy:      row.userId,
  };
}

export async function listCoursesByUser(
  userId: string,
  tenantId: string
): Promise<Course[]> {
  const rows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.tenantId, tenantId), eq(courses.userId, userId)));
  return rows.map(rowToCourse);
}

export async function getCourseById(id: string): Promise<Course | null> {
  const rows = await db
    .select()
    .from(courses)
    .where(eq(courses.id, id));
  return rows[0] ? rowToCourse(rows[0]) : null;
}

export async function createCourse(
  userId: string,
  tenantId: string,
  data: Omit<Course, 'id' | 'createdAt' | 'createdBy' | 'tenantId'>
): Promise<Course> {
  const insert: CourseInsert = {
    tenantId,
    userId,
    nameReference:  data.nameReference,
    nameVisible:    data.nameVisible,
    type:           data.type,
    expirationDate: data.expirationDate ?? null,
    qrDestination:  data.qrDestination,
    status:         data.status,
    isSence:        data.isSence,
    senceData:      data.senceData ?? null,
    templateId:     data.templateId ?? null,
    customAssetUrl: data.customAssetUrl ?? null,
    description:    data.description ?? null,
  };
  const [row] = await db.insert(courses).values(insert).returning();
  return rowToCourse(row);
}

export async function updateCourse(
  id: string,
  userId: string,
  tenantId: string,
  data: Partial<Omit<Course, 'id' | 'createdAt' | 'createdBy' | 'tenantId'>>
): Promise<Course | null> {
  const set: Partial<CourseInsert> = {};
  if (data.nameReference  !== undefined) set.nameReference  = data.nameReference;
  if (data.nameVisible    !== undefined) set.nameVisible    = data.nameVisible;
  if (data.type           !== undefined) set.type           = data.type;
  if (data.expirationDate !== undefined) set.expirationDate = data.expirationDate ?? null;
  if (data.qrDestination  !== undefined) set.qrDestination  = data.qrDestination;
  if (data.status         !== undefined) set.status         = data.status;
  if (data.isSence        !== undefined) set.isSence        = data.isSence;
  if (data.senceData      !== undefined) set.senceData      = data.senceData ?? null;
  if (data.templateId     !== undefined) set.templateId     = data.templateId ?? null;
  if (data.customAssetUrl !== undefined) set.customAssetUrl = data.customAssetUrl ?? null;
  if (data.description    !== undefined) set.description    = data.description ?? null;

  const rows = await db
    .update(courses)
    .set(set)
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId), eq(courses.userId, userId)))
    .returning();
  return rows[0] ? rowToCourse(rows[0]) : null;
}

export async function removeCourse(
  id: string,
  userId: string,
  tenantId: string
): Promise<void> {
  await db
    .delete(courses)
    .where(and(eq(courses.id, id), eq(courses.tenantId, tenantId), eq(courses.userId, userId)));
}
