ALTER TABLE "applications" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "responsibilities" text;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "technologies" text[] DEFAULT '{}' NOT NULL;