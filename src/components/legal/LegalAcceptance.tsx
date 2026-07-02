/* ──────────────────────────────────────────
   Reusable onboarding acceptance control.
   Renders a required checkbox with links that
   open the Terms of Service / Privacy Policy in
   a modal. Controlled via `checked` / `onChange`.
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import { LegalModal } from "./LegalModal";
import { TermsContent } from "./TermsContent";
import { PrivacyPolicyContent } from "./PrivacyPolicyContent";

type ModalType = "terms" | "privacy" | null;

export function LegalAcceptance({
  checked,
  onChange,
  id = "legal-acceptance",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}) {
  const [modal, setModal] = useState<ModalType>(null);

  return (
    <div>
      <label htmlFor={id} className="flex items-start gap-2 text-sm text-gray-600">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-orange-700 focus:ring-orange-600"
        />
        <span>
          I have read and agree to the{" "}
          <button
            type="button"
            onClick={() => setModal("terms")}
            className="font-medium text-orange-700 hover:underline"
          >
            Terms of Service
          </button>{" "}
          and{" "}
          <button
            type="button"
            onClick={() => setModal("privacy")}
            className="font-medium text-orange-700 hover:underline"
          >
            Privacy Policy
          </button>
          .
        </span>
      </label>

      <LegalModal
        open={modal === "terms"}
        onClose={() => setModal(null)}
        title="Terms of Service"
      >
        <TermsContent />
      </LegalModal>

      <LegalModal
        open={modal === "privacy"}
        onClose={() => setModal(null)}
        title="Privacy Policy"
      >
        <PrivacyPolicyContent />
      </LegalModal>
    </div>
  );
}
