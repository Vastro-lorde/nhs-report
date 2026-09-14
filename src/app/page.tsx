/* ──────────────────────────────────────────
   Public landing / home page
   Publicly viewable (no login required) so it can
   describe the product for OAuth consent-screen
   verification and first-time visitors.
   ────────────────────────────────────────── */
import Link from "next/link";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { APP_PUBLIC_NAME, APP_LOGO_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: APP_PUBLIC_NAME,
  description:
    "The CWC Research Mentorship Portal is a capacity-building platform that manages the National Health Fellows Mentorship Program, including zonal reporting, mentorship scheduling, and virtual tutoring.",
  openGraph: {
    siteName: APP_PUBLIC_NAME,
    title: APP_PUBLIC_NAME,
    description:
      "The CWC Research Mentorship Portal is a capacity-building platform that manages the National Health Fellows Mentorship Program, including zonal reporting, mentorship scheduling, and virtual tutoring.",
  },
};

const FEATURES = [
  {
    title: "Mentorship & Scheduling",
    description:
      "Mentors publish availability and Fellows book virtual tutoring and mentorship sessions with integrated Google Meet links.",
  },
  {
    title: "Zonal Reporting",
    description:
      "Structured weekly and monthly reporting with automated data-collection templates across every programme zone.",
  },
  {
    title: "Analytics & Evaluation",
    description:
      "Aggregated performance metrics and comprehensive zonal evaluation reports for programme leadership.",
  },
  {
    title: "Role-Based Access",
    description:
      "Secure, role-based access control for Administrators, Coordinators, Mentors, and Fellows.",
  },
];

export default async function Home() {
  const session = await auth();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={APP_LOGO_URL}
              alt={APP_PUBLIC_NAME}
              className="h-10 w-10 rounded-lg object-cover"
            />
            <span className="text-base font-semibold text-gray-900">
              {APP_PUBLIC_NAME}
            </span>
          </div>
          {session ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2.5 rounded-full border border-gray-200 bg-white pl-1.5 pr-4 py-1 text-sm font-medium text-gray-800 shadow-sm transition-all hover:bg-gray-50 hover:border-orange-300 hover:shadow"
              data-tooltip="Go to your portal dashboard"
            >
              {session.user.profileImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.profileImage}
                  alt={session.user.name || "Profile"}
                  className="h-7 w-7 rounded-full object-cover border border-gray-200"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                  {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <span>Dashboard</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800"
              data-tooltip="Sign in to the mentorship portal"
            >
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center">
          <h1 id="app-name" className="text-3xl font-bold text-gray-900 sm:text-4xl">
            {APP_PUBLIC_NAME}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-gray-600">
            The {APP_PUBLIC_NAME} is a capacity-building and strategic
            mobilization platform built by CWC Research to manage the National
            Health Fellows Mentorship Program. It connects Fellows, Mentors, and
            Coordinators with tools for mentorship scheduling, virtual tutoring,
            zonal reporting, and programme analytics.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-3 rounded-xl bg-orange-700 px-6 py-3 text-sm font-medium text-white shadow-sm transition-all hover:bg-orange-800 hover:shadow"
                data-tooltip="Go to your portal dashboard"
              >
                {session.user.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={session.user.profileImage}
                    alt={session.user.name || "Profile"}
                    className="h-7 w-7 rounded-full object-cover border border-white/40"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-800 text-xs font-semibold text-white">
                    {session.user.name ? session.user.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                <span>Go to Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center rounded-md bg-orange-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-800"
                data-tooltip="Sign in to access your portal dashboard"
              >
                Sign in to your account
              </Link>
            )}
          </div>
        </section>

        {/* Purpose / Features */}
        <section className="pb-16">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-900">
            What the platform does
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h3 className="text-base font-semibold text-gray-900">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row">
          <p>
            &copy; {new Date().getFullYear()} CWC Research. All rights reserved.
          </p>
          <nav className="flex items-center gap-4">
            <Link
              href="/terms"
              className="hover:text-orange-700 hover:underline"
              data-tooltip="Read Terms of Service"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="hover:text-orange-700 hover:underline"
              data-tooltip="Read Privacy Policy"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:admin@cwcr.ng"
              className="hover:text-orange-700 hover:underline"
              data-tooltip="Send an email to admin@cwcr.ng"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
