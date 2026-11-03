/* ──────────────────────────────────────────
   API: /api/coordinators/[id]/change-email — Admin change coordinator email
   - Resets password to a temporary one
   - Emails the temp password to the new email
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { coordinatorEmailChangedTemplate } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { env } from "@/lib/env";
import { logException } from "@/lib/exception-logger";
import { isValidObjectId } from "mongoose";

type Params = { params: Promise<{ id: string }> };

function generateTempPassword(): string {
  // 12–16 chars, URL-safe, no confusing chars policy enforced.
  return crypto.randomBytes(12).toString("base64url").slice(0, 14);
}

export async function POST(request: NextRequest, { params }: Params) {
  const { session, error } = await requireRole(UserRole.ADMIN);
  if (error) return error;

  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Coordinator not found", 404);

  const body = await parseBody<{ email?: string }>(request);

  const newEmail = String(body?.email ?? "")
    .trim()
    .toLowerCase();

  if (!newEmail) return jsonError("New email is required");
  if (!newEmail.includes("@")) return jsonError("Invalid email address");

  try {
    await connectDB();

    // Keep the old email + password hash so we can roll back if the email can't be delivered.
    const user = await User.findById(id).select("+password name email role active rootAdmin").lean();
    if (!user) return jsonError("Coordinator not found", 404);
    if (user.role !== UserRole.COORDINATOR) return jsonError("Coordinator not found", 404);

    const emailInUse = await User.findOne({ email: newEmail, _id: { $ne: id } }).select("_id").lean();
    if (emailInUse) return jsonError("Email is already in use", 409);

    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    await User.updateOne({ _id: id }, { $set: { email: newEmail, password: hashedPassword } });

    try {
      const tpl = coordinatorEmailChangedTemplate(user.name, newEmail, tempPassword, env.NEXTAUTH_URL());
      await sendMail({ to: newEmail, subject: tpl.subject, text: tpl.text, html: tpl.html });
    } catch (mailErr) {
      // Without the email the coordinator would be locked out (new login, unknown password),
      // so restore the previous credentials and report the failure.
      await User.updateOne({ _id: id }, { $set: { email: user.email, password: user.password } });
      void logException({
        error: mailErr,
        context: "POST /api/coordinators/[id]/change-email (sendMail)",
        session,
        meta: { coordinatorId: id, newEmail },
      });
      return jsonError(
        "Could not send the temporary password to the new email address, so no changes were made. Please check the address and try again.",
        502,
      );
    }

    return jsonOk({
      success: true,
      message: "Coordinator email updated and temporary password sent",
    });
  } catch (err) {
    if ((err as { code?: number })?.code === 11000) return jsonError("Email is already in use", 409);
    void logException({
      error: err,
      context: "POST /api/coordinators/[id]/change-email",
      session,
      meta: { coordinatorId: id, newEmail },
    });
    return jsonError("Failed to change coordinator email", 500);
  }
}
