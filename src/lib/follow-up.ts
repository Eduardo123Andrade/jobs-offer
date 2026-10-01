import type { Application } from "@/db/schema";
import { CLOSED_STATUSES, STALE_AFTER_DAYS, type Status } from "./constants";

type Tracked = { status: Status; followUpAt: string | null; statusChangedAt: Date | string };

const DAY = 24 * 60 * 60 * 1000;

/** Today's date (local time) as YYYY-MM-DD, comparable with `date` columns. */
export const todayIso = () => new Date().toLocaleDateString("en-CA");

export const isOpen = (a: Pick<Tracked, "status">) => !CLOSED_STATUSES.includes(a.status);

export const isFollowUpDue = (a: Tracked, today = todayIso()) =>
  isOpen(a) && a.followUpAt !== null && a.followUpAt <= today;

export const isStale = (a: Tracked, now = Date.now()) =>
  isOpen(a) && now - new Date(a.statusChangedAt).getTime() >= STALE_AFTER_DAYS * DAY;

/** Application plus flags computed on the server, so client rendering stays pure. */
export type ApplicationRow = Application & { followUpDue: boolean; stale: boolean };

export function withFlags(rows: Application[]): ApplicationRow[] {
  const today = todayIso();
  const now = Date.now();
  return rows.map((a) => ({ ...a, followUpDue: isFollowUpDue(a, today), stale: isStale(a, now) }));
}
