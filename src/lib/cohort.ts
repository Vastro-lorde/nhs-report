/* ──────────────────────────────────────────
   Cohorts — shared constants & types
   Every user below admin, and every report, belongs to a cohort. A person's
   login (User) is global; their role profile (Mentor, Coordinator, Fellow, …)
   is per cohort, so moving to the next cohort never rewrites history.

   Lifecycle:  setup → active → archived
     • setup     — being prepared by an admin; invisible to everyone else.
     • active    — the live cohort. Exactly one at a time.
     • archived  — a finished cohort; read-only, admins can still browse it.

   Client-safe: no database imports here.
   ────────────────────────────────────────── */

export const CohortStatus = {
  SETUP: "setup",
  ACTIVE: "active",
  ARCHIVED: "archived",
} as const;
export type CohortStatus = (typeof CohortStatus)[keyof typeof CohortStatus];

export const COHORT_STATUSES: readonly CohortStatus[] = [
  CohortStatus.SETUP,
  CohortStatus.ACTIVE,
  CohortStatus.ARCHIVED,
];

export const COHORT_STATUS_LABELS: Record<CohortStatus, string> = {
  setup: "In setup",
  active: "Current",
  archived: "Archived",
};

/** The cohort the platform was already running when cohorts were introduced. */
export const BOOTSTRAP_COHORT_NUMBER = 2;

/**
 * Admin-only cookie selecting which cohort the admin is looking at. Absent →
 * the active cohort. Value is `<cohortId>:<status>` so the middleware can block
 * writes into an archived cohort without a database round-trip; the server
 * re-verifies both the id and the admin role before honouring it.
 */
export const COHORT_VIEW_COOKIE = "nhs_cohort_view";

export function encodeCohortViewCookie(cohortId: string, status: CohortStatus): string {
  return `${cohortId}:${status}`;
}

export function decodeCohortViewCookie(value: string | undefined | null): { cohortId: string; status: string } | null {
  if (!value) return null;
  const [cohortId, status] = value.split(":");
  if (!cohortId || !/^[a-f0-9]{24}$/i.test(cohortId)) return null;
  return { cohortId, status: status ?? "" };
}

/** Roles that live inside a cohort (everyone except admin). */
export const COHORT_ROLES = [
  "coordinator",
  "mentor",
  "zonal_desk_officer",
  "me_officer",
  "team_research_lead",
  "fellow",
] as const;
export type CohortRole = (typeof COHORT_ROLES)[number];

/** Staff roles a person can hold or be moved/promoted into between cohorts. */
export const COHORT_STAFF_ROLES = [
  "coordinator",
  "mentor",
  "zonal_desk_officer",
  "me_officer",
  "team_research_lead",
] as const satisfies readonly CohortRole[];
export type CohortStaffRole = (typeof COHORT_STAFF_ROLES)[number];

export const COHORT_ROLE_LABELS: Record<CohortRole, string> = {
  coordinator: "Zonal Coordinator",
  mentor: "Mentor",
  zonal_desk_officer: "Desk Officer",
  me_officer: "M&E Officer",
  team_research_lead: "Team Research Lead",
  fellow: "Fellow",
};

export function isCohortRole(value: unknown): value is CohortRole {
  return typeof value === "string" && (COHORT_ROLES as readonly string[]).includes(value);
}

export function isCohortStaffRole(value: unknown): value is CohortStaffRole {
  return typeof value === "string" && (COHORT_STAFF_ROLES as readonly string[]).includes(value);
}

/** Public shape of a cohort as returned by the API. */
export interface CohortSummary {
  _id: string;
  number: number;
  name: string;
  status: CohortStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  notes?: string;
  createdAt: string;
  counts?: Partial<Record<CohortRole, number>> & { weeklyReports?: number; fellowMonthlyReports?: number };
}

/** What the current request is looking at, for banners and the switcher. */
export interface CohortContextInfo {
  active: CohortSummary;
  viewing: CohortSummary;
  /** True when an admin is looking at a cohort other than the live one. */
  isViewingOther: boolean;
  readOnly: boolean;
  /** Present for admins only. */
  cohorts?: CohortSummary[];
}
