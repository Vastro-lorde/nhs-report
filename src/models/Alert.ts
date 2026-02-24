/* ──────────────────────────────────────────
   Model: Alert  (urgent issue tracking)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { AlertStatus } from "@/lib/constants";

export interface IAlert extends Document {
  report: Types.ObjectId;
  mentor: Types.ObjectId;
  weekKey: string;
  state: string;
  urgentDetails: string;
  status: AlertStatus;
  notes?: string;
  resolvedBy?: Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<IAlert>(
  {
    report: { type: Schema.Types.ObjectId, ref: "WeeklyReport", required: true },
    mentor: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekKey: { type: String, required: true, index: true },
    state: { type: String, default: "" },
    urgentDetails: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(AlertStatus),
      default: AlertStatus.NEW,
    },
    notes: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

export const Alert: Model<IAlert> =
  models.Alert || mongoose.model<IAlert>("Alert", AlertSchema);
