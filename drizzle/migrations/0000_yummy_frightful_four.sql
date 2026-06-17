CREATE TYPE "public"."course_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."course_type" AS ENUM('horizontal', 'vertical');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('Aprobado', 'Aprobado con observación', 'Rechazado');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('starter', 'pro', 'business', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."qr_destination" AS ENUM('pdf', 'verification');--> statement-breakpoint
CREATE TYPE "public"."stamp_style" AS ENUM('circular_double', 'circular_horizontal', 'circular_dots', 'oval', 'square');--> statement-breakpoint
CREATE TYPE "public"."template_type" AS ENUM('sence', 'non-sence');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('superadmin', 'admin', 'instructor', 'empresa', 'alumno');--> statement-breakpoint
CREATE TABLE "certificate_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"type" "template_type" NOT NULL,
	"s3_key" text NOT NULL,
	"file_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name_reference" text NOT NULL,
	"name_visible" text NOT NULL,
	"type" "course_type" NOT NULL,
	"expiration_date" text,
	"qr_destination" "qr_destination" DEFAULT 'verification' NOT NULL,
	"status" "course_status" DEFAULT 'active' NOT NULL,
	"is_sence" boolean DEFAULT false NOT NULL,
	"sence_data" jsonb,
	"template_id" text,
	"custom_asset_url" text,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"student_name" text NOT NULL,
	"student_rut" text NOT NULL,
	"enrollment_date" text NOT NULL,
	"evaluation" text,
	"status" "enrollment_status" DEFAULT 'Aprobado' NOT NULL,
	"attendance" integer,
	"certificate_generated_at" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"rut" text DEFAULT '' NOT NULL,
	"lema" text,
	"use_custom_stamp" boolean DEFAULT false,
	"custom_stamp_name" text,
	"stamp_style" "stamp_style" DEFAULT 'circular_double',
	"logo_url" text,
	"brand_color" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "representatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"rut" text NOT NULL,
	"signature_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_users_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rut" text NOT NULL,
	"plan" "plan" DEFAULT 'starter' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"plan_expiry" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_settings" ADD CONSTRAINT "organization_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representatives" ADD CONSTRAINT "representatives_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representatives" ADD CONSTRAINT "representatives_user_id_organization_settings_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."organization_settings"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;