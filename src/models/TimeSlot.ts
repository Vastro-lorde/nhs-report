/* ──────────────────────────────────────────
   Model: TimeSlot
   A concrete, bookable 40-min session slot for a mentor.
   Produced either by materializing a recurring
   MentorAvailabilityTemplate or created manually (one-off).
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { TimeSlotStatus, TimeSlotSource } from "@/lib/constants";

export interface ITimeSlot extends Document {
    mentor: Types.ObjectId;
    startAt: Date;
    endAt: Date;
    status: TimeSlotStatus;
    source: TimeSlotSource;
    /** Optional per-slot meeting link; falls back to the mentor's default. */
    meetingLinkOverride?: string;
    /** The recurring template this slot was materialized from, if any. */
    template?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const TimeSlotSchema = new Schema<ITimeSlot>(
    {
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        status: {
            type: String,
            enum: Object.values(TimeSlotStatus),
            default: TimeSlotStatus.OPEN,
            index: true,
        },
        source: {
            type: String,
            enum: Object.values(TimeSlotSource),
            default: TimeSlotSource.MANUAL,
        },
        meetingLinkOverride: { type: String, trim: true },
        template: { type: Schema.Types.ObjectId, ref: "MentorAvailabilityTemplate" },
    },
    { timestamps: true }
);

// One slot per mentor per start time — prevents duplicate/overlapping materialization.
TimeSlotSchema.index({ mentor: 1, startAt: 1 }, { unique: true });

export const TimeSlot: Model<ITimeSlot> =
    models.TimeSlot || mongoose.model<ITimeSlot>("TimeSlot", TimeSlotSchema);
