/* ──────────────────────────────────────────
   API: /api/reports/season
   Returns the report season currently selected by the admin so report forms
   can pick the right labels/fields. Readable by any signed-in user.
   ────────────────────────────────────────── */
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk } from "@/lib/api-helpers";
import { getCurrentReportSeason } from "@/lib/report-season-server";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const reportSeason = await getCurrentReportSeason();
  return jsonOk({ reportSeason });
}
