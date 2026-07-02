/**
 * @openapi
 * /api/notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications
 *     description: >
 *       Returns the authenticated user's in-portal notifications, most recent
 *       first, with an unread count. Available to any authenticated user.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: unread
 *         description: When "true", only unread notifications are returned.
 *         schema: { type: string, enum: ["true", "false"] }
 *     responses:
 *       200:
 *         description: Paginated notifications with unread count.
 *         content:
 *           application/json:
 *             example:
 *               data: [{ _id: "n1", type: "slots_published", title: "New session times available", body: "…", link: "/book", read: false }]
 *               unreadCount: 3
 *               pagination: { page: 1, limit: 20, total: 5, totalPages: 1 }
 *       401: { description: Not authenticated }
 */
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, parsePagination, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Notification } from "@/models";

export const GET = withExceptionLog("GET /api/notifications", async (request: NextRequest) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    await connectDB();
    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const onlyUnread = url.searchParams.get("unread") === "true";

    const filter: Record<string, unknown> = { recipient: session!.user.id };
    if (onlyUnread) filter.read = false;

    const [data, total, unreadCount] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Notification.countDocuments(filter),
        Notification.countDocuments({ recipient: session!.user.id, read: false }),
    ]);

    return jsonOk({
        data,
        unreadCount,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
});
