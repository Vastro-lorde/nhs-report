/* ──────────────────────────────────────────
   Model: Mentor
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMentor extends Document {
    authId: Types.ObjectId;
    coordinator: Types.ObjectId;
    state: string;
    lgas: string[];
    createdAt: Date;
    updatedAt: Date;
}

const MentorSchema = new Schema<IMentor>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        coordinator: { type: Schema.Types.ObjectId, ref: "Coordinator", required: true, index: true },
        state: { type: String, required: true, uppercase: true },
        lgas: {
            type: [String],
            uppercase: true,
            default: []
        },
    },
    { timestamps: true }
);

export const Mentor: Model<IMentor> =
    models.Mentor || mongoose.model<IMentor>("Mentor", MentorSchema);
