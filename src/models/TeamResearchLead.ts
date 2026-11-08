/* ──────────────────────────────────────────
   Model: TeamResearchLead (Team Research Lead)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface ITeamResearchLead extends Document {
    authId: Types.ObjectId;
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const TeamResearchLeadSchema = new Schema<ITeamResearchLead>(
    {
        authId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    },
    { timestamps: true }
);

TeamResearchLeadSchema.plugin(cohortScopePlugin, { modelName: "TeamResearchLead" });

export const TeamResearchLead: Model<ITeamResearchLead> =
    models.TeamResearchLead || mongoose.model<ITeamResearchLead>("TeamResearchLead", TeamResearchLeadSchema);
