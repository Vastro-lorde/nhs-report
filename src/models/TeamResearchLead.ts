/* ──────────────────────────────────────────
   Model: TeamResearchLead (Team Research Lead)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface ITeamResearchLead extends Document {
    authId: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const TeamResearchLeadSchema = new Schema<ITeamResearchLead>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    },
    { timestamps: true }
);

export const TeamResearchLead: Model<ITeamResearchLead> =
    models.TeamResearchLead || mongoose.model<ITeamResearchLead>("TeamResearchLead", TeamResearchLeadSchema);
