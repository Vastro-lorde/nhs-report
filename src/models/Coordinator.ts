/* ──────────────────────────────────────────
   Model: Coordinator
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface ICoordinator extends Document {
    authId: Types.ObjectId;
    states: string[];
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

export const Coordinator: Model<ICoordinator> =
    models.Coordinator || mongoose.model<ICoordinator>("Coordinator", CoordinatorSchema);
