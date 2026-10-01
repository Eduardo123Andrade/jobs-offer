CREATE TYPE "public"."application_status" AS ENUM('saved', 'applied', 'in_review', 'interview', 'technical_test', 'offer', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."work_model" AS ENUM('remote', 'hybrid', 'onsite');--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"company" text,
	"role" text,
	"platform" text NOT NULL,
	"status" "application_status" DEFAULT 'applied' NOT NULL,
	"applied_at" date NOT NULL,
	"location" text,
	"work_model" "work_model",
	"salary" text,
	"contact_name" text,
	"contact_email" text,
	"notes" text,
	"follow_up_at" date,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "applications_applied_at_idx" ON "applications" USING btree ("applied_at");