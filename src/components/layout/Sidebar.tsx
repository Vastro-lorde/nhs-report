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
  ClipboardList,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { APP_NAME, UserRole } from "@/lib/constants";
import { useSidebar } from "./SidebarContext";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
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
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Monthly Report",
    href: "/reports/monthly",
    icon: FileText,
    roles: [UserRole.MENTOR, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Fellows",
    href: "/fellows",
    icon: Users,
    roles: [UserRole.ADMIN, UserRole.MENTOR, UserRole.ME_OFFICER, UserRole.ZONAL_DESK_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Mentors Management",
    href: "/mentors",
    icon: Users,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Admins Management",
    href: "/admin/admins",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Coordinators Management",
    href: "/admin/coordinators",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Desk Officers Management",
    href: "/admin/desk-officers",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "M&E Officers Management",
    href: "/admin/me-officers",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Team Research Leads Management",
    href: "/admin/team-research-leads",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Alerts",
    href: "/alerts",
    icon: AlertTriangle,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Document Types",
    href: "/admin/document-types",
    icon: FileText,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Bulk Mentors",
    href: "/mentors/bulk-upload",
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Activity Logs",
    href: "/admin/logs",
    icon: ClipboardList,
    roles: [UserRole.ADMIN],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
] satisfies { label: string; href: string; icon: typeof LayoutDashboard; roles: string[] }[];

const ROLE_DISPLAY_NAMES: Record<string, string> = {
  [UserRole.COORDINATOR]: "Zonal Coordinator",
  [UserRole.ME_OFFICER]: "M&E Officer",
  [UserRole.ZONAL_DESK_OFFICER]: "Desk Officer",
  [UserRole.TEAM_RESEARCH_LEAD]: "Team Research Lead",
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const role = session?.user?.role as UserRole | undefined;
  const { isSidebarOpen, setSidebarOpen } = useSidebar();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !role || item.roles.includes(role)
  );

  if (status === "loading") {
    // Return empty sidebar skeleton or null during initial load to prevent FOUC
    return (
      <aside className="fixed left-0 top-0 z-[70] hidden md:flex h-[100dvh] w-64 flex-col border-r border-gray-200 bg-white">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-gray-200">
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </aside>
    );
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-[70] flex h-[100dvh] w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 ease-in-out md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center gap-2 border-b border-gray-200 px-6">
          <div className="h-8 w-8 rounded-lg bg-green-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">CWCR</span>
          </div>
          <span className="font-semibold text-gray-900">{APP_NAME.replace("CWCR-", "")}</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item, index) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <li key={`${item.href}-${index}`}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
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
        <div className="border-t border-gray-200 p-4 pb-24 md:pb-4 shrink-0 bg-white relative z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {session?.user && (
            <div className="mb-3 flex items-start gap-3">
              {session.user.profileImage ? (
                <img
                  src={session.user.profileImage}
                  alt={session.user.name}
                  className="h-10 w-10 rounded-full object-cover shrink-0"
                />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-700 text-white text-sm font-semibold shrink-0">
                  {session.user.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {session.user.name}
                </p>
                <p className="text-xs text-gray-500 truncate">{session.user.email}</p>
                <span className="inline-block mt-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800 capitalize">
                  {ROLE_DISPLAY_NAMES[session.user.role] ?? session.user.role}
                </span>
              </div>
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
    </>
  );
}
