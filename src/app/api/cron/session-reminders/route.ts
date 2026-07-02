/* ──────────────────────────────────────────
   Cron: /api/cron/session-reminders
   Sends a reminder ~24h before each confirmed session,
   to both the fellow and the mentor. Runs hourly.
   Protected by CRON_SECRET bearer token.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { validateCronSecret } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Booking, Fellow, Mentor, User } from "@/models";
import { BookingStatus, NotificationType } from "@/lib/constants";
import { createNotification } from "@/lib/notify";
import { formatSlotLabel } from "@/lib/schedule-helpers";
import { sessionReminderTemplate } from "@/lib/email-templates";
import { env } from "@/lib/env";

const REMINDER_LEAD_MS = 24 * 60 * 60 * 1000; // 24 hours ahead
const WINDOW_MS = 60 * 60 * 1000; // 1-hour cron cadence

async function handle(request: NextRequest) {
    if (!validateCronSecret(request)) return jsonError("Unauthorized", 401);

    await connectDB();
    const now = Date.now();
    const windowStart = new Date(now + REMINDER_LEAD_MS);
    const windowEnd = new Date(now + REMINDER_LEAD_MS + WINDOW_MS);

    const bookings = await Booking.find({
        status: BookingStatus.CONFIRMED,
        reminderSentAt: { $exists: false },
        startAt: { $gte: windowStart, $lt: windowEnd },
    }).lean();

    const appUrl = env.NEXTAUTH_URL();
    let sent = 0;

    for (const booking of bookings) {
        const [fellow, mentor] = await Promise.all([
            Fellow.findById(booking.fellow).select("name email authId").lean(),
            Mentor.findById(booking.mentor).select("authId").lean(),
        ]);
        const mentorUser = mentor ? await User.findById(mentor.authId).select("name email").lean() : null;
        const whenLabel = formatSlotLabel(new Date(booking.startAt), new Date(booking.endAt));
        const mentorName = mentorUser?.name ?? "your mentor";

        if (fellow?.authId) {
            await createNotification({
                recipient: fellow.authId,
                type: NotificationType.SESSION_REMINDER,
                title: "Upcoming session reminder",
                body: `Your session with ${mentorName} is on ${whenLabel}.`,
                link: "/sessions",
                relatedId: booking._id,
                email: fellow.email
                    ? { to: fellow.email, ...sessionReminderTemplate(fellow.name, mentorName, whenLabel, booking.meetingLink, appUrl) }
                    : undefined,
            });
        }

        if (mentorUser) {
            await createNotification({
                recipient: mentor!.authId,
                type: NotificationType.SESSION_REMINDER,
                title: "Upcoming session reminder",
                body: `Your session with ${fellow?.name ?? "a fellow"} is on ${whenLabel}.`,
                link: "/sessions",
                relatedId: booking._id,
                email: mentorUser.email
                    ? { to: mentorUser.email, ...sessionReminderTemplate(mentorUser.name, fellow?.name ?? "a fellow", whenLabel, booking.meetingLink, appUrl) }
                    : undefined,
            });
        }

        await Booking.updateOne({ _id: booking._id }, { $set: { reminderSentAt: new Date() } });
        sent++;
    }

    return jsonOk({ message: "Session reminders processed", reminded: sent });
}

export async function GET(request: NextRequest) {
    return handle(request);
}

export async function POST(request: NextRequest) {
    return handle(request);
}
