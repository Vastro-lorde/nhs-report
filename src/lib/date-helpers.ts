/* ──────────────────────────────────────────
   Date / week helpers  (single source of truth)
   ────────────────────────────────────────── */
import {
  format,
  parseISO,
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  getISOWeekYear,
  subWeeks,
  addDays,
} from "date-fns";

/**
 * Safely format an ISO date string. Returns `fallback` if the value
 * is missing, empty, or produces an invalid Date.
 */
export function safeFormatISO(
  isoString: string | null | undefined,
  fmt: string,
  fallback = "—",
): string {
  if (!isoString) return fallback;
  try {
    const date = parseISO(isoString);
    if (Number.isNaN(date.getTime())) return fallback;
    return format(date, fmt);
  } catch {
    return fallback;
  }
}

/** e.g. "2026-W08" */
export function isoWeekKey(date: Date): string {
  const year = getISOWeekYear(date);
  const week = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/**
 * Parse a date-input value as a local calendar date. A bare "YYYY-MM-DD"
 * passed to `new Date()` is interpreted as UTC midnight which, in any tz
 * east of UTC, shifts the day forward. This helper anchors the date to the
 * local day the user actually picked.
 */
export function parseInputDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
  }
  return new Date(input);
}

/**
 * Canonical storage value for `weekEnding`: noon UTC of the Sunday that
 * ends the ISO week containing `date`. Using noon UTC keeps the calendar
 * day stable across every timezone we care about, so display code never
 * flips into the following week.
 */
export function canonicalWeekEnding(date: Date): Date {
  const week = isoWeekKey(date);
  const m = /^(\d{4})-W(\d{2})$/.exec(week);
  if (!m) return endOfISOWeek(date);
  const monday = parseWeekKey(week);
  if (!monday) return endOfISOWeek(date);
  const sunday = addDays(monday, 6);
  return new Date(
    Date.UTC(sunday.getFullYear(), sunday.getMonth(), sunday.getDate(), 12, 0, 0, 0),
  );
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

function weekRangeLabelFromRange(start: Date, end: Date): string {
  // Examples:
  // - Same month/year: 03-09 Mar 2026
  // - Diff month, same year: 28 Feb-06 Mar 2026
  // - Diff year: 29 Dec 2025-04 Jan 2026
  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    return `${format(start, "dd")}-${format(end, "dd MMM yyyy")}`;
  }

  if (sameYear) {
    return `${format(start, "dd MMM")}-${format(end, "dd MMM yyyy")}`;
  }

  return `${format(start, "dd MMM yyyy")}-${format(end, "dd MMM yyyy")}`;
}

/**
 * Display label for the ISO week containing `date`.
 * Intended for UI titles (keeps `weekKey` as internal identifier).
 */
export function weekRangeLabelFromDate(date: Date | string): string {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return String(date);
  return weekRangeLabelFromRange(startOfISOWeek(d), endOfISOWeek(d));
}

/** Display label for an ISO `weekKey` like "2026-W08". */
export function weekRangeLabelFromWeekKey(weekKey: string): string {
  const monday = parseWeekKey(weekKey);
  if (!monday) return weekKey;
  return weekRangeLabelFromRange(monday, endOfISOWeek(monday));
}

/** Filename-safe version of `weekRangeLabelFromDate`. */
export function weekRangeFilenameCodeFromDate(date: Date | string): string {
  return weekRangeLabelFromDate(date).replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "-");
}

/** Filename-safe version of `weekRangeLabelFromWeekKey`. */
export function weekRangeFilenameCodeFromWeekKey(weekKey: string): string {
  return weekRangeLabelFromWeekKey(weekKey)
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9_-]/g, "-");
}

/* ──────────────────────────────────────────
   Fellow monthly report window
   A month only becomes reportable once it has
   run past the 27th — before that the month is
   still in progress.
   ────────────────────────────────────────── */

/** Day of the month from which that month's fellow monthly report may be created. */
export const MONTHLY_REPORT_UNLOCK_DAY = 27;

/**
 * Floor for a reporting month — without one, any well-formed past year
 * ("1999-03", "0001-05") would pass. Set comfortably before the earliest
 * real activity in the programme (weekly reports start Mar 2025).
 */
export const EARLIEST_REPORTABLE_MONTH = "2025-01";

/** true for a well-formed "yyyy-MM" month key */
export function isValidMonthKey(month: string | null | undefined): boolean {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** "yyyy-MM" for a date */
export function monthKey(date: Date): string {
  return format(date, "yyyy-MM");
}

/** Human label for a "yyyy-MM" key, e.g. "March 2026" */
export function monthLabel(month: string): string {
  if (!isValidMonthKey(month)) return month;
  return format(parseISO(`${month}-01`), "MMMM yyyy");
}

/**
 * The most recent month a fellow monthly report may be created for.
 * On/after the 27th that is the current month, otherwise the previous one.
 */
export function latestReportableMonth(now: Date = new Date()): string {
  const unlocked = now.getDate() >= MONTHLY_REPORT_UNLOCK_DAY;
  return monthKey(new Date(now.getFullYear(), now.getMonth() + (unlocked ? 0 : -1), 1));
}

/** The date on which `month` becomes reportable (the 27th of that month). */
export function monthUnlockDate(month: string): Date | null {
  if (!isValidMonthKey(month)) return null;
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, MONTHLY_REPORT_UNLOCK_DAY);
}

/**
 * Zero-padded "yyyy-MM" keys sort lexicographically the same way they sort
 * chronologically, so plain string compares cover both month and year.
 */
export function isMonthReportable(month: string, now: Date = new Date()): boolean {
  if (!isValidMonthKey(month)) return false;
  return month >= EARLIEST_REPORTABLE_MONTH && month <= latestReportableMonth(now);
}

/**
 * Why `month` cannot be reported on yet, or `null` when it can.
 * Shared by the form and the API so both show the same wording.
 */
export function monthLockReason(month: string, now: Date = new Date()): string | null {
  if (!isValidMonthKey(month)) return "Enter a valid reporting month (YYYY-MM).";
  if (month < EARLIEST_REPORTABLE_MONTH) {
    return `${monthLabel(month)} is before the programme started — reports only go back to ${monthLabel(
      EARLIEST_REPORTABLE_MONTH,
    )}.`;
  }
  if (isMonthReportable(month, now)) return null;

  const current = monthKey(now);
  if (month > current) {
    return `${monthLabel(month)} is in the future — reports can only be created for months that have already run.`;
  }
  return `${monthLabel(month)} is still in progress. Reports for it unlock on ${format(
    monthUnlockDate(month)!,
    "dd MMM yyyy",
  )}.`;
}

export function getSundaysInMonth(monthString: string): number {
  if (!monthString || !/^\d{4}-\d{2}$/.test(monthString)) return 4;
  const [year, month] = monthString.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  let count = 0;
  while (date.getMonth() === month - 1) {
    if (date.getDay() === 0) {
      count++;
    }
    date.setDate(date.getDate() + 1);
  }
  return count;
}

export { startOfISOWeek, endOfISOWeek, subWeeks, addDays };
