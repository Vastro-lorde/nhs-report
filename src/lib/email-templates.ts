/* ──────────────────────────────────────────
   Email templates (single source of truth)
   ────────────────────────────────────────── */
import { APP_NAME } from "./constants";
import { weekRangeLabelFromWeekKey } from "./date-helpers";

export function reminderEmailTemplate(mentorName: string, weekKey: string, appUrl: string) {
  const weekLabel = weekRangeLabelFromWeekKey(weekKey);
  const subject = `Weekly Mentor Report Reminder (${weekLabel})`;

  const text = `Hello ${mentorName},

This is a reminder to submit your weekly mentor report for ${weekLabel}.

Submit here: ${appUrl}/reports/new

Please submit before end of day Friday.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Weekly Report Reminder</h2>
      <p>Hello <strong>${mentorName}</strong>,</p>
      <p>This is a reminder to submit your weekly mentor report for <strong>${weekLabel}</strong>.</p>
      <p>
        <a href="${appUrl}/reports/new"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Submit Report
        </a>
      </p>
      <p>Please submit before end of day Friday.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
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
  const weekLabel = weekRangeLabelFromWeekKey(data.weekKey);
  const subject = `Weekly Mentor Report Digest (${weekLabel})`;
  const pct = Math.round(data.submissionRate * 100);

  const urgentLines = data.urgentAlerts.length
    ? data.urgentAlerts.map((a) => `• ${a.mentor} (${a.state}): ${a.details}`).join("\n")
    : "None";

  const text = `Weekly summary for ${weekLabel}

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
      <h2 style="color: #1a7f37;">Weekly Digest — ${weekLabel}</h2>
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
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function newCoordinatorEmailTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Welcome to ${APP_NAME} - Coordinator Account Created`;

  const text = `Hello ${name},

An administrator has created a Zonal Coordinator account for you on ${APP_NAME}.

Your login credentials are:
Email: ${email}
Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has created a Zonal Coordinator account for you.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function newMentorEmailTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Welcome to ${APP_NAME} - Mentor Account Created`;

  const text = `Hello ${name},

An administrator or Zonal Coordinator has created a Mentor account for you on ${APP_NAME}.

Your login credentials are:
Email: ${email}
Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An account has been created for you to serve as a Mentor.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function newDeskOfficerEmailTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Welcome to ${APP_NAME} - Desk Officer Account Created`;

  const text = `Hello ${name},

An administrator has created a Zonal Desk Officer account for you on ${APP_NAME}.

Your login credentials are:
Email: ${email}
Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has created a Zonal Desk Officer account for you.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function newMEOfficerEmailTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Welcome to ${APP_NAME} - M&E Officer Account Created`;

  const text = `Hello ${name},

An administrator has created a Monitoring & Evaluation (M&E) Officer account for you on ${APP_NAME}.

Your login credentials are:
Email: ${email}
Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has created a Monitoring &amp; Evaluation (M&amp;E) Officer account for you.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function newTeamResearchLeadEmailTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Welcome to ${APP_NAME} - Team Research Lead Account Created`;

  const text = `Hello ${name},

An administrator has created a Team Research Lead account for you on ${APP_NAME}.

Your login credentials are:
Email: ${email}
Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has created a Team Research Lead account for you.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function coordinatorEmailChangedTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Your ${APP_NAME} login email was updated`;

  const text = `Hello ${name},

An administrator has updated your Coordinator account login email on ${APP_NAME}.

Your updated login credentials are:
Email: ${email}
Temporary Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has updated your Coordinator account login email.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function mentorEmailChangedTemplate(name: string, email: string, tempPassword: string, appUrl: string) {
  const subject = `Your ${APP_NAME} login email was updated`;

  const text = `Hello ${name},

An administrator has updated your Mentor account login email on ${APP_NAME}.

Your updated login credentials are:
Email: ${email}
Temporary Password: ${tempPassword}

Please log in at ${appUrl}/login and change your password immediately.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>An administrator has updated your Mentor account login email.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${email}</p>
        <p style="margin: 0;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p>Please log in and change your password immediately.</p>
      <p>
        <a href="${appUrl}/login"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Log In Now
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

export function passwordResetOtpTemplate(name: string, otp: string, expiryMinutes: number) {
  const subject = `Password reset code for ${APP_NAME}`;

  const text = `Hello ${name},

We received a request to reset the password for your ${APP_NAME} account.

Your one-time password (OTP) is: ${otp}

This code expires in ${expiryMinutes} minutes.

If you did not request this, you can safely ignore this email.

Thank you,
${APP_NAME}`;

  const html = `

    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Password reset code</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>We received a request to reset the password for your ${APP_NAME} account.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0; text-align: center;">
        <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px;">Your one-time password (OTP)</p>
        <p style="margin: 0; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1a7f37;">${otp}</p>
      </div>
      <p>This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/* ──────────────────────────────────────────
   Scheduling / Booking email templates
   ────────────────────────────────────────── */

/** Fellow invitation with a secure set-password link. */
export function fellowInviteTemplate(name: string, mentorName: string, token: string, appUrl: string) {
  const link = `${appUrl}/set-password?token=${encodeURIComponent(token)}`;
  const subject = `You've been invited to ${APP_NAME}`;

  const text = `Hello ${name},

Your mentor ${mentorName} has invited you to join ${APP_NAME} as a Fellow.

Set your password and activate your account here:
${link}

Once activated, you can log in to book mentorship sessions with your mentor.

This link will expire in 48 hours.

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Welcome to ${APP_NAME}</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your mentor <strong>${mentorName}</strong> has invited you to join ${APP_NAME} as a Fellow.</p>
      <p>Set your password to activate your account and start booking mentorship sessions.</p>
      <p>
        <a href="${link}"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Set Your Password
        </a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">This link will expire in 48 hours.</p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/** Notify a fellow that their mentor published new availability. */
export function slotsPublishedTemplate(fellowName: string, mentorName: string, appUrl: string) {
  const subject = `${mentorName} has new available session times`;

  const text = `Hello ${fellowName},

Your mentor ${mentorName} has opened new session time slots.

Book a session here: ${appUrl}/book

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">New Session Times Available</h2>
      <p>Hello <strong>${fellowName}</strong>,</p>
      <p>Your mentor <strong>${mentorName}</strong> has opened new session time slots. Book before they fill up.</p>
      <p>
        <a href="${appUrl}/book"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Book a Session
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/** Booking confirmation sent to the fellow. */
export function bookingConfirmedFellowTemplate(
  fellowName: string,
  mentorName: string,
  whenLabel: string,
  meetingLink: string | undefined,
  appUrl: string,
) {
  const subject = `Session confirmed with ${mentorName} — ${whenLabel}`;
  const linkLine = meetingLink ? `\nMeeting link: ${meetingLink}` : "";

  const text = `Hello ${fellowName},

Your session with ${mentorName} is confirmed for ${whenLabel}.${linkLine}

View your sessions: ${appUrl}/sessions

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Session Confirmed</h2>
      <p>Hello <strong>${fellowName}</strong>,</p>
      <p>Your session with <strong>${mentorName}</strong> is confirmed for <strong>${whenLabel}</strong>.</p>
      ${meetingLink ? `<p><strong>Meeting link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ""}
      <p>
        <a href="${appUrl}/sessions"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View My Sessions
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/** New-booking notification sent to the mentor. */
export function bookingConfirmedMentorTemplate(
  mentorName: string,
  fellowName: string,
  whenLabel: string,
  note: string | undefined,
  appUrl: string,
) {
  const subject = `New session booked by ${fellowName} — ${whenLabel}`;
  const noteLine = note ? `\nNote from fellow: ${note}` : "";

  const text = `Hello ${mentorName},

${fellowName} has booked a session with you for ${whenLabel}.${noteLine}

View your sessions: ${appUrl}/sessions

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">New Session Booked</h2>
      <p>Hello <strong>${mentorName}</strong>,</p>
      <p><strong>${fellowName}</strong> has booked a session with you for <strong>${whenLabel}</strong>.</p>
      ${note ? `<div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;"><p style="margin: 0;"><strong>Note:</strong> ${note}</p></div>` : ""}
      <p>
        <a href="${appUrl}/sessions"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View My Sessions
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/** Cancellation notice sent to the other party. */
export function bookingCancelledTemplate(
  recipientName: string,
  otherName: string,
  whenLabel: string,
  cancelledByLabel: string,
  appUrl: string,
) {
  const subject = `Session cancelled — ${whenLabel}`;

  const text = `Hello ${recipientName},

Your session with ${otherName} scheduled for ${whenLabel} has been cancelled by ${cancelledByLabel}.

View your sessions: ${appUrl}/sessions

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #b91c1c;">Session Cancelled</h2>
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>Your session with <strong>${otherName}</strong> scheduled for <strong>${whenLabel}</strong> has been cancelled by ${cancelledByLabel}.</p>
      <p>
        <a href="${appUrl}/sessions"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View My Sessions
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}

/** Upcoming session reminder sent to either party. */
export function sessionReminderTemplate(
  recipientName: string,
  otherName: string,
  whenLabel: string,
  meetingLink: string | undefined,
  appUrl: string,
) {
  const subject = `Reminder: session with ${otherName} — ${whenLabel}`;
  const linkLine = meetingLink ? `\nMeeting link: ${meetingLink}` : "";

  const text = `Hello ${recipientName},

This is a reminder of your upcoming session with ${otherName} on ${whenLabel}.${linkLine}

View your sessions: ${appUrl}/sessions

Thank you,
${APP_NAME}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
      <h2 style="color: #1a7f37;">Upcoming Session Reminder</h2>
      <p>Hello <strong>${recipientName}</strong>,</p>
      <p>This is a reminder of your upcoming session with <strong>${otherName}</strong> on <strong>${whenLabel}</strong>.</p>
      ${meetingLink ? `<p><strong>Meeting link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>` : ""}
      <p>
        <a href="${appUrl}/sessions"
           style="display: inline-block; padding: 12px 24px; background: #1a7f37;
                  color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
          View My Sessions
        </a>
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 12px;">${APP_NAME}</p>
    </div>`;

  return { subject, text, html };
}