/* ──────────────────────────────────────────
   API: /api/cohorts/roster
   Everyone in the current (live) cohort — the starting point of the
   new-cohort wizard. Admin only.
   ────────────────────────────────────────── */
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk } from "@/lib/api-helpers";
import { getActiveRoster } from "@/services/cohort.service";

export async function GET() {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  await connectDB();
  return jsonOk(await getActiveRoster());
}
