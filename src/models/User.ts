/* ──────────────────────────────────────────
   Model: User  (admins, coordinators, mentors)
   ────────────────────────────────────────── */
import mongoose, { Schema, Document, Model, models } from "mongoose";
import { UserRole, STATES } from "@/lib/constants";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string; // bcrypt hash
  phone?: string;
  role: UserRole;
  rootAdmin?: boolean;
  profileImage?: string;
  active: boolean;
  aiAccessEnabled: boolean;
  resetOtpHash?: string;
  resetOtpExpires?: Date;
  resetOtpAttempts?: number;
  inviteTokenHash?: string;
  inviteTokenExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.MENTOR,
    },
    rootAdmin: { type: Boolean, default: false },
    profileImage: { type: String },
    active: { type: Boolean, default: true },
    aiAccessEnabled: { type: Boolean, default: false },
    resetOtpHash: { type: String, select: false },
    resetOtpExpires: { type: Date, select: false },
    resetOtpAttempts: { type: Number, default: 0, select: false },
    inviteTokenHash: { type: String, select: false },
    inviteTokenExpires: { type: Date, select: false },
  },
  { timestamps: true }
);

// Prevent model recompilation in dev hot-reload
export const User: Model<IUser> =
  models.User || mongoose.model<IUser>("User", UserSchema);
