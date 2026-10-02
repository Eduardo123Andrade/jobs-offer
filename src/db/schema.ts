import { date, index, pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
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
