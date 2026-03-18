/* ──────────────────────────────────────────
   Model: MentorMonthlyReport
   Per-fellow monthly report submitted by a mentor.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export type ProgressRating = "Excellent" | "Good" | "Fair" | "Needs Improvement" | "";

export interface IMentorMonthlyReport extends Document {
    mentor: Types.ObjectId;
    fellow: Types.ObjectId;
    month: string; // e.g. "2026-03"

    // Denormalised fellow details (snapshot at time of report)
    fellowName: string;
    fellowLGA: string;
    fellowQualification: string;

    // Attendance
    sessionsHeld: number;
    sessionsAttended: number;
    sessionsAbsent: number;

    // Monthly Summary sections
    summaryLearning: string;
    summaryPhcVisits: string;
    summaryActivities: string;
    summaryGrowth: string;
    summaryImpact: string;

    // Challenges, recommendations, achievements
    challenges: string[];
    recommendations: string[];
    achievements: string;

    // Rating
    progressRating: ProgressRating;

    // Audit
    weeklyReportIds: Types.ObjectId[];
    status: "draft" | "submitted";
    createdAt: Date;
    updatedAt: Date;
}

const MentorMonthlyReportSchema = new Schema<IMentorMonthlyReport>(
    {
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        fellow: { type: Schema.Types.ObjectId, ref: "Fellow", required: true, index: true },
        month: { type: String, required: true },

        fellowName: { type: String, required: true, trim: true },
        fellowLGA: { type: String, trim: true, default: "" },
        fellowQualification: { type: String, trim: true, default: "" },

        sessionsHeld: { type: Number, default: 0 },
        sessionsAttended: { type: Number, default: 0 },
        sessionsAbsent: { type: Number, default: 0 },

        summaryLearning: { type: String, trim: true, default: "" },
        summaryPhcVisits: { type: String, trim: true, default: "" },
        summaryActivities: { type: String, trim: true, default: "" },
        summaryGrowth: { type: String, trim: true, default: "" },
        summaryImpact: { type: String, trim: true, default: "" },

        challenges: { type: [String], default: [] },
        recommendations: { type: [String], default: [] },
        achievements: { type: String, trim: true, default: "" },

        progressRating: {
            type: String,
            enum: ["Excellent", "Good", "Fair", "Needs Improvement", ""],
            default: "",
        },

        weeklyReportIds: { type: [Schema.Types.ObjectId], ref: "WeeklyReport", default: [] },
        status: { type: String, enum: ["draft", "submitted"], default: "submitted" },
    },
    { timestamps: true }
);

// One report per mentor per fellow per month
MentorMonthlyReportSchema.index(
    { mentor: 1, fellow: 1, month: 1 },
    { unique: true }
);

export const MentorMonthlyReport: Model<IMentorMonthlyReport> =
    models.MentorMonthlyReport ||
    mongoose.model<IMentorMonthlyReport>("MentorMonthlyReport", MentorMonthlyReportSchema);
