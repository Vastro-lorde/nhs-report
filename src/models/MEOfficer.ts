/* ──────────────────────────────────────────
   Model: MEOfficer (Monitoring & Evaluation Officer)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IMEOfficer extends Document {
    authId: Types.ObjectId;
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const MEOfficerSchema = new Schema<IMEOfficer>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    },
    { timestamps: true }
);

MEOfficerSchema.plugin(cohortScopePlugin, { modelName: "MEOfficer" });

export const MEOfficer: Model<IMEOfficer> =
    models.MEOfficer || mongoose.model<IMEOfficer>("MEOfficer", MEOfficerSchema);
