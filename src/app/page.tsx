/* ──────────────────────────────────────────
   Public landing / home page
   Publicly viewable (no login required) so it can
   describe the product for OAuth consent-screen
   verification and first-time visitors.
   ────────────────────────────────────────── */
import Link from "next/link";
import type { Metadata } from "next";
import { APP_PUBLIC_NAME, APP_LOGO_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `${APP_PUBLIC_NAME} — Home`,
  description:
    "The CWC Research Mentorship Portal is a capacity-building platform that manages the National Health Fellows Mentorship Program, including zonal reporting, mentorship scheduling, and virtual tutoring.",
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

export default function Home() {
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
          <Link
            href="/login"
            className="inline-flex items-center rounded-md bg-orange-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-800"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-4">
        <section className="py-16 text-center">
          <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
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
            <Link
              href="/login"
              className="inline-flex items-center rounded-md bg-orange-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-orange-800"
            >
              Sign in to your account
            </Link>
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
            <Link href="/terms" className="hover:text-orange-700 hover:underline">
              Terms of Service
            </Link>
            <Link
              href="/privacy-policy"
              className="hover:text-orange-700 hover:underline"
            >
              Privacy Policy
            </Link>
            <a
              href="mailto:admin@cwcr.ng"
              className="hover:text-orange-700 hover:underline"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
