/**
 * @openapi
 * /api/mentors/me:
 *   get:
 *     tags: [Mentors]
 *     summary: Get the current mentor's scheduling profile
 *     description: Returns the authenticated mentor's record including the default meeting link. Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Mentor profile.
 *         content:
 *           application/json:
 *             example: { _id: "665f…", meetingLink: "https://meet.example.com/ada", states: ["LAGOS"] }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 *   patch:
 *     tags: [Mentors]
 *     summary: Update the current mentor's default meeting link
 *     description: Updates the meeting link prefilled on the mentor's time-slot cards. Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meetingLink: { type: string, maxLength: 2048 }
 *           example: { meetingLink: "https://meet.example.com/ada" }
 *     responses:
 *       200: { description: Updated mentor record }
 *       400: { description: Invalid body }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor } from "@/models";
import { UserRole } from "@/lib/constants";

export const GET = withExceptionLog("GET /api/mentors/me", async () => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    await connectDB();
    const mentor = await Mentor.findOne({ authId: session!.user.id }).lean();
    if (!mentor) return jsonError("Mentor profile not found", 404);
    return jsonOk(mentor);
});

export const PATCH = withExceptionLog("PATCH /api/mentors/me", async (request: NextRequest) => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    const body = await parseBody<{ meetingLink?: string }>(request);
    if (!body) return jsonError("Invalid JSON", 400);

    await connectDB();
    const updates: Record<string, unknown> = {};
    if (body.meetingLink !== undefined) {
        updates.meetingLink = body.meetingLink.trim();
    }

    const mentor = await Mentor.findOneAndUpdate(
        { authId: session!.user.id },
        { $set: updates },
        { new: true, runValidators: true },
    ).lean();

    if (!mentor) return jsonError("Mentor profile not found", 404);
    return jsonOk(mentor);
});
