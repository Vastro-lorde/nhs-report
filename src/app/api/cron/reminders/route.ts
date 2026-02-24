/* ──────────────────────────────────────────
   Cron: /api/cron/reminders — send reminder emails
   Protected by CRON_SECRET bearer token
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, WeeklyReport } from "@/models";
import { UserRole } from "@/lib/constants";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { reminderEmailTemplate } from "@/lib/email-templates";
import { currentWeekKey } from "@/lib/date-helpers";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  await connectDB();

  const weekKey = currentWeekKey();

  // Find mentors who have NOT submitted for this week
  const submittedMentorIds = await WeeklyReport.find({ weekKey }).distinct("mentor");
  const mentorsToRemind = await User.find({
    role: UserRole.MENTOR,
    active: true,
    _id: { $nin: submittedMentorIds },
  }).lean();

  const appUrl = env.NEXTAUTH_URL();
  let sent = 0;
  const errors: string[] = [];

  for (const mentor of mentorsToRemind) {
    try {
      const { subject, text, html } = reminderEmailTemplate(mentor.name, weekKey, appUrl);
      await sendMail({ to: mentor.email, subject, text, html });
      sent++;
    } catch (err) {
      errors.push(`${mentor.email}: ${(err as Error).message}`);
    }
  }

  return jsonOk({
    weekKey,
    totalMentors: mentorsToRemind.length,
    remindersSent: sent,
    errors,
  });
}
