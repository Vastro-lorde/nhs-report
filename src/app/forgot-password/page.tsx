/* ──────────────────────────────────────────
   Forgot password page (request OTP + reset)
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { APP_PUBLIC_NAME, APP_LOGO_URL } from "@/lib/constants";

type Step = "email" | "reset";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not send reset code. Try again.");
        return;
      }
      setInfo(
        data?.message ??
          "If an account exists for that email, a password reset code has been sent.",
      );
      setStep("reset");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (otp.trim().length === 0) {
      setError("Enter the OTP from your email");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not reset password.");
        return;
      }
      setInfo("Password reset successful. Redirecting to sign in…");
      setTimeout(() => router.push("/login"), 1200);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={APP_LOGO_URL}
            alt="CWC Research"
            className="mx-auto h-14 w-14 rounded-xl object-cover mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            {APP_PUBLIC_NAME}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === "email"
              ? "Reset your password"
              : "Enter the code we sent to your email"}
          </p>
        </div>

        <div className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 space-y-5">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              {info}
            </div>
          )}

          {step === "email" ? (
            <form onSubmit={requestOtp} className="space-y-5">
              <Input
                id="email"
                name="email"
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                autoComplete="username"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-5">
              <Input
                id="otp"
                name="otp"
                label="One-time password (OTP)"
                type="text"
                inputMode="numeric"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                autoFocus
                autoComplete="one-time-code"
              />
              <Input
                id="newPassword"
                name="newPassword"
                label="New password"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm new password"
                type="password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Resetting…" : "Reset password"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setError("");
                  setInfo("");
                }}
                className="block w-full text-center text-sm text-gray-500 hover:underline"
              >
                Use a different email
              </button>
            </form>
          )}

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="text-sm text-green-700 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          National Health Fellowship Mentorship Program
        </p>
      </div>
    </div>
  );
}
