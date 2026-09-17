/* ──────────────────────────────────────────
   Report season — server helpers (reads AppSettings)
   ────────────────────────────────────────── */
import { AppSettings } from "@/models";
import { normalizeReportSeason, type ReportSeason } from "./report-season";

/** The season currently selected by the admin. Missing settings → regular. */
export async function getCurrentReportSeason(): Promise<ReportSeason> {
  const settings = await AppSettings.findOne({}).select("reportSeason").lean();
  return normalizeReportSeason(settings?.reportSeason);
}
