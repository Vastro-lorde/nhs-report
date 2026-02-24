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
  state?: string;
  lgas: string[];
  active: boolean;
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
    state: { type: String, enum: [...STATES, ""] },
    lgas: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Prevent model recompilation in dev hot-reload
export const User: Model<IUser> =
  models.User || mongoose.model<IUser>("User", UserSchema);
