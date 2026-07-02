/* ──────────────────────────────────────────
   Notification helper
   Creates in-portal notifications and, optionally,
   fans out matching emails. Email failures never
   block notification creation.
   ────────────────────────────────────────── */
import { Types } from "mongoose";
import { Notification } from "@/models";
import type { NotificationType } from "@/lib/constants";
import { sendMailWithRetry } from "@/lib/mailer";

export interface NotificationEmail {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

export interface CreateNotificationInput {
    recipient: string | Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    relatedId?: string | Types.ObjectId;
    /** When provided, an email is sent after the notification is stored. */
    email?: NotificationEmail;
}

/**
 * Create a single in-portal notification and optionally send an email.
 * Returns the created notification id. Email errors are swallowed and logged.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
    await Notification.create({
        recipient: input.recipient,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        relatedId: input.relatedId,
    });

    if (input.email) {
        try {
            await sendMailWithRetry(input.email);
        } catch (err) {
            console.error("[notify] Failed to send notification email:", err);
        }
    }
}

/**
 * Bulk-create notifications with paced email delivery to avoid SMTP throttling.
 * Notifications are inserted in one batch; emails are sent sequentially with a
 * small delay between them.
 */
export async function createNotifications(
    inputs: CreateNotificationInput[],
    interEmailDelayMs = 1000,
): Promise<void> {
    if (inputs.length === 0) return;

    await Notification.insertMany(
        inputs.map((n) => ({
            recipient: n.recipient,
            type: n.type,
            title: n.title,
            body: n.body,
            link: n.link,
            relatedId: n.relatedId,
        })),
    );

    const emails = inputs.filter((n) => n.email).map((n) => n.email!);
    for (let i = 0; i < emails.length; i++) {
        try {
            await sendMailWithRetry(emails[i]);
        } catch (err) {
            console.error("[notify] Failed to send bulk notification email:", err);
        }
        if (i < emails.length - 1) {
            await new Promise((res) => setTimeout(res, interEmailDelayMs));
        }
    }
}
