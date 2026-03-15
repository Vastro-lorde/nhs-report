/* ──────────────────────────────────────────
   Header component
   ────────────────────────────────────────── */
"use client";

import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";
import { useSidebar } from "./SidebarContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function Header({ title, subtitle, children }: HeaderProps) {
  const { data: session } = useSession();
  const { toggleSidebar } = useSidebar();

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 md:px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="md:hidden p-2 -ml-2 text-gray-500 hover:text-gray-900 rounded-md hover:bg-gray-100"
          aria-label="Toggle Sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="text-xs md:text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4">
        {children}
        {session?.user && (
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-700">{session.user.name}</p>
              <p className="text-xs text-gray-500 capitalize">{session.user.role}</p>
            </div>
            {session.user.profileImage ? (
              <img
                src={session.user.profileImage}
                alt={session.user.name}
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-700 text-white text-xs font-semibold">
                {session.user.name
                  ?.split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
