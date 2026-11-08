/* ──────────────────────────────────────────
   Model: Fellow
   Represents a mentee assigned to a mentor.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { FellowInviteStatus } from "@/lib/constants";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IFellow extends Document {
    mentor: Types.ObjectId;
    name: string;
    gender: string;
    lga: string;
    qualification?: string;
    email?: string;
    authId?: Types.ObjectId;
    inviteStatus: FellowInviteStatus;
    invitedAt?: Date;
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FellowSchema = new Schema<IFellow>(
    {
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        name: { type: String, required: true, trim: true },
        gender: { type: String, required: true, trim: true },
        lga: { type: String, required: true, trim: true, uppercase: true },
        qualification: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        authId: { type: Schema.Types.ObjectId, ref: "User", index: true },
        inviteStatus: {
            type: String,
            enum: Object.values(FellowInviteStatus),
            default: FellowInviteStatus.NONE,
        },
        invitedAt: { type: Date },
    },
    { timestamps: true }
);

// Email is unique within a cohort, and only among fellows that actually have
// one. A fellow carried into the next cohort keeps their email, so this must
// be cohort-scoped (the legacy global `email_1` index is dropped on bootstrap).
FellowSchema.index(
    { cohort: 1, email: 1 },
    { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

FellowSchema.plugin(cohortScopePlugin, { modelName: "Fellow" });

export const Fellow: Model<IFellow> =
    models.Fellow || mongoose.model<IFellow>("Fellow", FellowSchema);
