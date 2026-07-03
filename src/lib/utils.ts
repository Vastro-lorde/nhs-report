/* ──────────────────────────────────────────
   UI utility: cn() — merge Tailwind classes
   ────────────────────────────────────────── */
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize a user-provided meeting/URL so it always opens as an external link.
 * If the value has no scheme (e.g. "meet.google.com/abc"), a leading "https://"
 * is added so browsers don't treat it as a relative in-app path.
 * Returns undefined for empty input.
 */
export function toExternalUrl(url: string | null | undefined): string | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
