import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

// ─── Auth schemas ─────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email:     z.string().email('Email inválido').max(254).toLowerCase(),
  password:  z.string().min(8, 'Mínimo 8 caracteres').max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName:  z.string().min(1).max(100).optional(),
});

export const LoginSchema = z.object({
  email:    z.string().email('Email inválido').max(254),
  password: z.string().min(1).max(128),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword:     z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email().max(254),
});

export const ResetPasswordSchema = z.object({
  token:       z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128),
});

// ─── Invitation / tenant onboarding schemas ────────────────────────────────────

const roleEnum = z.enum(['superadmin', 'admin', 'instructor', 'empresa', 'alumno']);

/** Superadmin creates a new OTEC + invites its first admin. */
export const CreateTenantSchema = z.object({
  name:       z.string().min(1, 'Requerido').max(200),
  rut:        z.string().min(1, 'Requerido').max(20),
  adminEmail: z.string().email('Email inválido').max(254).toLowerCase(),
  plan:       z.enum(['starter', 'pro', 'business']).optional(),
  planExpiry: z.string().optional().nullable(),
});

/** Tenant admin invites a user into their own tenant. */
export const InviteUserSchema = z.object({
  email:       z.string().email('Email inválido').max(254).toLowerCase(),
  displayName: z.string().max(200).optional(),
  role:        z.enum(['admin', 'instructor', 'empresa', 'alumno']).default('admin'),
});

/** Invitee accepts and sets their password. */
export const AcceptInvitationSchema = z.object({
  token:     z.string().min(1).max(200),
  password:  z.string().min(8, 'Mínimo 8 caracteres').max(128),
  firstName: z.string().max(100).optional(),
  lastName:  z.string().max(100).optional(),
});

/** Superadmin updates global platform settings. */
export const PlatformSettingsSchema = z.object({
  publicRegistrationEnabled: z.boolean().optional(),
  defaultSignupPlan:         z.enum(['starter', 'pro', 'business']).optional(),
  signupBillingCycle:        z.enum(['monthly', 'annual']).optional(),
});

// ─── Data schemas ─────────────────────────────────────────────────────────────

export const CourseSchema = z.object({
  nameReference: z.string().min(1).max(200),
  nameVisible:   z.string().min(1).max(200),
  type:          z.enum(['horizontal', 'vertical']),
  isSence:       z.boolean(),
  description:   z.string().max(2000).optional(),
  // Builtin templates use string ids ('modern' | 'diploma' | 'classic');
  // uploaded templates use UUIDs. Accept any non-empty string id.
  templateId:    z.string().min(1).max(100).optional().nullable(),
  qrDestination: z.enum(['pdf', 'verification']).default('verification'),
}).passthrough(); // allow extra fields (expirationDate, senceData, etc.)

export const EnrollmentSchema = z.object({
  studentName:    z.string().min(1).max(200),
  studentRut:     z.string().min(1).max(12),
  enrollmentDate: z.string().min(1), // ISO date or datetime string
  evaluation:     z.string().max(10).optional(),
  status:         z.enum(['Aprobado', 'Aprobado con observación', 'Rechazado']),
  attendance:     z.number().int().min(0).max(100).optional(),
}).passthrough();

// ─── validate() middleware factory ────────────────────────────────────────────

/**
 * Returns an Express middleware that validates req.body against the given Zod
 * schema.  On failure it sends a 400 with field-level error details.
 * On success it replaces req.body with the parsed (and possibly transformed)
 * value so that downstream handlers get clean data.
 */
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error:   'Validation error',
        details: result.error.flatten().fieldErrors,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
