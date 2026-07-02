/* ──────────────────────────────────────────
   Single source of truth: Constants & Enums
   ────────────────────────────────────────── */
// ─── App Constants ──────────────────────────
export const APP_NAME = "CWCR-NHF Mentor Reporting Platform";
/**
 * Public-facing product name. Must match the application name configured on the
 * Google OAuth consent screen so verification passes.
 */
export const APP_PUBLIC_NAME = "CWC Research Mentorship Portal";
export const APP_LOGO_URL = "/logo.png";

// ─── User Roles ─────────────────────────────
export const UserRole = {
  ADMIN: "admin",
  COORDINATOR: "coordinator",
  MENTOR: "mentor",
  ZONAL_DESK_OFFICER: "zonal_desk_officer",
  ME_OFFICER: "me_officer",
  TEAM_RESEARCH_LEAD: "team_research_lead",
  FELLOW: "fellow",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─── Scheduling / Booking ───────────────────
/** Duration of a single mentorship session slot, in minutes. */
export const SESSION_DURATION_MINUTES = 40;
/** Number of weeks ahead that recurring availability is materialized into concrete slots. */
export const SLOT_MATERIALIZATION_WEEKS = 4;

export const FellowInviteStatus = {
  NONE: "none",
  INVITED: "invited",
  ACTIVE: "active",
} as const;
export type FellowInviteStatus = (typeof FellowInviteStatus)[keyof typeof FellowInviteStatus];

export const TimeSlotStatus = {
  OPEN: "open",
  BOOKED: "booked",
  CANCELLED: "cancelled",
} as const;
export type TimeSlotStatus = (typeof TimeSlotStatus)[keyof typeof TimeSlotStatus];

export const TimeSlotSource = {
  TEMPLATE: "template",
  MANUAL: "manual",
} as const;
export type TimeSlotSource = (typeof TimeSlotSource)[keyof typeof TimeSlotSource];

export const BookingStatus = {
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed",
  NO_SHOW: "no_show",
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const NotificationType = {
  SLOTS_PUBLISHED: "slots_published",
  BOOKING_CONFIRMED: "booking_confirmed",
  BOOKING_CANCELLED: "booking_cancelled",
  SESSION_REMINDER: "session_reminder",
  FELLOW_INVITED: "fellow_invited",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// ─── Nigerian States covered by the programme ─
import statesLgaData from "../../nigerian-states-lga.json";
export const STATE_LGA_DATA = statesLgaData as Array<{ state: string; lgas: Array<{ name: string }> }>;
export const STATES = statesLgaData.map((d) => d.state) as unknown as readonly string[];
export type State = string;
export const TOTAL_STATE_ENTITIES = STATE_LGA_DATA.length;
export const TOTAL_NIGERIAN_LGAS = STATE_LGA_DATA.reduce((count, entry) => count + entry.lgas.length, 0);

// ─── Outreach Activity Types ────────────────
export const OUTREACH_TYPES = [
  "Community sensitization",
  "School health talk",
  "Market outreach",
  "Home visits",
  "Radio/media campaign",
  "Religious gathering outreach",
  "Health facility support",
  "WhatsApp/social media campaign",
] as const;

// ─── Common Challenges ─────────────────────
export const CHALLENGE_TYPES = [
  "Transportation difficulties",
  "Low mentee engagement",
  "Lack of materials/supplies",
  "Language barriers",
  "Security concerns",
  "Poor network/connectivity",
  "Community resistance",
  "Health facility access issues",
  "Income/stipend delays",
  "Weather disruptions",
] as const;

// ─── Report Status ──────────────────────────
export const ReportStatus = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  REVIEWED: "reviewed",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

// ─── Alert Status ───────────────────────────
export const AlertStatus = {
  NEW: "new",
  IN_REVIEW: "in_review",
  RESOLVED: "resolved",
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

// ─── Pagination ─────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── Upload ─────────────────────────────────
export const MAX_UPLOAD_SIZE_MB = 10;
export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

// ─── Report History ─────────────────────────
export const ReportHistoryReportType = {
  WEEKLY_REPORT: "WeeklyReport",
  MENTOR_MONTHLY_REPORT: "MentorMonthlyReport",
} as const;
export type ReportHistoryReportType = (typeof ReportHistoryReportType)[keyof typeof ReportHistoryReportType];

export const ReportHistoryAction = {
  CREATED: "created",
  UPDATED: "updated",
  DELETED: "deleted",
} as const;
export type ReportHistoryAction = (typeof ReportHistoryAction)[keyof typeof ReportHistoryAction];

// ─── Week Day Constants ─────────────────────
export const REMINDER_DAY = 5; // Friday (0=Sun, 5=Fri)
export const DIGEST_DAY = 1;   // Monday

// ─── Team Lead Name ─────────────────────────
export const TEAM_LEAD_NAME = "Constant Nosa Olotu";

// ─── Geopolitical Zones ─────────────────────
export const GEOPOLITICAL_ZONES: Record<string, string[]> = {
  "North-Central": ["BENUE", "KOGI", "KWARA", "NASARAWA", "NIGER", "PLATEAU", "FCT"],
  "North-East": ["ADAMAWA", "BAUCHI", "BORNO", "GOMBE", "TARABA", "YOBE"],
  "North-West": ["JIGAWA", "KADUNA", "KANO", "KATSINA", "KEBBI", "SOKOTO", "ZAMFARA"],
  "South-East": ["ABIA", "ANAMBRA", "EBONYI", "ENUGU", "IMO"],
  "South-South": ["AKWA IBOM", "BAYELSA", "CROSS RIVER", "DELTA", "EDO", "RIVERS"],
  "South-West": ["EKITI", "LAGOS", "OGUN", "ONDO", "OSUN", "OYO"],
} as const;

export function getZoneForState(state: string): string | null {
  const upper = state.toUpperCase();
  for (const [zone, states] of Object.entries(GEOPOLITICAL_ZONES)) {
    if (states.includes(upper)) return zone;
  }
  return null;
}

export function getStatesInZone(zoneName: string): string[] {
  return GEOPOLITICAL_ZONES[zoneName] ?? [];
}

// ─── LGA → State reverse lookup ─────────────
const lgaToStateMap = new Map<string, string>();
for (const entry of statesLgaData) {
  const state = (entry.state as string).toUpperCase();
  for (const lga of entry.lgas as Array<{ name: string }>) {
    lgaToStateMap.set(lga.name.toUpperCase(), state);
  }
}

export function getStateForLGA(lga: string): string | null {
  return lgaToStateMap.get(lga.toUpperCase()) ?? null;
}
