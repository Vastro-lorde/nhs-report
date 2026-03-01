/* ──────────────────────────────────────────
   Model: FellowDocument
   Represents a document uploaded by a mentor for their fellow.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IFellowDocument extends Document {
    fellow: Types.ObjectId;
    documentType: Types.ObjectId;
    url: string;
    createdAt: Date;
    updatedAt: Date;
}

const FellowDocumentSchema = new Schema<IFellowDocument>(
    {
        fellow: { type: Schema.Types.ObjectId, ref: "Fellow", required: true, index: true },
        documentType: { type: Schema.Types.ObjectId, ref: "DocumentType", required: true },
        url: { type: String, required: true },
    },
    { timestamps: true }
);

export const FellowDocument: Model<IFellowDocument> =
    models.FellowDocument || mongoose.model<IFellowDocument>("FellowDocument", FellowDocumentSchema);
