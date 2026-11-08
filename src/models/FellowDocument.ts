/* ──────────────────────────────────────────
   Model: FellowDocument
   Represents a document uploaded by a mentor for their fellow.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { cohortScopePlugin } from "@/lib/cohort-plugin";

export interface IFellowDocument extends Document {
    fellow: Types.ObjectId;
    documentType: Types.ObjectId;
    url: string;
    deleted: boolean;
    deletedAt?: Date | null;
    deletedBy?: Types.ObjectId | null;
    /** Cohort this record belongs to (stamped by the cohort plugin). */
    cohort?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const FellowDocumentSchema = new Schema<IFellowDocument>(
    {
        fellow: { type: Schema.Types.ObjectId, ref: "Fellow", required: true, index: true },
        documentType: { type: Schema.Types.ObjectId, ref: "DocumentType", required: true },
        url: { type: String, required: true },
        deleted: { type: Boolean, default: false, index: true },
        deletedAt: { type: Date, default: null },
        deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    },
    { timestamps: true }
);

FellowDocumentSchema.plugin(cohortScopePlugin, { modelName: "FellowDocument" });

export const FellowDocument: Model<IFellowDocument> =
    models.FellowDocument || mongoose.model<IFellowDocument>("FellowDocument", FellowDocumentSchema);
