/* ──────────────────────────────────────────
   Model: Coordinator
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface ICoordinator extends Document {
    authId: Types.ObjectId;
    states: string[];
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const CoordinatorSchema = new Schema<ICoordinator>(
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

CoordinatorSchema.plugin(cohortScopePlugin, { modelName: "Coordinator" });

export const Coordinator: Model<ICoordinator> =
    models.Coordinator || mongoose.model<ICoordinator>("Coordinator", CoordinatorSchema);
