/* ──────────────────────────────────────────
   Model: AppSettings  (singleton)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, models } from "mongoose";
import { REPORT_SEASONS, DEFAULT_REPORT_SEASON, type ReportSeason } from "@/lib/report-season";

export interface IEditLockConfig {
  mentor: boolean;
  coordinator: boolean;
}

export interface IAppSettings extends Document {
  blockWeeklyReportEdits: IEditLockConfig;
  blockMonthlyReportEdits: IEditLockConfig;
  blockZonalAuditEdits: boolean;
  /** Season stamped onto newly created weekly / fellow monthly reports. */
  reportSeason: ReportSeason;
  updatedAt: Date;
  createdAt: Date;
}

const EditLockConfigSchema = new Schema<IEditLockConfig>(
  {
    mentor: { type: Boolean, default: false },
    coordinator: { type: Boolean, default: false },
  },
  { _id: false },
);

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    blockWeeklyReportEdits: { type: EditLockConfigSchema, default: () => ({ mentor: false, coordinator: false }) },
    blockMonthlyReportEdits: { type: EditLockConfigSchema, default: () => ({ mentor: false, coordinator: false }) },
    blockZonalAuditEdits: { type: Boolean, default: false },
    reportSeason: { type: String, enum: [...REPORT_SEASONS], default: DEFAULT_REPORT_SEASON },
  },
  { timestamps: true },
);

export const AppSettings: Model<IAppSettings> =
  (models.AppSettings as Model<IAppSettings>) ||
  mongoose.model<IAppSettings>("AppSettings", AppSettingsSchema);
