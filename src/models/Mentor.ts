/* ──────────────────────────────────────────
   Model: Mentor
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMentor extends Document {
    authId: Types.ObjectId;
    coordinator: Types.ObjectId;
    states: string[];
    lgas: string[];
    meetingLink?: string;
    google?: {
        email?: string;
        refreshToken?: string;
        spaceName?: string;
        meetingCode?: string;
        meetingUri?: string;
        connectedAt?: Date;
    };
    createdAt: Date;
    updatedAt: Date;
}

const MentorSchema = new Schema<IMentor>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        coordinator: { type: Schema.Types.ObjectId, ref: "Coordinator", required: true, index: true },
        states: {
            type: [String],
            required: true,
            uppercase: true,
            default: []
        },
        lgas: {
            type: [String],
            uppercase: true,
            default: []
        },
        meetingLink: { type: String, trim: true },
        google: {
            email: { type: String, trim: true, lowercase: true },
            // Sensitive: never returned by default queries.
            refreshToken: { type: String, select: false },
            spaceName: { type: String, trim: true },
            meetingCode: { type: String, trim: true },
            meetingUri: { type: String, trim: true },
            connectedAt: { type: Date },
        },
    },
    { timestamps: true }
);

export const Mentor: Model<IMentor> =
    models.Mentor || mongoose.model<IMentor>("Mentor", MentorSchema);
