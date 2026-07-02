/* ──────────────────────────────────────────
   Model: Fellow
   Represents a mentee assigned to a mentor.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { FellowInviteStatus } from "@/lib/constants";

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

// Email is unique only among fellows that actually have one (sparse).
FellowSchema.index({ email: 1 }, { unique: true, sparse: true });

export const Fellow: Model<IFellow> =
    models.Fellow || mongoose.model<IFellow>("Fellow", FellowSchema);
