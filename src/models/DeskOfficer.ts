/* ──────────────────────────────────────────
   Model: DeskOfficer
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IDeskOfficer extends Document {
    authId: Types.ObjectId;
    states: string[];
    createdAt: Date;
    updatedAt: Date;
}

const DeskOfficerSchema = new Schema<IDeskOfficer>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        states: {
            type: [String],
            uppercase: true,
            default: []
        },
    },
    { timestamps: true }
);

export const DeskOfficer: Model<IDeskOfficer> =
    models.DeskOfficer || mongoose.model<IDeskOfficer>("DeskOfficer", DeskOfficerSchema);
