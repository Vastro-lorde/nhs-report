/* ──────────────────────────────────────────
   Model: DeskOfficer
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IDeskOfficer extends Document {
    authId: Types.ObjectId;
    states: string[];
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
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

DeskOfficerSchema.plugin(cohortScopePlugin, { modelName: "DeskOfficer" });

export const DeskOfficer: Model<IDeskOfficer> =
    models.DeskOfficer || mongoose.model<IDeskOfficer>("DeskOfficer", DeskOfficerSchema);
