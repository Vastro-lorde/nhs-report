/* ──────────────────────────────────────────
   Model: SavedNationalAuditPeriod
   Saved national federal oversight audit for
   a multi-month range generated from zonal audits.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import type {
  INationalAuditPeriodReport,
  IPeriodicCoverage,
  NationalAuditPeriodType,
} from "@/types/national-audit";

export interface ISavedNationalAuditPeriod extends Document {
  generatedBy: Types.ObjectId;
  startMonth: string; // e.g., "2026-01"
  endMonth: string; // e.g., "2026-03"
  periodType: NationalAuditPeriodType;
  periodLabel: string;
  auditData: INationalAuditPeriodReport;
  coverage: IPeriodicCoverage;
  createdAt: Date;
  updatedAt: Date;
}

const MissingCoveragePairSchema = new Schema(
  {
    zoneName: { type: String, required: true },
    month: { type: String, required: true },
  },
  { _id: false },
);

const PeriodicCoverageSchema = new Schema(
  {
    expectedZoneMonths: { type: Number, required: true },
    presentZoneMonths: { type: Number, required: true },
    missingPairs: { type: [MissingCoveragePairSchema], default: [] },
    sourceAuditIds: { type: [String], default: [] },
  },
  { _id: false },
);

const SavedNationalAuditPeriodSchema = new Schema<ISavedNationalAuditPeriod>(
  {
    generatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    startMonth: { type: String, required: true, index: true },
    endMonth: { type: String, required: true, index: true },
    periodType: {
      type: String,
      enum: ["quarter", "half-year", "year", "custom"],
      required: true,
      default: "custom",
    },
    periodLabel: { type: String, required: true },
    auditData: { type: Schema.Types.Mixed, required: true },
    coverage: { type: PeriodicCoverageSchema, required: true },
  },
  { timestamps: true },
);

// One saved periodic national audit per exact month range.
SavedNationalAuditPeriodSchema.index({ startMonth: 1, endMonth: 1 }, { unique: true });

export const SavedNationalAuditPeriod: Model<ISavedNationalAuditPeriod> =
  models.SavedNationalAuditPeriod ||
  mongoose.model<ISavedNationalAuditPeriod>(
    "SavedNationalAuditPeriod",
    SavedNationalAuditPeriodSchema,
  );
