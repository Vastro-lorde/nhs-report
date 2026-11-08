/* ──────────────────────────────────────────
   API: /api/cohorts/:id/activate
   POST { resetReportSeason?: boolean } — make a cohort in setup the live
   cohort. The previous live cohort is archived (read-only, still browsable).
   Admin only.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { COHORT_VIEW_COOKIE } from "@/lib/cohort";
import { activateCohort, CohortPlanError } from "@/services/cohort.service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN);
  if (error) return error;
  const { id } = await params;

  const body = (await parseBody<{ resetReportSeason?: boolean }>(request)) ?? {};

  await connectDB();
  try {
    const result = await activateCohort(id, session!.user.id, { resetReportSeason: body.resetReportSeason !== false });
    void logActivity({
      session,
      action: "ACTIVATE_COHORT",
      targetType: "Cohort",
      targetId: id,
      targetName: result.activated?.name,
      meta: { archived: result.archived },
    });
    // The admin was looking at the setup cohort; it is now simply "current".
    const res = jsonOk(result);
    res.cookies.delete(COHORT_VIEW_COOKIE);
    return res;
  } catch (err) {
    if (err instanceof CohortPlanError) return jsonError(err.message, 400, { problems: err.problems });
    throw err;
  }
}
