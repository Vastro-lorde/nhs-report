/* ──────────────────────────────────────────
   Cron: /api/cron/reminders — send reminder emails
   Protected by CRON_SECRET bearer token
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, WeeklyReport, Mentor } from "@/models";
import { UserRole } from "@/lib/constants";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { reminderEmailTemplate } from "@/lib/email-templates";
import { currentWeekKey } from "@/lib/date-helpers";
import { env } from "@/lib/env";

async function handle(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  await connectDB();

  const weekKey = currentWeekKey();

  // Find mentors who have NOT submitted for this week
  const submittedMentorDocIds = await WeeklyReport.find({ weekKey }).distinct("mentor");
  const mentorDocsToRemind = await Mentor.find({
    _id: { $nin: submittedMentorDocIds },
  }).select("authId").lean();

  const mentorAuthIds = mentorDocsToRemind.map((m) => m.authId);
  const mentorsToRemind = await User.find({
    _id: { $in: mentorAuthIds },
    role: UserRole.MENTOR,
    active: true,
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

// Vercel Cron Jobs trigger via GET
export async function GET(request: NextRequest) {
  return handle(request);
}

// Keep POST for manual runs/tools
export async function POST(request: NextRequest) {
  return handle(request);
}
