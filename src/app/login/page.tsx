/* ──────────────────────────────────────────
   Login page
   ────────────────────────────────────────── */
"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DebugSeeder } from "@/components/ui/DebugSeeder";
import { APP_NAME, APP_LOGO_URL } from "@/lib/constants";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
    } else {
      router.push(callbackUrl);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <img src={APP_LOGO_URL} alt="CWC Research" className="mx-auto h-14 w-14 rounded-xl object-cover mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">
            {APP_NAME.replace("CWCR-", "")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sign in to submit and view reports
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-sm border border-gray-200 rounded-xl p-8 space-y-5"
          suppressHydrationWarning
        >
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

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
            suppressHydrationWarning
          />

          <Input
            id="password"
            name="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            suppressHydrationWarning
          />

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          National Health Fellowship Mentorship Program
        </p>
      </div>

      <DebugSeeder
        label="Prefill Seeder Roles"
        onFill={() => {
          // Cycle through the 3 seeded roles
          const roles = [
            { email: "admin@mailinator.com", password: "admin123" },
            { email: "coordinator@mailinator.com", password: "coord123" },
            { email: "mentor@mailinator.com", password: "mentor123" },
          ];
          const currentIndex = roles.findIndex((r) => r.email === email);
          const nextIndex = (currentIndex + 1) % roles.length;

          setEmail(roles[nextIndex].email);
          setPassword(roles[nextIndex].password);
        }}
      />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-400">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
