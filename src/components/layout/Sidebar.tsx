/* ──────────────────────────────────────────
   Sidebar navigation component
   ────────────────────────────────────────── */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Users,
  AlertTriangle,
  BarChart3,
  Settings,
  LogOut,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR],
  },
  {
    label: "Submit Report",
    href: "/reports/new",
    icon: FileText,
    roles: [UserRole.MENTOR],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR],
  },
  {
    label: "Mentors",
    href: "/mentors",
    icon: Users,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR],
  },
  {
    label: "Alerts",
    href: "/alerts",
    icon: AlertTriangle,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [UserRole.ADMIN],
  },
] satisfies { label: string; href: string; icon: typeof LayoutDashboard; roles: string[] }[];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const visibleItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role)
  );

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-6">
        <div className="h-8 w-8 rounded-lg bg-green-700 flex items-center justify-center">
          <span className="text-white font-bold text-sm">NHS</span>
        </div>
        <span className="font-semibold text-gray-900">Mentor Reporting</span>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-green-50 text-green-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info + Sign out */}
      <div className="border-t border-gray-200 p-4">
        {session?.user && (
          <div className="mb-3">
            <p className="text-sm font-medium text-gray-900 truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
            <span className="inline-block mt-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 capitalize">
              {session.user.role}
            </span>
          </div>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
