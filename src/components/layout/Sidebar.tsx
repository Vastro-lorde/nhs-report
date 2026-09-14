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
  CalendarClock,
  CalendarPlus,
  CalendarCheck,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { APP_NAME, APP_LOGO_URL, UserRole } from "@/lib/constants";
import { useSidebar } from "./SidebarContext";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    description: "View overall metrics, activities, and programme summaries",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD, UserRole.FELLOW],
  },
  {
    label: "Book a Session",
    href: "/book",
    icon: CalendarPlus,
    description: "Book an advisory or mentoring session with your assigned mentor",
    roles: [UserRole.FELLOW],
  },
  {
    label: "My Schedule",
    href: "/schedule",
    icon: CalendarClock,
    description: "Set your weekly availability and view upcoming session slots",
    roles: [UserRole.MENTOR],
  },
  {
    label: "My Sessions",
    href: "/sessions",
    icon: CalendarCheck,
    description: "View and manage your upcoming, completed, and canceled sessions",
    roles: [UserRole.MENTOR, UserRole.FELLOW],
  },
  {
    label: "Submit Report",
    href: "/reports/new",
    icon: FileText,
    description: "Submit your weekly mentoring activities and progress report",
    roles: [UserRole.MENTOR],
  },
  {
    label: "Reports",
    href: "/reports",
    icon: FileText,
    description: "Browse, filter, and inspect weekly mentor reports",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Monthly Report",
    href: "/reports/monthly",
    icon: FileText,
    description: "Access and generate consolidated monthly mentor reports",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Fellow Monthly Report",
    href: "/reports/fellow-monthly",
    icon: FileText,
    description: "View and submit monthly progress evaluations for fellows",
    roles: [UserRole.ADMIN, UserRole.MENTOR, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Zonal Audits",
    href: "/reports/zonal-audits",
    icon: ClipboardList,
    description: "Generate and review regional zonal audits with AI-driven insights",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "National Audit",
    href: "/admin/national-audit",
    icon: ClipboardList,
    description: "Inspect comprehensive nationwide programme audits",
    roles: [UserRole.ADMIN, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Periodic National Audit",
    href: "/admin/national-audit-period",
    icon: ClipboardList,
    description: "Analyze national performance audits across specific evaluation periods",
    roles: [UserRole.ADMIN, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Fellows",
    href: "/fellows",
    icon: Users,
    description: "Manage fellows, verify documentation, and monitor participation",
    roles: [UserRole.ADMIN, UserRole.MENTOR, UserRole.COORDINATOR, UserRole.ME_OFFICER, UserRole.ZONAL_DESK_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Mentors Management",
    href: "/mentors",
    icon: Users,
    description: "Manage mentors, assignments, and check reporting compliance",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Meet Monitoring",
    href: "/admin/meet",
    icon: CalendarCheck,
    description: "Track Google Meet session links, attendance, and duration logs",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR],
  },
  {
    label: "Admins Management",
    href: "/admin/admins",
    icon: Users,
    description: "Manage system administrator accounts and platform access",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Coordinators Management",
    href: "/admin/coordinators",
    icon: Users,
    description: "Manage zonal coordinators and regional supervision assignments",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Desk Officers Management",
    href: "/admin/desk-officers",
    icon: Users,
    description: "Manage zonal desk officers across geopolitical zones",
    roles: [UserRole.ADMIN],
  },
  {
    label: "M&E Officers Management",
    href: "/admin/me-officers",
    icon: Users,
    description: "Manage Monitoring & Evaluation officers and compliance oversight",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Team Research Leads Management",
    href: "/admin/team-research-leads",
    icon: Users,
    description: "Manage Team Research Leads and supervisory accounts",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Alerts",
    href: "/alerts",
    icon: AlertTriangle,
    description: "Review pending system alerts, discrepancies, and unsubmitted reports",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ZONAL_DESK_OFFICER, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Document Types",
    href: "/admin/document-types",
    icon: FileText,
    description: "Configure required fellow document categories and file rules",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Bulk Mentors",
    href: "/mentors/bulk-upload",
    icon: Users,
    description: "Bulk import new mentors into the platform using CSV templates",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Explore interactive charts, KPI metrics, and submission rates",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD],
  },
  {
    label: "Activity Logs",
    href: "/admin/logs",
    icon: ClipboardList,
    description: "Audit security events, user logins, and administrative actions",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Report Settings",
    href: "/admin/report-settings",
    icon: Settings,
    description: "Configure weekly report submission deadlines and system windows",
    roles: [UserRole.ADMIN],
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
    description: "Manage your profile, password, notifications, and security preferences",
    roles: [UserRole.ADMIN, UserRole.COORDINATOR, UserRole.MENTOR, UserRole.ME_OFFICER, UserRole.TEAM_RESEARCH_LEAD, UserRole.FELLOW],
  },
] satisfies { label: string; href: string; icon: typeof LayoutDashboard; description: string; roles: string[] }[];


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
  const [hasCurrentWeekReport, setHasCurrentWeekReport] = useState(false);
  // Id of this week's saved-but-unsubmitted report, if there is one.
  const [currentWeekDraftId, setCurrentWeekDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (role !== UserRole.MENTOR) return;
    api.reports.checkCurrentWeek()
      .then((data) => {
        setHasCurrentWeekReport(data.hasReport);
        setCurrentWeekDraftId(data.draftId ?? null);
      })
      .catch(() => {});
  }, [role, pathname]);

  const visibleItems = NAV_ITEMS.filter(
    (item) => {
      if (!role || !item.roles.includes(role)) return false;
      // Only a *submitted* report retires this entry — a draft leaves it in
      // place so the mentor still has a way back to their unfinished report.
      if (item.label === "Submit Report" && hasCurrentWeekReport) return false;
      // Coordinators need AI access to see Zonal Audits
      if (item.label === "Zonal Audits" && role === UserRole.COORDINATOR && !session?.user?.aiAccessEnabled) return false;
      return true;
    }
  ).map((item) =>
    // Point straight at the draft so clicking "Submit Report" resumes it
    // instead of opening a blank form that would collide on save.
    item.label === "Submit Report" && currentWeekDraftId
      ? { ...item, label: "Continue Draft Report", href: `/reports/${currentWeekDraftId}/edit` }
      : item
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
          <img src={APP_LOGO_URL} alt="CWC Research" className="h-8 w-8 rounded-lg object-cover" />
          <span className="font-semibold text-gray-900">{APP_NAME.replace("CWCR-", "")}</span>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {visibleItems.map((item, index) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              const description =
                item.label === "Continue Draft Report"
                  ? "Resume and complete your saved weekly report draft"
                  : item.description;

              return (
                <li key={`${item.href}-${index}`}>
                  <Link
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    data-tooltip={description}
                    data-tooltip-side="right"
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-orange-50 text-orange-700"
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
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-700 text-white text-sm font-semibold shrink-0">
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
                <span className="inline-block mt-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 capitalize">
                  {ROLE_DISPLAY_NAMES[session.user.role] ?? session.user.role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            data-tooltip="Sign out of your account"
            data-tooltip-side="top"
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
