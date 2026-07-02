/**
 * @openapi
 * /api/notifications/{id}:
 *   patch:
 *     tags: [Notifications]
 *     summary: Mark a notification as read
 *     description: Marks one of the current user's notifications as read. Users can only update their own notifications.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Notification updated }
 *       401: { description: Not authenticated }
 *       404: { description: Notification not found }
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withExceptionLog(
    "PATCH /api/notifications/[id]",
    async (_request: NextRequest, { params }: Params) => {
        const { session, error } = await requireAuth();
        if (error) return error;

        const { id } = await params;
        await connectDB();

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: session!.user.id },
            { $set: { read: true } },
            { new: true },
        ).lean();

        if (!notification) return jsonError("Notification not found", 404);
        return jsonOk(notification);
    },
);
