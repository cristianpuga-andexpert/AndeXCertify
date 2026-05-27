import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const courseTypeEnum = pgEnum('course_type', ['horizontal', 'vertical']);

export const courseStatusEnum = pgEnum('course_status', ['active', 'inactive']);

export const qrDestinationEnum = pgEnum('qr_destination', ['pdf', 'verification']);

export const enrollmentStatusEnum = pgEnum('enrollment_status', [
  'Aprobado',
  'Aprobado con observación',
  'Rechazado',
]);

export const stampStyleEnum = pgEnum('stamp_style', [
  'circular_double',
  'circular_horizontal',
  'circular_dots',
  'oval',
  'square',
]);

export const templateTypeEnum = pgEnum('template_type', ['sence', 'non-sence']);

// ─── courses ──────────────────────────────────────────────────────────────────

export const courses = pgTable('courses', {
  id:             uuid('id').primaryKey().defaultRandom(),
  userId:         text('user_id').notNull(),         // Supabase auth.users UUID
  nameReference:  text('name_reference').notNull(),
  nameVisible:    text('name_visible').notNull(),
  type:           courseTypeEnum('type').notNull(),
  expirationDate: text('expiration_date'),            // ISO date string, nullable
  qrDestination:  qrDestinationEnum('qr_destination').notNull().default('verification'),
  status:         courseStatusEnum('status').notNull().default('active'),
  isSence:        boolean('is_sence').notNull().default(false),
  senceData:      jsonb('sence_data'),                // SenceData object | null
  templateId:     text('template_id'),               // FK to certificate_templates.id
  customAssetUrl: text('custom_asset_url'),
  description:    text('description'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── enrollments ──────────────────────────────────────────────────────────────

export const enrollments = pgTable('enrollments', {
  id:                     uuid('id').primaryKey().defaultRandom(),
  userId:                 text('user_id').notNull(),  // owner — mirrors Firestore createdBy
  courseId:               uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
  studentName:            text('student_name').notNull(),
  studentRut:             text('student_rut').notNull(),
  enrollmentDate:         text('enrollment_date').notNull(), // ISO string
  evaluation:             text('evaluation'),
  status:                 enrollmentStatusEnum('status').notNull().default('Aprobado'),
  attendance:             integer('attendance'),
  certificateGeneratedAt: text('certificate_generated_at'),  // ISO string, nullable
  createdAt:              timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── organization_settings ────────────────────────────────────────────────────
// One row per user — user_id IS the PK (mirrors Firestore settings/{userId})

export const organizationSettings = pgTable('organization_settings', {
  userId:          text('user_id').primaryKey(),     // Supabase auth.users UUID
  name:            text('name').notNull().default(''),
  rut:             text('rut').notNull().default(''),
  lema:            text('lema'),
  useCustomStamp:  boolean('use_custom_stamp').default(false),
  customStampName: text('custom_stamp_name'),
  stampStyle:      stampStyleEnum('stamp_style').default('circular_double'),
  logoUrl:         text('logo_url'),                 // S3 URL after migration
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── representatives ──────────────────────────────────────────────────────────
// Sub-collection: settings/{userId}/representatives/{repId}

export const representatives = pgTable('representatives', {
  id:           uuid('id').primaryKey().defaultRandom(),
  userId:       text('user_id').notNull().references(() => organizationSettings.userId, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  rut:          text('rut').notNull(),
  signatureUrl: text('signature_url').notNull(),     // S3 URL after migration
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── certificate_templates ────────────────────────────────────────────────────
// fileData (Base64) replaced by s3Key — the S3 object key ("templates/<uuid>.docx")

export const certificateTemplates = pgTable('certificate_templates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    text('user_id').notNull(),              // owner
  name:      text('name').notNull(),
  type:      templateTypeEnum('type').notNull(),
  s3Key:     text('s3_key').notNull(),               // e.g. "templates/abc-123.docx"
  fileName:  text('file_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CourseRow        = typeof courses.$inferSelect;
export type CourseInsert     = typeof courses.$inferInsert;
export type EnrollmentRow    = typeof enrollments.$inferSelect;
export type EnrollmentInsert = typeof enrollments.$inferInsert;
export type SettingsRow      = typeof organizationSettings.$inferSelect;
export type SettingsInsert   = typeof organizationSettings.$inferInsert;
export type RepRow           = typeof representatives.$inferSelect;
export type RepInsert        = typeof representatives.$inferInsert;
export type TemplateRow      = typeof certificateTemplates.$inferSelect;
export type TemplateInsert   = typeof certificateTemplates.$inferInsert;
