/* ──────────────────────────────────────────
   Date / week helpers  (single source of truth)
   ────────────────────────────────────────── */
import {
  format,
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  subWeeks,
  addDays,
} from "date-fns";

/** e.g. "2026-W08" */
export function isoWeekKey(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Parse "2026-W08" back to the Monday of that ISO week */
export function parseWeekKey(weekKey: string): Date | null {
  const match = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  // Jan 4 always falls in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfISOWeek(jan4);
  return addDays(startOfWeek1, (week - 1) * 7);
}

/** Current week key */
export function currentWeekKey(): string {
  return isoWeekKey(new Date());
}

/** Previous week key */
export function previousWeekKey(): string {
  return isoWeekKey(subWeeks(new Date(), 1));
}

/** Friday of the ISO week containing `date` */
export function fridayOfWeek(date: Date): Date {
  const monday = startOfISOWeek(date);
  return addDays(monday, 4);
}

/** Format date for display */
export function formatDate(date: Date | string, fmt = "dd MMM yyyy"): string {
  return format(new Date(date), fmt);
}

export { startOfISOWeek, endOfISOWeek, subWeeks, addDays };
