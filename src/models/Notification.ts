/* ──────────────────────────────────────────
   Model: Notification
   General-purpose in-portal notification targeted
   at a single auth user. Decoupled from Alerts.
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, Types, models } from "mongoose";
import { NotificationType } from "@/lib/constants";

export interface INotification extends Document {
    recipient: Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    /** In-app link the notification points to. */
    link?: string;
    read: boolean;
    /** Loosely-typed reference to the related entity (booking, slot, fellow…). */
    relatedId?: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
    {
        recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        type: { type: String, enum: Object.values(NotificationType), required: true },
        title: { type: String, required: true, trim: true },
        body: { type: String, required: true, trim: true },
        link: { type: String, trim: true },
        read: { type: Boolean, default: false, index: true },
        relatedId: { type: Schema.Types.ObjectId },
    },
    { timestamps: true }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> =
    models.Notification || mongoose.model<INotification>("Notification", NotificationSchema);
