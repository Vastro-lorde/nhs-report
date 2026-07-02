/**
 * @openapi
 * /api/mentors/me/availability/{slotId}:
 *   delete:
 *     tags: [Mentors, Scheduling]
 *     summary: Remove an open time slot
 *     description: >
 *       Deletes one of the mentor's own OPEN slots. Booked slots cannot be
 *       deleted here — the associated booking must be cancelled first. Mentor
 *       role only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Slot removed }
 *       401: { description: Not authenticated }
 *       403: { description: Not the owning mentor }
 *       404: { description: Slot not found }
 *       409: { description: Slot is booked and cannot be deleted }
 */
import { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Mentor, TimeSlot } from "@/models";
import { UserRole, TimeSlotStatus } from "@/lib/constants";

type Params = { params: Promise<{ slotId: string }> };

export const DELETE = withExceptionLog(
    "DELETE /api/mentors/me/availability/[slotId]",
    async (_request: NextRequest, { params }: Params) => {
        const { session, error } = await requireRole(UserRole.MENTOR);
        if (error) return error;

        const { slotId } = await params;
        await connectDB();

        const mentor = await Mentor.findOne({ authId: session!.user.id }).select("_id").lean();
        if (!mentor) return jsonError("Mentor profile not found", 404);

        const slot = await TimeSlot.findOne({ _id: slotId, mentor: mentor._id });
        if (!slot) return jsonError("Slot not found", 404);
        if (slot.status === TimeSlotStatus.BOOKED) {
            return jsonError("This slot is booked. Cancel the booking before removing it.", 409);
        }

        await slot.deleteOne();
        return jsonOk({ success: true });
    },
);
