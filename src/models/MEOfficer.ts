/* ──────────────────────────────────────────
   Model: MEOfficer (Monitoring & Evaluation Officer)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMEOfficer extends Document {
    authId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const MEOfficerSchema = new Schema<IMEOfficer>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    },
    { timestamps: true }
);

export const MEOfficer: Model<IMEOfficer> =
    models.MEOfficer || mongoose.model<IMEOfficer>("MEOfficer", MEOfficerSchema);
