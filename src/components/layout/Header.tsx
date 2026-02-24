/* ──────────────────────────────────────────
   Header component
   ────────────────────────────────────────── */
"use client";

import { useSession } from "next-auth/react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  const { data: session } = useSession();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        {children}
        {session?.user && (
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-700">{session.user.name}</p>
            <p className="text-xs text-gray-500 capitalize">{session.user.role}</p>
          </div>
        )}
      </div>
    </header>
  );
}
