/**
 * @openapi
 * /api/mentors/me/availability:
 *   get:
 *     tags: [Mentors, Scheduling]
 *     summary: Get the current mentor's availability
 *     description: >
 *       Returns the mentor's recurring availability templates plus their upcoming
 *       concrete time slots (open, booked and cancelled). Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Templates and upcoming slots.
 *         content:
 *           application/json:
 *             example:
 *               templates: [{ _id: "1", dayOfWeek: 1, startTime: "10:00", endTime: "12:00", active: true }]
 *               slots: [{ _id: "s1", startAt: "2026-07-06T09:00:00.000Z", endAt: "2026-07-06T09:40:00.000Z", status: "open" }]
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 *   put:
 *     tags: [Mentors, Scheduling]
 *     summary: Replace recurring availability templates
 *     description: >
 *       Replaces the mentor's recurring weekly availability and re-materializes
 *       concrete 40-minute slots across the rolling window. Existing booked slots
 *       are preserved. Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templates]
 *             properties:
 *               templates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [dayOfWeek, startTime, endTime]
 *                   properties:
 *                     dayOfWeek: { type: integer, minimum: 0, maximum: 6 }
 *                     startTime: { type: string, example: "10:00" }
 *                     endTime: { type: string, example: "12:00" }
 *                     active: { type: boolean }
 *           example:
 *             templates:
 *               - { dayOfWeek: 1, startTime: "10:00", endTime: "12:00", active: true }
 *               - { dayOfWeek: 3, startTime: "14:00", endTime: "15:20", active: true }
 *     responses:
 *       200: { description: Templates saved and slots materialized }
 *       400: { description: Validation error }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 *   post:
 *     tags: [Mentors, Scheduling]
 *     summary: Create a one-off time slot
 *     description: >
 *       Creates a single 40-minute open slot at a specific start time, with an
 *       optional per-slot meeting link override. Mentor role only.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startAt]
 *             properties:
 *               startAt: { type: string, format: date-time }
 *               meetingLinkOverride: { type: string }
 *           example: { startAt: "2026-07-06T09:00:00.000Z", meetingLinkOverride: "https://meet.example.com/one-off" }
 *     responses:
 *       201: { description: Slot created }
 *       400: { description: Invalid start time / in the past }
 *       401: { description: Not authenticated }
 *       403: { description: Not a mentor }
 *       404: { description: Mentor profile not found }
 *       409: { description: A slot already exists at that start time }
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, jsonCreated, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor, MentorAvailabilityTemplate, TimeSlot } from "@/models";
import {
    UserRole,
    SESSION_DURATION_MINUTES,
    TimeSlotSource,
    TimeSlotStatus,
} from "@/lib/constants";
import { timeToMinutes } from "@/lib/schedule-helpers";
import { materializeMentorSlots } from "@/services/slot.service";
import { logActivity } from "@/lib/activity-logger";

interface TemplateInput {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    active?: boolean;
}

async function getMentorId(authId: string): Promise<string | null> {
    const mentor = await Mentor.findOne({ authId }).select("_id").lean();
    return mentor ? String(mentor._id) : null;
}

export const GET = withExceptionLog("GET /api/mentors/me/availability", async () => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    await connectDB();
    const mentorId = await getMentorId(session!.user.id);
    if (!mentorId) return jsonError("Mentor profile not found", 404);

    const [templates, slots] = await Promise.all([
        MentorAvailabilityTemplate.find({ mentor: mentorId }).sort({ dayOfWeek: 1, startTime: 1 }).lean(),
        TimeSlot.find({ mentor: mentorId, endAt: { $gte: new Date() } })
            .sort({ startAt: 1 })
            .lean(),
    ]);

    return jsonOk({ templates, slots });
});

export const PUT = withExceptionLog("PUT /api/mentors/me/availability", async (request: NextRequest) => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    const body = await parseBody<{ templates?: TemplateInput[] }>(request);
    if (!body || !Array.isArray(body.templates)) {
        return jsonError("templates array is required", 400);
    }

    // Validate every template up-front.
    for (const t of body.templates) {
        if (typeof t.dayOfWeek !== "number" || t.dayOfWeek < 0 || t.dayOfWeek > 6) {
            return jsonError("Each template needs a dayOfWeek between 0 and 6", 400);
        }
        const start = timeToMinutes(t.startTime ?? "");
        const end = timeToMinutes(t.endTime ?? "");
        if (start === null || end === null) {
            return jsonError("startTime and endTime must be valid HH:MM values", 400);
        }
        if (end - start < SESSION_DURATION_MINUTES) {
            return jsonError(
                `Each availability window must be at least ${SESSION_DURATION_MINUTES} minutes long`,
                400,
            );
        }
    }

    await connectDB();
    const mentorId = await getMentorId(session!.user.id);
    if (!mentorId) return jsonError("Mentor profile not found", 404);

    // Replace all templates.
    await MentorAvailabilityTemplate.deleteMany({ mentor: mentorId });
    if (body.templates.length > 0) {
        await MentorAvailabilityTemplate.insertMany(
            body.templates.map((t) => ({
                mentor: mentorId,
                dayOfWeek: t.dayOfWeek,
                startTime: t.startTime.trim(),
                endTime: t.endTime.trim(),
                active: t.active !== false,
            })),
        );
    }

    const created = await materializeMentorSlots(mentorId);

    void logActivity({
        session,
        action: "UPDATE_AVAILABILITY",
        targetType: "Mentor",
        targetId: mentorId,
    });

    return jsonOk({ success: true, templates: body.templates.length, slotsCreated: created });
});

export const POST = withExceptionLog("POST /api/mentors/me/availability", async (request: NextRequest) => {
    const { session, error } = await requireRole(UserRole.MENTOR);
    if (error) return error;

    const body = await parseBody<{ startAt?: string; meetingLinkOverride?: string }>(request);
    if (!body?.startAt) return jsonError("startAt is required", 400);

    const startAt = new Date(body.startAt);
    if (Number.isNaN(startAt.getTime())) return jsonError("startAt is not a valid date", 400);
    if (startAt.getTime() <= Date.now()) return jsonError("startAt must be in the future", 400);

    await connectDB();
    const mentorId = await getMentorId(session!.user.id);
    if (!mentorId) return jsonError("Mentor profile not found", 404);

    const endAt = new Date(startAt.getTime() + SESSION_DURATION_MINUTES * 60_000);

    try {
        const slot = await TimeSlot.create({
            mentor: mentorId,
            startAt,
            endAt,
            status: TimeSlotStatus.OPEN,
            source: TimeSlotSource.MANUAL,
            meetingLinkOverride: body.meetingLinkOverride?.trim() || undefined,
        });
        return jsonCreated(slot);
    } catch (err: unknown) {
        if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
            return jsonError("A slot already exists at that start time", 409);
        }
        throw err;
    }
});
