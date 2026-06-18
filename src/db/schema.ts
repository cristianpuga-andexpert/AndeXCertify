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

export const planEnum = pgEnum('plan', ['starter', 'pro', 'business', 'suspended']);

// ─── users (self-hosted auth) ─────────────────────────────────────────────────

export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  firstName:    text('first_name'),
  lastName:     text('last_name'),
  active:       boolean('active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token:     text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow    = typeof users.$inferSelect;
export type UserInsert = typeof users.$inferInsert;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

export const userRoleEnum = pgEnum('user_role', ['superadmin', 'admin', 'instructor', 'empresa', 'alumno']);

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

// ─── tenants ──────────────────────────────────────────────────────────────────

export const tenants = pgTable('tenants', {
  id:         uuid('id').primaryKey().defaultRandom(),
  name:       text('name').notNull(),
  rut:        text('rut').notNull(),
  plan:       planEnum('plan').notNull().default('starter'),
  active:     boolean('active').notNull().default(true),
  createdBy:  text('created_by').notNull(), // superadmin userId
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  planExpiry: timestamp('plan_expiry', { withTimezone: true }),

  // ── Multi-tenant domains ──────────────────────────────────────────────────
  // subdomain: always-available slug under the platform base domain, e.g.
  //   'laboralcap' → laboralcap.certify.tudominio.cl
  subdomain:            text('subdomain').unique(),
  // customDomain: tenant's own domain, e.g. 'certify.laboralcap.cl'. Only
  // serves traffic (and gets a TLS cert) once customDomainVerified is true.
  customDomain:         text('custom_domain').unique(),
  customDomainVerified: boolean('custom_domain_verified').notNull().default(false),
  // Random token the tenant must publish as a DNS TXT record to prove ownership
  // of customDomain before it is activated.
  domainVerifyToken:    text('domain_verify_token'),
});

export const tenantUsers = pgTable('tenant_users', {
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId:    text('user_id').notNull(),
  role:      userRoleEnum('role').notNull().default('admin'),
  email:     text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.tenantId, t.userId] }),
}));

// ─── courses ──────────────────────────────────────────────────────────────────

export const courses = pgTable('courses', {
  id:             uuid('id').primaryKey().defaultRandom(),
  tenantId:       uuid('tenant_id').notNull().references(() => tenants.id),
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
  tenantId:               uuid('tenant_id').notNull().references(() => tenants.id),
  userId:                 text('user_id').notNull(),  // owner
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
// One row per user — user_id IS the PK. tenantId added as a non-null FK.

export const organizationSettings = pgTable('organization_settings', {
  userId:          text('user_id').primaryKey(),     // Supabase auth.users UUID
  tenantId:        uuid('tenant_id').notNull().references(() => tenants.id),
  name:            text('name').notNull().default(''),
  rut:             text('rut').notNull().default(''),
  lema:            text('lema'),
  useCustomStamp:  boolean('use_custom_stamp').default(false),
  customStampName: text('custom_stamp_name'),
  stampStyle:      stampStyleEnum('stamp_style').default('circular_double'),
  logoUrl:         text('logo_url'),
  brandColor:      text('brand_color'),
  updatedAt:       timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── representatives ──────────────────────────────────────────────────────────

export const representatives = pgTable('representatives', {
  id:           uuid('id').primaryKey().defaultRandom(),
  tenantId:     uuid('tenant_id').notNull().references(() => tenants.id),
  userId:       text('user_id').notNull().references(() => organizationSettings.userId, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  rut:          text('rut').notNull(),
  signatureUrl: text('signature_url').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── certificate_templates ────────────────────────────────────────────────────

export const certificateTemplates = pgTable('certificate_templates', {
  id:        uuid('id').primaryKey().defaultRandom(),
  tenantId:  uuid('tenant_id').notNull().references(() => tenants.id),
  userId:    text('user_id').notNull(),              // owner
  name:      text('name').notNull(),
  type:      templateTypeEnum('type').notNull(),
  s3Key:     text('s3_key').notNull(),               // e.g. "templates/abc-123.docx"
  fileName:  text('file_name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── audit_logs ───────────────────────────────────────────────────────────────

export const auditLogs = pgTable('audit_logs', {
  id:         uuid('id').primaryKey().defaultRandom(),
  tenantId:   uuid('tenant_id'),                                               // nullable
  userId:     text('user_id'),                                                 // nullable (failed logins)
  action:     text('action').notNull(),                                        // 'user.login' | 'certificate.generated' | …
  resource:   text('resource').notNull(),                                      // 'auth' | 'course' | 'certificate' | …
  resourceId: text('resource_id'),
  ipAddress:  text('ip_address'),
  userAgent:  text('user_agent'),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogRow    = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;

// ─── invitations ──────────────────────────────────────────────────────────────
// A pending invite to join a tenant. The user account is only created when the
// invitee accepts and sets their password (via /set-password?token=...).

export const invitations = pgTable('invitations', {
  id:         uuid('id').primaryKey().defaultRandom(),
  email:      text('email').notNull(),
  tenantId:   uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  role:       userRoleEnum('role').notNull().default('admin'),
  token:      text('token').notNull().unique(),
  invitedBy:  text('invited_by'),                                              // userId of inviter (nullable)
  expiresAt:  timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),               // null = still pending
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InvitationRow    = typeof invitations.$inferSelect;
export type InvitationInsert = typeof invitations.$inferInsert;

// ─── platform_settings ──────────────────────────────────────────────────────────
// Single-row global configuration for the whole platform (not per-tenant).
// `id` is always the literal string 'singleton' so there can only be one row.

export const platformSettings = pgTable('platform_settings', {
  id:                        text('id').primaryKey().default('singleton'),
  publicRegistrationEnabled: boolean('public_registration_enabled').notNull().default(false),
  // Plan assigned to self-registered tenants (used when public registration is on).
  defaultSignupPlan:         planEnum('default_signup_plan').notNull().default('starter'),
  // Future: payment integration — billing cycle offered on self-signup.
  signupBillingCycle:        text('signup_billing_cycle').notNull().default('monthly'), // 'monthly' | 'annual'
  updatedAt:                 timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PlatformSettingsRow    = typeof platformSettings.$inferSelect;
export type PlatformSettingsInsert = typeof platformSettings.$inferInsert;

// ─── Inferred types ───────────────────────────────────────────────────────────

export type TenantRow        = typeof tenants.$inferSelect;
export type TenantInsert     = typeof tenants.$inferInsert;
export type TenantUserRow    = typeof tenantUsers.$inferSelect;
export type TenantUserInsert = typeof tenantUsers.$inferInsert;
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
