CREATE TABLE "metric_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cpu_load" real NOT NULL,
	"cpu_count" integer NOT NULL,
	"mem_used_pct" real NOT NULL,
	"disk_used_pct" real NOT NULL
);
