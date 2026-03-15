/* ──────────────────────────────────────────
   Single source of truth: Constants & Enums
   ────────────────────────────────────────── */
// ─── App Constants ──────────────────────────
export const APP_NAME = "CWCR-NHF Mentors Reporting";
export const APP_LOGO_URL = "/logo.png";

// ─── User Roles ─────────────────────────────
export const UserRole = {
  ADMIN: "admin",
  COORDINATOR: "coordinator",
  MENTOR: "mentor",
  ZONAL_DESK_OFFICER: "zonal_desk_officer",
  ME_OFFICER: "me_officer",
  TEAM_RESEARCH_LEAD: "team_research_lead",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// ─── Nigerian States covered by the programme ─
export const STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa",
  "Benue", "Borno", "Cross River", "Delta", "Ebonyi", "Edo",
  "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;
export type State = (typeof STATES)[number];

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

// ─── Week Day Constants ─────────────────────
export const REMINDER_DAY = 5; // Friday (0=Sun, 5=Fri)
export const DIGEST_DAY = 1;   // Monday
