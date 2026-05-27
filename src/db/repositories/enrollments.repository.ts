import { eq, and } from 'drizzle-orm';
import { db } from '../index';
import { enrollments, EnrollmentRow, EnrollmentInsert } from '../schema';
import { Enrollment, EnrollmentStatus } from '../../types';

function rowToEnrollment(row: EnrollmentRow): Enrollment {
  return {
    id:                     row.id,
    courseId:               row.courseId,
    studentName:            row.studentName,
    studentRut:             row.studentRut,
    enrollmentDate:         row.enrollmentDate,
    evaluation:             row.evaluation ?? undefined,
    status:                 row.status as EnrollmentStatus,
    attendance:             row.attendance ?? undefined,
    certificateGeneratedAt: row.certificateGeneratedAt ?? undefined,
  };
}

export async function listEnrollmentsByCourse(
  courseId: string,
  userId: string
): Promise<Enrollment[]> {
  const rows = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.courseId, courseId), eq(enrollments.userId, userId)));
  return rows.map(rowToEnrollment);
}

export async function listEnrollmentsByUser(userId: string): Promise<Enrollment[]> {
  const rows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId));
  return rows.map(rowToEnrollment);
}

export async function getEnrollmentById(id: string): Promise<Enrollment | null> {
  const rows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.id, id));
  return rows[0] ? rowToEnrollment(rows[0]) : null;
}

export async function createEnrollment(
  userId: string,
  data: Omit<Enrollment, 'id'>
): Promise<Enrollment> {
  const insert: EnrollmentInsert = {
    userId,
    courseId:               data.courseId,
    studentName:            data.studentName,
    studentRut:             data.studentRut,
    enrollmentDate:         data.enrollmentDate,
    evaluation:             data.evaluation ?? null,
    status:                 data.status,
    attendance:             data.attendance ?? null,
    certificateGeneratedAt: data.certificateGeneratedAt ?? null,
  };
  const [row] = await db.insert(enrollments).values(insert).returning();
  return rowToEnrollment(row);
}

export async function updateEnrollment(
  id: string,
  userId: string,
  data: Partial<Omit<Enrollment, 'id' | 'courseId'>>
): Promise<Enrollment | null> {
  const set: Partial<EnrollmentInsert> = {};
  if (data.studentName            !== undefined) set.studentName            = data.studentName;
  if (data.studentRut             !== undefined) set.studentRut             = data.studentRut;
  if (data.enrollmentDate         !== undefined) set.enrollmentDate         = data.enrollmentDate;
  if (data.evaluation             !== undefined) set.evaluation             = data.evaluation ?? null;
  if (data.status                 !== undefined) set.status                 = data.status;
  if (data.attendance             !== undefined) set.attendance             = data.attendance ?? null;
  if (data.certificateGeneratedAt !== undefined) set.certificateGeneratedAt = data.certificateGeneratedAt ?? null;

  const rows = await db
    .update(enrollments)
    .set(set)
    .where(and(eq(enrollments.id, id), eq(enrollments.userId, userId)))
    .returning();
  return rows[0] ? rowToEnrollment(rows[0]) : null;
}

export async function removeEnrollment(id: string, userId: string): Promise<void> {
  await db
    .delete(enrollments)
    .where(and(eq(enrollments.id, id), eq(enrollments.userId, userId)));
}
