import mongoose, { Schema, Document, Types } from "mongoose";
import { ReportHistoryReportType, ReportHistoryAction } from "@/lib/constants";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IReportHistory extends Document {
  reportId: Types.ObjectId;
  reportType: ReportHistoryReportType;
  action: ReportHistoryAction;
  snapshot: string | null;
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  meta?: Record<string, unknown>;
  /** Cohort this record belongs to (stamped by the cohort plugin). */
  cohort?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ReportHistorySchema = new Schema<IReportHistory>(
  {
    reportId: { type: Schema.Types.ObjectId, required: true, index: true },
    reportType: { type: String, enum: Object.values(ReportHistoryReportType), required: true },
    action: { type: String, enum: Object.values(ReportHistoryAction), required: true },
    snapshot: { type: String, default: null },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

ReportHistorySchema.index({ reportId: 1, createdAt: -1 });

ReportHistorySchema.plugin(cohortScopePlugin, { modelName: "ReportHistory" });

export const ReportHistory =
  mongoose.models.ReportHistory || mongoose.model<IReportHistory>("ReportHistory", ReportHistorySchema);
