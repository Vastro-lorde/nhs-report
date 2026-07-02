/**
 * @openapi
 * /api/notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all notifications as read
 *     description: Marks every unread notification belonging to the current user as read.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Count of notifications updated.
 *         content:
 *           application/json:
 *             example: { success: true, updated: 4 }
 *       401: { description: Not authenticated }
 */
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

export const POST = withExceptionLog("POST /api/notifications/read-all", async () => {
    const { session, error } = await requireAuth();
    if (error) return error;

    await connectDB();
    const result = await Notification.updateMany(
        { recipient: session!.user.id, read: false },
        { $set: { read: true } },
    );

    return jsonOk({ success: true, updated: result.modifiedCount ?? 0 });
});
