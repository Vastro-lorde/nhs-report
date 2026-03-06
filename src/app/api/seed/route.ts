/* ──────────────────────────────────────────
   API: /api/seed — seed root admin from env vars
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { jsonOk, jsonError } from "@/lib/api-helpers";

export async function POST(_request: NextRequest) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    return jsonError("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD env variables are required", 400);
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    return jsonOk({ message: "Admin already exists", skipped: [email] });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await User.create({
    name: "System Admin",
    email,
    password: hashedPassword,
    role: UserRole.ADMIN,
    rootAdmin: true,
    active: true,
  });

  return jsonOk({
    message: "Root admin seeded successfully",
    created: [{ email, role: UserRole.ADMIN }],
  });
}
