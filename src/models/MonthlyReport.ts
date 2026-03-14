/* ──────────────────────────────────────────
   Model: MonthlyReport
   Aggregates weekly reports by state/month.
   Supports two types:
     - "mentor"  → a single mentor's monthly rollup
     - "zonal"   → a coordinator's zonal monthly rollup
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMonthlyReport extends Document {
    type: "mentor" | "zonal";
    coordinator?: Types.ObjectId;
    mentor?: Types.ObjectId;
    state: string;
    month: string; // e.g., "2025-08"
    summaryText: string;
    weeklyReports: Types.ObjectId[];
    status: string;
    createdAt: Date;
    updatedAt: Date;
}

const MonthlyReportSchema = new Schema<IMonthlyReport>(
    {
        type: { type: String, enum: ["mentor", "zonal"], required: true },
        coordinator: { type: Schema.Types.ObjectId, ref: "Coordinator", index: true },
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", index: true },
        state: { type: String, required: true },
        month: { type: String, required: true },
        summaryText: { type: String, required: true, trim: true },
        weeklyReports: { type: [Schema.Types.ObjectId], ref: "WeeklyReport", default: [] },
        status: { type: String, enum: ["draft", "submitted"], default: "submitted" },
    },
    { timestamps: true }
);

// One zonal report per coordinator per month
MonthlyReportSchema.index(
    { coordinator: 1, month: 1 },
    { unique: true, partialFilterExpression: { type: "zonal", coordinator: { $exists: true } } }
);

// One mentor report per mentor per month
MonthlyReportSchema.index(
    { mentor: 1, month: 1 },
    { unique: true, partialFilterExpression: { type: "mentor", mentor: { $exists: true } } }
);

export const MonthlyReport: Model<IMonthlyReport> =
    models.MonthlyReport || mongoose.model<IMonthlyReport>("MonthlyReport", MonthlyReportSchema);
