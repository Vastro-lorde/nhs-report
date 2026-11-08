/* ──────────────────────────────────────────
   API: /api/cohorts/:id
   PATCH  — rename / edit notes (admin)
   DELETE — discard a cohort that is still in setup (admin)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Cohort } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { COHORT_VIEW_COOKIE } from "@/lib/cohort";
import { invalidateCohortCache } from "@/lib/cohort-scope";
import { CohortPlanError, discardSetupCohort, getCohortSummary } from "@/services/cohort.service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN);
  if (error) return error;
  const { id } = await params;

  const body = await parseBody<{ name?: string; notes?: string }>(request);
  if (!body) return jsonError("Invalid body");

  const update: Record<string, string> = {};
  if (typeof body.name === "string") {
    if (!body.name.trim()) return jsonError("Name cannot be empty");
    update.name = body.name.trim();
  }
  if (typeof body.notes === "string") update.notes = body.notes.trim();
  if (!Object.keys(update).length) return jsonError("Nothing to update");

  await connectDB();
  const res = await Cohort.updateOne({ _id: id }, { $set: update });
  if (!res.matchedCount) return jsonError("Cohort not found", 404);
  invalidateCohortCache();

  void logActivity({ session, action: "UPDATE_COHORT", targetType: "Cohort", targetId: id, meta: update });
  return jsonOk(await getCohortSummary(id));
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN);
  if (error) return error;
  const { id } = await params;

  await connectDB();
  try {
    const result = await discardSetupCohort(id);
    void logActivity({ session, action: "DISCARD_COHORT", targetType: "Cohort", targetId: id, targetName: result.discarded });
    const res = jsonOk(result);
    res.cookies.delete(COHORT_VIEW_COOKIE);
    return res;
  } catch (err) {
    if (err instanceof CohortPlanError) return jsonError(err.message, 400, { problems: err.problems });
    throw err;
  }
}
