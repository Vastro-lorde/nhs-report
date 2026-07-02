/* ──────────────────────────────────────────
   Reusable modal that displays legal content
   (Terms of Service / Privacy Policy).
   ────────────────────────────────────────── */
"use client";

import { type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

export function LegalModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 transition-colors hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">{children}</div>

        <div className="flex justify-end border-t border-gray-200 px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
