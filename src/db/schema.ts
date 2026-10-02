import { date, index, integer, jsonb, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { STATUSES, WORK_MODELS } from "@/lib/constants";

export const statusEnum = pgEnum("application_status", STATUSES);
export const workModelEnum = pgEnum("work_model", WORK_MODELS);

export const applications = pgTable(
  "applications",
  {
    id: serial("id").primaryKey(),
    url: text("url").notNull(),
    company: text("company"),
    role: text("role"),
    platform: text("platform").notNull(),
    status: statusEnum("status").notNull().default("applied"),
    appliedAt: date("applied_at").notNull(),
    location: text("location"),
    workModel: workModelEnum("work_model"),
    salary: text("salary"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    /** CV file sent for this application, relative to the CV folder (CV_DIR, default ./cv). */
    cvPath: text("cv_path"),
    description: text("description"),
    responsibilities: text("responsibilities"),
    technologies: text("technologies").array().notNull().default([]),
    followUpAt: date("follow_up_at"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("applications_status_idx").on(t.status), index("applications_applied_at_idx").on(t.appliedAt)],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;

/** Free-form notes about the user (pitch, strengths, answers to common questions...). */
export const profileNotes = pgTable("profile_notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default(""),
  content: text("content").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ProfileNote = typeof profileNotes.$inferSelect;

export type CvBridge = { tech: string; basedOn: string[]; pitch: string; studyPlan: string };
export type CvAnalysis = { language: "en" | "pt"; jobTechs: string[]; matched: string[]; fromOtherCv: string[]; missing: string[]; score: number };

/** Latest CV tailored for an application (one per application, regenerating replaces it). */
export const tailoredCvs = pgTable("tailored_cvs", {
  id: serial("id").primaryKey(),
  applicationId: integer("application_id")
    .notNull()
    .unique()
    .references(() => applications.id, { onDelete: "cascade" }),
  language: text("language").$type<CvAnalysis["language"]>().notNull(),
  markdown: text("markdown").notNull(),
  bridges: jsonb("bridges").$type<CvBridge[]>().notNull().default([]),
  changes: jsonb("changes").$type<string[]>().notNull().default([]),
  analysis: jsonb("analysis").$type<CvAnalysis>().notNull(),
  model: text("model").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TailoredCv = typeof tailoredCvs.$inferSelect;
