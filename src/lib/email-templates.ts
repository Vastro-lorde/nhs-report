/* ──────────────────────────────────────────
   Email templates (single source of truth)
   ────────────────────────────────────────── */

export function reminderEmailTemplate(mentorName: string, weekKey: string, appUrl: string) {
  const subject = `Weekly Mentor Report Reminder (${weekKey})`;

  const text = `Hello ${mentorName},

This is a reminder to submit your weekly mentor report for ${weekKey}.

Submit here: ${appUrl}/reports/new

Please submit before end of day Friday.

Thank you,
NHS Mentor Reporting System`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Weekly Report Reminder</h2>
      <p>Hello <strong>${mentorName}</strong>,</p>
      <p>This is a reminder to submit your weekly mentor report for <strong>${weekKey}</strong>.</p>
      <p>
        <a href="${appUrl}/reports/new"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Submit Report
        </a>
      </p>
      <p>Please submit before end of day Friday.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">NHS Mentor Reporting System</p>
    </div>`;

  return { subject, text, html };
}

interface DigestData {
  weekKey: string;
  submitted: number;
  expected: number;
  submissionRate: number;
  totalSessions: number;
  totalCheckins: number;
  urgentCount: number;
  topChallenges: string;
  topStates: string;
  urgentAlerts: { mentor: string; state: string; details: string }[];
}

export function weeklyDigestTemplate(data: DigestData) {
  const subject = `Weekly Mentor Report Digest (${data.weekKey})`;
  const pct = Math.round(data.submissionRate * 100);

  const urgentLines = data.urgentAlerts.length
    ? data.urgentAlerts.map((a) => `• ${a.mentor} (${a.state}): ${a.details}`).join("\n")
    : "None";

  const text = `Weekly summary for ${data.weekKey}

Reports submitted: ${data.submitted} of ${data.expected} (${pct}%)
Total sessions: ${data.totalSessions}
Total check-ins: ${data.totalCheckins}
Urgent alerts: ${data.urgentCount}

Top challenges:
${data.topChallenges || "None"}

Top states by report volume:
${data.topStates || "None"}

Urgent alert details:
${urgentLines}`;

  const urgentHtml = data.urgentAlerts.length
    ? data.urgentAlerts
        .map((a) => `<li><strong>${a.mentor}</strong> (${a.state}): ${a.details}</li>`)
        .join("")
    : "<li>None</li>";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Weekly Digest — ${data.weekKey}</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Reports Submitted</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${data.submitted} / ${data.expected} (${pct}%)</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Total Sessions</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${data.totalSessions}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Total Check-ins</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${data.totalCheckins}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Urgent Alerts</strong></td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; ${data.urgentCount > 0 ? "color: #dc2626; font-weight: bold;" : ""}">${data.urgentCount}</td>
        </tr>
      </table>
      <h3>Top Challenges</h3>
      <p>${(data.topChallenges || "None").replace(/\n/g, "<br/>")}</p>
      <h3>Top States</h3>
      <p>${(data.topStates || "None").replace(/\n/g, "<br/>")}</p>
      <h3 style="color: #dc2626;">Urgent Alerts</h3>
      <ul>${urgentHtml}</ul>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">NHS Mentor Reporting System</p>
    </div>`;

  return { subject, text, html };
}
