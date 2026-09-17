/* ──────────────────────────────────────────
   API: /api/admin/report-settings
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AppSettings } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { DEFAULT_REPORT_SEASON, isReportSeason, type ReportSeason } from "@/lib/report-season";

const DEFAULT_SETTINGS = {
  blockWeeklyReportEdits: { mentor: false, coordinator: false },
  blockMonthlyReportEdits: { mentor: false, coordinator: false },
  blockZonalAuditEdits: false,
  reportSeason: DEFAULT_REPORT_SEASON,
};

// GET /api/admin/report-settings
export async function GET() {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  await connectDB();

  // Settings saved before a field existed won't carry it (lean skips schema
  // defaults), so fill the gaps from the defaults.
  const settings = await AppSettings.findOne({}).lean();
  return jsonOk({ ...DEFAULT_SETTINGS, ...(settings ?? {}) });
}

// PATCH /api/admin/report-settings
export async function PATCH(request: NextRequest) {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const body = await parseBody<{
    blockWeeklyReportEdits?: { mentor?: boolean; coordinator?: boolean };
    blockMonthlyReportEdits?: { mentor?: boolean; coordinator?: boolean };
    blockZonalAuditEdits?: boolean;
    reportSeason?: ReportSeason;
  }>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  const update: Record<string, boolean | ReportSeason> = {};
  if (body.blockWeeklyReportEdits?.mentor !== undefined) {
    update["blockWeeklyReportEdits.mentor"] = body.blockWeeklyReportEdits.mentor;
  }
  if (body.blockWeeklyReportEdits?.coordinator !== undefined) {
    update["blockWeeklyReportEdits.coordinator"] = body.blockWeeklyReportEdits.coordinator;
  }
  if (body.blockMonthlyReportEdits?.mentor !== undefined) {
    update["blockMonthlyReportEdits.mentor"] = body.blockMonthlyReportEdits.mentor;
  }
  if (body.blockMonthlyReportEdits?.coordinator !== undefined) {
    update["blockMonthlyReportEdits.coordinator"] = body.blockMonthlyReportEdits.coordinator;
  }
  if (body.blockZonalAuditEdits !== undefined) {
    update["blockZonalAuditEdits"] = body.blockZonalAuditEdits;
  }
  if (body.reportSeason !== undefined) {
    if (!isReportSeason(body.reportSeason)) return jsonError("Invalid report season");
    update["reportSeason"] = body.reportSeason;
  }

  if (Object.keys(update).length === 0) return jsonError("No valid fields provided");

  const settings = await AppSettings.findOneAndUpdate(
    {},
    { $set: update },
    { upsert: true, new: true },
  ).lean();

  return jsonOk({ ...DEFAULT_SETTINGS, ...(settings ?? {}) });
}
