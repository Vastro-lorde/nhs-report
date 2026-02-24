/* ──────────────────────────────────────────
   SessionProvider wrapper for client components
   ────────────────────────────────────────── */
"use client";

import { SessionProvider as NextAuthProvider } from "next-auth/react";
import { type ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <NextAuthProvider>{children}</NextAuthProvider>;
}
