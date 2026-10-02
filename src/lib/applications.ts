import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lte, notInArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { applications, type Application } from "@/db/schema";
import { CLOSED_STATUSES, RESPONDED_STATUSES, STALE_AFTER_DAYS, STATUSES, type Status } from "./constants";
import { isFollowUpDue, isOpen, isStale, todayIso } from "./follow-up";
import type { ApplicationInput, Filters } from "./validation";

function buildWhere(f: Filters): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (f.status.length) conds.push(inArray(applications.status, f.status));
  if (f.from) conds.push(gte(applications.appliedAt, f.from));
  if (f.to) conds.push(lte(applications.appliedAt, f.to));
  if (f.location) conds.push(ilike(applications.location, `%${f.location}%`));
  if (f.platform) conds.push(ilike(applications.platform, `%${f.platform}%`));
  if (f.workModel) conds.push(eq(applications.workModel, f.workModel));
  if (f.q) {
    const term = `%${f.q}%`;
    conds.push(
      or(
        ilike(applications.company, term),
        ilike(applications.role, term),
        ilike(applications.notes, term),
        ilike(applications.url, term),
        sql`array_to_string(${applications.technologies}, ' ') ilike ${term}`,
      ),
    );
  }
  if (f.followUp === "due") {
    conds.push(
      isNotNull(applications.followUpAt),
      lte(applications.followUpAt, sql`current_date`),
      notInArray(applications.status, CLOSED_STATUSES),
    );
  }
  if (f.followUp === "stale") {
    conds.push(
      notInArray(applications.status, CLOSED_STATUSES),
      lte(applications.statusChangedAt, sql`now() - make_interval(days => ${STALE_AFTER_DAYS})`),
    );
  }
  return and(...conds);
}

export async function listApplications(filters: Filters): Promise<Application[]> {
  return db
    .select()
    .from(applications)
    .where(buildWhere(filters))
    .orderBy(desc(applications.appliedAt), desc(applications.id));
}

export async function getApplication(id: number) {
  const [row] = await db.select().from(applications).where(eq(applications.id, id));
  return row ?? null;
}

export async function createApplication(input: ApplicationInput) {
  const [row] = await db.insert(applications).values(input).returning();
  return row;
}

export async function updateApplication(id: number, input: Partial<ApplicationInput>) {
  const current = await getApplication(id);
  if (!current) return null;
  const now = new Date();
  const statusChanged = input.status !== undefined && input.status !== current.status;
  const [row] = await db
    .update(applications)
    .set({ ...input, updatedAt: now, ...(statusChanged ? { statusChangedAt: now } : {}) })
    .where(eq(applications.id, id))
    .returning();
  return row;
}

export async function deleteApplication(id: number) {
  const rows = await db.delete(applications).where(eq(applications.id, id)).returning({ id: applications.id });
  return rows.length > 0;
}

export async function listDistinct(column: "location" | "platform") {
  const col = applications[column];
  const rows = await db.selectDistinct({ value: col }).from(applications).where(isNotNull(col)).orderBy(asc(col));
  return rows.map((r) => r.value).filter((v): v is string => Boolean(v));
}

// ---------- stats ----------

export type Stats = {
  total: number;
  open: number;
  responseRate: number; // 0..1, among applications that were actually sent
  interviewRate: number; // 0..1
  followUpsDue: number;
  stale: number;
  byStatus: { status: Status; count: number }[];
  byPlatform: { platform: string; count: number }[];
  byWeek: { week: string; count: number }[];
};

const INTERVIEW_OR_LATER: Status[] = ["interview", "technical_test", "offer"];

/** Monday (local) of the week containing an ISO date, as ISO date. */
function weekStart(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toLocaleDateString("en-CA");
}

export function computeStats(rows: Application[], weeks = 12): Stats {
  const today = todayIso();
  const now = Date.now();
  const sent = rows.filter((r) => r.status !== "saved");
  const responded = sent.filter((r) => RESPONDED_STATUSES.includes(r.status));
  const interviewed = sent.filter((r) => INTERVIEW_OR_LATER.includes(r.status));

  const statusCounts = new Map<Status, number>();
  const platformCounts = new Map<string, number>();
  const weekCounts = new Map<string, number>();
  for (const r of rows) {
    statusCounts.set(r.status, (statusCounts.get(r.status) ?? 0) + 1);
    platformCounts.set(r.platform, (platformCounts.get(r.platform) ?? 0) + 1);
    const w = weekStart(r.appliedAt);
    weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
  }

  // Continuous series of the last N weeks so the chart has no gaps.
  const byWeek: Stats["byWeek"] = [];
  const cursor = new Date(`${weekStart(today)}T00:00:00`);
  cursor.setDate(cursor.getDate() - 7 * (weeks - 1));
  for (let i = 0; i < weeks; i++) {
    const iso = cursor.toLocaleDateString("en-CA");
    byWeek.push({ week: iso, count: weekCounts.get(iso) ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }

  return {
    total: rows.length,
    open: rows.filter(isOpen).length,
    responseRate: sent.length ? responded.length / sent.length : 0,
    interviewRate: sent.length ? interviewed.length / sent.length : 0,
    followUpsDue: rows.filter((r) => isFollowUpDue(r, today)).length,
    stale: rows.filter((r) => isStale(r, now)).length,
    byStatus: STATUSES.map((status) => ({ status, count: statusCounts.get(status) ?? 0 })),
    byPlatform: [...platformCounts.entries()]
      .map(([platform, count]) => ({ platform, count }))
      .sort((a, b) => b.count - a.count),
    byWeek,
  };
}
