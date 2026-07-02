/* ──────────────────────────────────────────
   Set password page (fellow invite activation)
   Token-based: /set-password?token=…
   ────────────────────────────────────────── */
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { LegalAcceptance } from "@/components/legal";
import { APP_NAME, APP_LOGO_URL } from "@/lib/constants";

function SetPasswordInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [name, setName] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function validate() {
      if (!token) {
        setChecking(false);
        setValid(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/auth/set-password?token=${encodeURIComponent(token)}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        setValid(Boolean(data?.valid));
        setName(data?.name ?? "");
      } catch {
        if (active) setValid(false);
      } finally {
        if (active) setChecking(false);
      }
    }
    validate();
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!accepted) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Could not set your password. Try again.");
        return;
      }
      setInfo("Your account is ready. Redirecting to sign in…");
      setTimeout(() => router.push("/login"), 1500);
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_LOGO_URL}
            alt="CWC Research"
            className="mx-auto h-14 w-14 rounded-xl object-cover mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-900">
            {APP_NAME.replace("CWCR-", "")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {name ? `Welcome, ${name}` : "Activate your account"}
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

          {checking ? (
            <p className="text-center text-sm text-gray-500">Validating your link…</p>
          ) : !valid ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-700">
                This invitation link is invalid or has expired. Please ask your
                mentor to send a new invitation.
              </p>
              <Link href="/login" className="text-sm text-green-700 hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <Input
                id="password"
                name="password"
                label="New password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                autoComplete="new-password"
              />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                label="Confirm password"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <LegalAcceptance checked={accepted} onChange={setAccepted} />
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !accepted}
              >
                {loading ? "Saving…" : "Set password & activate"}
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          National Health Fellowship Mentorship Program
        </p>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordInner />
    </Suspense>
  );
}
