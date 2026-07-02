/* ──────────────────────────────────────────
   Model: MentorAvailabilityTemplate
   A recurring weekly availability rule for a mentor.
   Each rule is expanded into concrete 40-min TimeSlot
   documents by the slot materializer service.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMentorAvailabilityTemplate extends Document {
    mentor: Types.ObjectId;
    /** 0 = Sunday … 6 = Saturday */
    dayOfWeek: number;
    /** Local "HH:MM" start of the availability window. */
    startTime: string;
    /** Local "HH:MM" end of the availability window. */
    endTime: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const MentorAvailabilityTemplateSchema = new Schema<IMentorAvailabilityTemplate>(
    {
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
        startTime: { type: String, required: true, trim: true },
        endTime: { type: String, required: true, trim: true },
        active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const MentorAvailabilityTemplate: Model<IMentorAvailabilityTemplate> =
    models.MentorAvailabilityTemplate ||
    mongoose.model<IMentorAvailabilityTemplate>(
        "MentorAvailabilityTemplate",
        MentorAvailabilityTemplateSchema,
    );
