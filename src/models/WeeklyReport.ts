/* ──────────────────────────────────────────
   Model: WeeklyReport
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { ReportStatus, OUTREACH_TYPES, CHALLENGE_TYPES } from "@/lib/constants";

// ─── Per-mentee session sub-document ────────
export interface IMentorshipSession {
  menteeName: string;
  menteeLGA?: string;
  sessionDate: Date;
  startTime: string;   // e.g. "05:00 PM"
  endTime: string;      // e.g. "06:30 PM"
  duration: string;     // e.g. "1 hour 30 minutes"
  topicDiscussed: string;
  challenges: string[];   // bullet points
  solutions: string[];    // bullet points
  actionPlan: string[];   // bullet points
}

export interface IWeeklyReport extends Document {
  mentor: Types.ObjectId;
  weekEnding: Date;
  weekNumber: number;
  weekKey: string; // e.g. "2026-W08"

  /* ── Cover note fields ──────────────── */
  coverNote?: string; // optional intro paragraph
  fellows: { name: string; lga: string }[]; // list of fellows & LGAs

  /* ── Individual session reports ─────── */
  sessions: IMentorshipSession[];

  /* ── Aggregate / quick-entry fields ─── */
  sessionsCount: number;
  menteesCheckedIn: number;
  outreachActivities: string[];
  outreachDescription?: string;
  keyWins?: string;
  challenges: string[];
  challengeDescription?: string;
  urgentAlert: boolean;
  urgentDetails?: string;
  supportNeeded?: string;
  evidenceUrls: string[]; // Cloudinary URLs

  status: ReportStatus;
  dataQualityFlags: string[];
  reviewedBy?: Types.ObjectId;
  reviewNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ────────────────────────────
const FellowSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    lga: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const MentorshipSessionSchema = new Schema(
  {
    menteeName: { type: String, required: true, trim: true },
    menteeLGA: { type: String, trim: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    topicDiscussed: { type: String, required: true, trim: true },
    challenges: { type: [String], default: [] },
    solutions: { type: [String], default: [] },
    actionPlan: { type: [String], default: [] },
  },
  { _id: true }
);

const WeeklyReportSchema = new Schema<IWeeklyReport>(
  {
    mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true },
    weekEnding: { type: Date, required: true },
    weekNumber: { type: Number },
    weekKey: { type: String, required: true, index: true },

    coverNote: { type: String, trim: true },
    fellows: { type: [FellowSchema], default: [] },
    sessions: { type: [MentorshipSessionSchema], default: [] },

    sessionsCount: { type: Number, default: 0, min: 0 },
    menteesCheckedIn: { type: Number, default: 0, min: 0 },
    outreachActivities: {
      type: [String],
      enum: [...OUTREACH_TYPES, "Other"],
      default: [],
    },
    outreachDescription: { type: String, trim: true },
    keyWins: { type: String, trim: true },
    challenges: {
      type: [String],
      enum: [...CHALLENGE_TYPES, "Other"],
      default: [],
    },
    challengeDescription: { type: String, trim: true },
    urgentAlert: { type: Boolean, default: false },
    urgentDetails: { type: String, trim: true },
    supportNeeded: { type: String, trim: true },
    evidenceUrls: { type: [String], default: [] },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.SUBMITTED,
    },
    dataQualityFlags: { type: [String], default: [] },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

// One report per mentor per week
WeeklyReportSchema.index({ mentor: 1, weekKey: 1 }, { unique: true });

export const WeeklyReport: Model<IWeeklyReport> =
  models.WeeklyReport ||
  mongoose.model<IWeeklyReport>("WeeklyReport", WeeklyReportSchema);
