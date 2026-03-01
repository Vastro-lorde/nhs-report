/* ──────────────────────────────────────────
   Model: DocumentType
   Represents a category/title for documents uploaded for a fellow.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, models } from "mongoose";

export interface IDocumentType extends Document {
    title: string;
    createdAt: Date;
    updatedAt: Date;
}

const DocumentTypeSchema = new Schema<IDocumentType>(
    {
        title: { type: String, required: true, trim: true, unique: true },
    },
    { timestamps: true }
);

export const DocumentType: Model<IDocumentType> =
    models.DocumentType || mongoose.model<IDocumentType>("DocumentType", DocumentTypeSchema);
