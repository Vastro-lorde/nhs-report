/* ──────────────────────────────────────────
   Model: Fellow
   Represents a mentee assigned to a mentor.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";

export interface IFellow extends Document {
    mentor: Types.ObjectId;
    name: string;
    gender: string;
    lga: string;
    createdAt: Date;
    updatedAt: Date;
}

const FellowSchema = new Schema<IFellow>(
    {
        mentor: { type: Schema.Types.ObjectId, ref: "Mentor", required: true, index: true },
        name: { type: String, required: true, trim: true },
        gender: { type: String, required: true, trim: true },
        lga: { type: String, required: true, trim: true, uppercase: true }
    },
    { timestamps: true }
);

export const Fellow: Model<IFellow> =
    models.Fellow || mongoose.model<IFellow>("Fellow", FellowSchema);
