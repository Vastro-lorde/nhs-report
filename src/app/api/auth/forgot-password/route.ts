/* ──────────────────────────────────────────
   API Route: /api/auth/forgot-password
   POST — request a password reset OTP
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { sendMail } from "@/lib/mailer";
import { passwordResetOtpTemplate } from "@/lib/email-templates";

const OTP_EXPIRY_MINUTES = 15;
const GENERIC_RESPONSE = {
  message:
    "If an account exists for that email, a password reset code has been sent.",
};

export const POST = withExceptionLog(
  "POST /api/auth/forgot-password",
  async (request: NextRequest) => {
    const body = await parseBody<{ email?: string }>(request);
    const email = body?.email?.toLowerCase().trim();
    if (!email) return jsonError("Email is required", 400);

    await connectDB();
    const user = await User.findOne({ email, active: true });

    // Always respond the same way to avoid email enumeration.
    if (!user) return jsonOk(GENERIC_RESPONSE);

    // Generate a 6-digit numeric OTP.
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const otpHash = await bcrypt.hash(otp, 10);
    const expires = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    user.resetOtpHash = otpHash;
    user.resetOtpExpires = expires;
    user.resetOtpAttempts = 0;
    await user.save();

    const { subject, text, html } = passwordResetOtpTemplate(
      user.name,
      otp,
      OTP_EXPIRY_MINUTES,
    );

    try {
      await sendMail({ to: user.email, subject, text, html });
    } catch (err) {
      console.error("[forgot-password] Failed to send OTP email:", err);
      // Roll back so the user can request again immediately.
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      return jsonError("Could not send reset email. Please try again later.", 500);
    }

    return jsonOk(GENERIC_RESPONSE);
  },
);
