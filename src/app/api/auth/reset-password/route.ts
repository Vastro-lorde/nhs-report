/* ──────────────────────────────────────────
   API Route: /api/auth/reset-password
   POST — verify OTP and set a new password
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

const MAX_OTP_ATTEMPTS = 5;

export const POST = withExceptionLog(
  "POST /api/auth/reset-password",
  async (request: NextRequest) => {
    const body = await parseBody<{
      email?: string;
      otp?: string;
      newPassword?: string;
    }>(request);

    const email = body?.email?.toLowerCase().trim();
    const otp = body?.otp?.trim();
    const newPassword = body?.newPassword ?? "";

    if (!email || !otp || !newPassword)
      return jsonError("email, otp and newPassword are required", 400);

    if (newPassword.length < 6)
      return jsonError("New password must be at least 6 characters", 400);

    await connectDB();
    const user = await User.findOne({ email, active: true }).select(
      "+password +resetOtpHash +resetOtpExpires +resetOtpAttempts",
    );

    if (!user || !user.resetOtpHash || !user.resetOtpExpires)
      return jsonError("Invalid or expired OTP", 400);

    if (user.resetOtpExpires.getTime() < Date.now()) {
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      return jsonError("Invalid or expired OTP", 400);
    }

    if ((user.resetOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      user.resetOtpHash = undefined;
      user.resetOtpExpires = undefined;
      user.resetOtpAttempts = 0;
      await user.save();
      return jsonError(
        "Too many invalid attempts. Please request a new code.",
        429,
      );
    }

    const valid = await bcrypt.compare(otp, user.resetOtpHash);
    if (!valid) {
      user.resetOtpAttempts = (user.resetOtpAttempts ?? 0) + 1;
      await user.save();
      return jsonError("Invalid or expired OTP", 400);
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.resetOtpHash = undefined;
    user.resetOtpExpires = undefined;
    user.resetOtpAttempts = 0;
    await user.save();

    return jsonOk({ message: "Password reset successful" });
  },
);
