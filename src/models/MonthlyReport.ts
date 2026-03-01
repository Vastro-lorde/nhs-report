/* ──────────────────────────────────────────
   Model: MonthlyReport
   Aggregates weekly reports by state/month
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IMonthlyReport extends Document {
    coordinator: Types.ObjectId;
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
        coordinator: { type: Schema.Types.ObjectId, ref: "Coordinator", required: true, index: true },
        state: { type: String, required: true },
        month: { type: String, required: true },
        summaryText: { type: String, required: true, trim: true },
        weeklyReports: { type: [Schema.Types.ObjectId], ref: "WeeklyReport", default: [] },
        status: { type: String, enum: ["draft", "submitted"], default: "submitted" },
    },
    { timestamps: true }
);

// One report per state per month
MonthlyReportSchema.index({ state: 1, month: 1 }, { unique: true });

export const MonthlyReport: Model<IMonthlyReport> =
    models.MonthlyReport || mongoose.model<IMonthlyReport>("MonthlyReport", MonthlyReportSchema);
