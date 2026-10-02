CREATE TABLE "tailored_cvs" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"language" text NOT NULL,
	"markdown" text NOT NULL,
	"bridges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"analysis" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tailored_cvs_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
ALTER TABLE "tailored_cvs" ADD CONSTRAINT "tailored_cvs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;