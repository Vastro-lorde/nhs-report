/* ──────────────────────────────────────────
   API: /api/reports/check-current-week
   Returns whether the logged-in mentor already
   has a report covering the current ISO week.
   ────────────────────────────────────────── */
import { connectDB } from "@/lib/db";
import { WeeklyReport, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { currentWeekKey } from "@/lib/date-helpers";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  if (session!.user.role !== UserRole.MENTOR) {
    return jsonOk({ hasReport: false });
  }

  await connectDB();

  const mentorDoc = await Mentor.findOne({ authId: session!.user.id });
  if (!mentorDoc) {
    return jsonError("Mentor profile not found", 403);
  }

  const weekKey = currentWeekKey();
  const existing = await WeeklyReport.exists({ mentor: mentorDoc._id, weekKey });

  return jsonOk({ hasReport: !!existing });
}
