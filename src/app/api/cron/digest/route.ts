/* ──────────────────────────────────────────
   Cron: /api/cron/digest — send weekly digest email
   Protected by CRON_SECRET bearer token
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { sendMail } from "@/lib/mailer";
import { weeklyDigestTemplate } from "@/lib/email-templates";
import { previousWeekKey } from "@/lib/date-helpers";
import { getRollup, getAlertsForWeek } from "@/services/rollup.service";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  if (!validateCronSecret(request)) {
    return jsonError("Unauthorized", 401);
  }

  const weekKey = previousWeekKey();
  const rollup = await getRollup(weekKey);
  const alerts = await getAlertsForWeek(weekKey);

  const digestData = {
    weekKey,
    submitted: rollup?.reportsSubmitted ?? 0,
    expected: rollup?.expectedReports ?? 0,
    submissionRate: rollup?.submissionRate ?? 0,
    totalSessions: rollup?.totalSessions ?? 0,
    totalCheckins: rollup?.totalCheckins ?? 0,
    urgentCount: rollup?.urgentAlertsCount ?? 0,
    topChallenges:
      rollup?.topChallenges?.map((c) => `${c.name} (${c.count})`).join("\n") ?? "",
    topStates:
      rollup?.topStates?.map((s) => `${s.name} (${s.count})`).join("\n") ?? "",
    urgentAlerts: alerts.map((a) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mentor: (a.mentor as any)?.name ?? "Unknown",
      state: a.state,
      details: a.urgentDetails,
    })),
  };

  const { subject, text, html } = weeklyDigestTemplate(digestData);
  const recipients = env.DIGEST_RECIPIENT_EMAILS();

  let sent = 0;
  const errors: string[] = [];

  for (const email of recipients) {
    try {
      await sendMail({ to: email, subject, text, html });
      sent++;
    } catch (err) {
      errors.push(`${email}: ${(err as Error).message}`);
    }
  }

  return jsonOk({ weekKey, digestsSent: sent, errors });
}
