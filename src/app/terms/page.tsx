/* ──────────────────────────────────────────
   Public Terms of Service page (open to all)
   ────────────────────────────────────────── */
import Link from "next/link";
import type { Metadata } from "next";
import { TermsContent } from "@/components/legal";
import { APP_PUBLIC_NAME, APP_LOGO_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: `Terms of Service — ${APP_PUBLIC_NAME}`,
  description: "Terms of Service for the mentorship reporting platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={APP_LOGO_URL}
            alt={APP_PUBLIC_NAME}
            className="mx-auto mb-4 h-14 w-14 rounded-xl object-cover"
          />
          <h1 className="text-2xl font-bold text-gray-900">Terms of Service</h1>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <TermsContent />
        </div>

        <p className="mt-6 text-center text-sm">
          <Link href="/login" className="text-orange-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
