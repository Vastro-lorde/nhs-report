/* ──────────────────────────────────────────
   API: /api/seed — admin seed route (dev only)
   Creates initial admin user
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return jsonError("Not available in production", 403);
  }

  await connectDB();

  const existing = await User.findOne({ role: UserRole.ADMIN });
  if (existing) {
    return jsonOk({ message: "Admin already exists", email: existing.email });
  }

  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await User.create({
    name: "System Admin",
    email: "admin@nhs-report.local",
    password: hashedPassword,
    role: UserRole.ADMIN,
    active: true,
  });

  return jsonOk({
    message: "Admin user created",
    email: admin.email,
    password: "admin123 (change immediately)",
  });
}
