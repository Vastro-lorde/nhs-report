/* ──────────────────────────────────────────
   API: /api/cohorts
   GET  — list cohorts with headcounts (admin)
   POST — start the next cohort in setup from the wizard's plan (admin)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { CohortPlanError, createSetupCohort, listCohorts, type NewCohortPlan } from "@/services/cohort.service";

export async function GET() {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  await connectDB();
  return jsonOk({ data: await listCohorts({ withCounts: true }) });
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const body = await parseBody<NewCohortPlan>(request);
  if (!body || !Array.isArray(body.staff) || !Array.isArray(body.fellows)) {
    return jsonError("Invalid cohort plan");
  }

  await connectDB();
  try {
    const cohort = await createSetupCohort(body, session!.user.id);
    void logActivity({
      session,
      action: "CREATE_COHORT",
      targetType: "Cohort",
      targetId: cohort?._id,
      targetName: cohort?.name,
      meta: { staff: body.staff.length, fellows: body.fellows.length },
    });
    return jsonCreated(cohort);
  } catch (err) {
    if (err instanceof CohortPlanError) return jsonError(err.message, 400, { problems: err.problems });
    throw err;
  }
}
