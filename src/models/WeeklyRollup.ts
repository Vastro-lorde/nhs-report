/* ──────────────────────────────────────────
   Model: WeeklyRollup  (aggregated weekly data)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, models, Types } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IChallengeFrequency {
  name: string;
  count: number;
}

export interface IStateFrequency {
  name: string;
  count: number;
}

export interface IWeeklyRollup extends Document {
  weekKey: string;
  reportsSubmitted: number;
  expectedReports: number;
  submissionRate: number;
  totalSessions: number;
  totalCheckins: number;
  urgentAlertsCount: number;
  topChallenges: IChallengeFrequency[];
  topStates: IStateFrequency[];
  generatedAt: Date;
  /** Cohort this record belongs to (stamped by the cohort plugin). */
  cohort?: Types.ObjectId;
}

const FrequencySchema = new Schema(
  { name: { type: String }, count: { type: Number, default: 0 } },
  { _id: false }
);

const WeeklyRollupSchema = new Schema<IWeeklyRollup>(
  {
    weekKey: { type: String, required: true, index: true },
    reportsSubmitted: { type: Number, default: 0 },
    expectedReports: { type: Number, default: 0 },
    submissionRate: { type: Number, default: 0 },
    totalSessions: { type: Number, default: 0 },
    totalCheckins: { type: Number, default: 0 },
    urgentAlertsCount: { type: Number, default: 0 },
    topChallenges: { type: [FrequencySchema], default: [] },
    topStates: { type: [FrequencySchema], default: [] },
    generatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One rollup per week per cohort (legacy global weekKey_1 is dropped on bootstrap).
WeeklyRollupSchema.index({ cohort: 1, weekKey: 1 }, { unique: true });

WeeklyRollupSchema.plugin(cohortScopePlugin, { modelName: "WeeklyRollup" });

export const WeeklyRollup: Model<IWeeklyRollup> =
  models.WeeklyRollup ||
  mongoose.model<IWeeklyRollup>("WeeklyRollup", WeeklyRollupSchema);
