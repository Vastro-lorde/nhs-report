/* ──────────────────────────────────────────
   Model: Cohort
   A programme intake. Users below admin and all of their reports belong to
   exactly one cohort (see lib/cohort.ts for the lifecycle).

   NOTE: this model is deliberately NOT cohort-scoped itself.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { COHORT_STATUSES, CohortStatus } from "@/lib/cohort";

export interface ICohort extends Document {
  number: number;
  name: string;
  status: CohortStatus;
  startedAt?: Date | null;
  endedAt?: Date | null;
  notes?: string;
  createdBy?: Types.ObjectId;
  activatedBy?: Types.ObjectId;
  /** The cohort this one was rolled over from (wizard). */
  previousCohort?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CohortSchema = new Schema<ICohort>(
  {
    number: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: [...COHORT_STATUSES], required: true, default: CohortStatus.SETUP },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    activatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    previousCohort: { type: Schema.Types.ObjectId, ref: "Cohort", default: null },
  },
  { timestamps: true },
);

CohortSchema.index({ number: 1 }, { unique: true });
CohortSchema.index({ status: 1, number: -1 });
// At most one cohort being set up at a time. "One active cohort" is enforced by
// the activation flow rather than an index: the incoming cohort is switched on
// a moment before the outgoing one is archived, so there is never a gap with
// no live cohort (readers take the newest active one).
CohortSchema.index({ status: -1 }, { unique: true, partialFilterExpression: { status: CohortStatus.SETUP }, name: "one_setup_cohort" });

export const Cohort: Model<ICohort> =
  (models.Cohort as Model<ICohort>) || mongoose.model<ICohort>("Cohort", CohortSchema);
