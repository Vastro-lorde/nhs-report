/* ──────────────────────────────────────────
   Model: WeeklyRollup  (aggregated weekly data)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, models } from "mongoose";

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
}

const FrequencySchema = new Schema(
  { name: { type: String }, count: { type: Number, default: 0 } },
  { _id: false }
);

const WeeklyRollupSchema = new Schema<IWeeklyRollup>(
  {
    weekKey: { type: String, required: true, unique: true },
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

export const WeeklyRollup: Model<IWeeklyRollup> =
  models.WeeklyRollup ||
  mongoose.model<IWeeklyRollup>("WeeklyRollup", WeeklyRollupSchema);
