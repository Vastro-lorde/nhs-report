/* ──────────────────────────────────────────
   SessionProvider wrapper for client components
   ────────────────────────────────────────── */
"use client";

import { SessionProvider as NextAuthProvider } from "next-auth/react";
import { type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/Tooltip";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <NextAuthProvider>
      <TooltipProvider>{children}</TooltipProvider>
    </NextAuthProvider>
  );
}

