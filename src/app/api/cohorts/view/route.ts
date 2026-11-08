/* ──────────────────────────────────────────
   API: /api/cohorts/view
   POST { cohortId } — admin switches which cohort they are looking at.
   POST { cohortId: null } (or the live cohort) — back to the live cohort.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { COHORT_VIEW_COOKIE, CohortStatus, encodeCohortViewCookie } from "@/lib/cohort";
import { getCohortById } from "@/lib/cohort-scope";

export async function POST(request: NextRequest) {
  const { error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const body = await parseBody<{ cohortId?: string | null }>(request);
  if (!body) return jsonError("Invalid body");

  await connectDB();

  const clear = () => {
    const res = jsonOk({ viewing: null });
    res.cookies.delete(COHORT_VIEW_COOKIE);
    return res;
  };

  if (!body.cohortId) return clear();

  const cohort = await getCohortById(body.cohortId);
  if (!cohort) return jsonError("Cohort not found", 404);
  if (cohort.status === CohortStatus.ACTIVE) return clear();

  const res = jsonOk({ viewing: { _id: String(cohort._id), name: cohort.name, status: cohort.status } });
  res.cookies.set(COHORT_VIEW_COOKIE, encodeCohortViewCookie(String(cohort._id), cohort.status), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // a working day; the login page also clears it
  });
  return res;
}
