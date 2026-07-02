/* ──────────────────────────────────────────
   Model: Booking
   A fellow's booking of a mentor's TimeSlot.
   Bookings are auto-confirmed on creation.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { BookingStatus } from "@/lib/constants";

export interface IBooking extends Document {
    timeSlot: Types.ObjectId;
    fellow: Types.ObjectId;
    mentor: Types.ObjectId;
    /** Optional note from the fellow to the mentor. */
    note?: string;
    status: BookingStatus;
    /** Snapshot of the meeting link at booking time. */
    meetingLink?: string;
    startAt: Date;
    endAt: Date;
    cancelledBy?: Types.ObjectId;
    cancelledAt?: Date;
    reminderSentAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
    {
        timeSlot: { type: Schema.Types.ObjectId, ref: "TimeSlot", required: true },
        fellow: { type: Schema.Types.ObjectId, ref: "Fellow", required: true, index: true },
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        note: { type: String, trim: true },
        status: {
            type: String,
            enum: Object.values(BookingStatus),
            default: BookingStatus.CONFIRMED,
            index: true,
        },
        meetingLink: { type: String, trim: true },
        startAt: { type: Date, required: true },
        endAt: { type: Date, required: true },
        cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
        cancelledAt: { type: Date },
        reminderSentAt: { type: Date },
    },
    { timestamps: true }
);

// A time slot can only have one active (non-cancelled) booking. Because a
// cancelled slot is re-opened for a new booking, uniqueness is scoped to
// active bookings via a partial index.
BookingSchema.index(
    { timeSlot: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $ne: BookingStatus.CANCELLED } },
    },
);

export const Booking: Model<IBooking> =
    models.Booking || mongoose.model<IBooking>("Booking", BookingSchema);
