/* ──────────────────────────────────────────
   Report season
   The admin switches the platform between the "regular" mentoring season and
   the "capstone" season. The season is stamped onto every weekly and fellow
   monthly report when it is created, so a report always renders with the
   labels that were in force when it was written — flipping the switch never
   rewrites existing reports.

   Client-safe: no database imports here.
   ────────────────────────────────────────── */

export const ReportSeason = {
  REGULAR: "regular",
  CAPSTONE: "capstone",
} as const;
export type ReportSeason = (typeof ReportSeason)[keyof typeof ReportSeason];

export const REPORT_SEASONS: readonly ReportSeason[] = [ReportSeason.REGULAR, ReportSeason.CAPSTONE];

/** Reports created before seasons existed carry no season and are regular. */
export const DEFAULT_REPORT_SEASON: ReportSeason = ReportSeason.REGULAR;

export const REPORT_SEASON_LABELS: Record<ReportSeason, string> = {
  regular: "Regular",
  capstone: "Capstone",
};

export function isReportSeason(value: unknown): value is ReportSeason {
  return typeof value === "string" && (REPORT_SEASONS as readonly string[]).includes(value);
}

/** Coerce anything (undefined, legacy junk) to a valid season. */
export function normalizeReportSeason(value: unknown): ReportSeason {
  return isReportSeason(value) ? value : DEFAULT_REPORT_SEASON;
}

export function isCapstoneSeason(season: unknown): boolean {
  return normalizeReportSeason(season) === ReportSeason.CAPSTONE;
}

/* ── Weekly report: per-session topic field ── */
export function sessionTopicLabel(season: unknown): string {
  return isCapstoneSeason(season) ? "Capstone Project Progress Discussed" : "Topic Discussed";
}

export function sessionTopicPlaceholder(season: unknown): string {
  return isCapstoneSeason(season)
    ? "Describe the capstone project progress discussed in this session…"
    : "Describe the main topics discussed in this session…";
}

/* ── Fellow monthly report: "Learning / Courses Completed" is dropped in capstone ── */
export function showsLearningField(season: unknown): boolean {
  return !isCapstoneSeason(season);
}
