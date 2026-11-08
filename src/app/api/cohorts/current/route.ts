/* ──────────────────────────────────────────
   API: /api/cohorts/current
   The live cohort and the cohort this request is looking at (they differ only
   for an admin who has switched cohorts). Admins also get the cohort list for
   the switcher. Readable by any signed-in user.
   ────────────────────────────────────────── */
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk } from "@/lib/api-helpers";
import { getActiveCohort, resolveConcreteCohortScope } from "@/lib/cohort-scope";
import { getCohortSummary, listCohorts } from "@/services/cohort.service";
import type { CohortContextInfo } from "@/lib/cohort";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  await connectDB();
  const active = await getActiveCohort();
  const scope = await resolveConcreteCohortScope();
  const [activeSummary, viewingSummary] = await Promise.all([
    getCohortSummary(active._id),
    getCohortSummary(scope.cohortId),
  ]);

  const info: CohortContextInfo = {
    active: activeSummary!,
    viewing: viewingSummary ?? activeSummary!,
    isViewingOther: String(scope.cohortId) !== String(active._id),
    readOnly: scope.readOnly,
  };
  if (session!.user.role === UserRole.ADMIN) info.cohorts = await listCohorts();

  return jsonOk(info);
}
