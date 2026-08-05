/* ──────────────────────────────────────────
   Single source of truth: Constants & Enums
   ────────────────────────────────────────── */
// ─── App Constants ──────────────────────────
export const APP_NAME = "CWCR-NHF Mentor Reporting Platform";
/**
 * Public-facing product name. Must match the application name configured on the
 * Google OAuth consent screen so verification passes.
 */
export const APP_PUBLIC_NAME =
  process.env.NEXT_PUBLIC_APP_PUBLIC_NAME || "CWC Research Mentorship Portal";
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

/** Every zone touched by the given states — a mentor or coordinator can straddle zones. */
export function getZonesForStates(states: readonly string[] | null | undefined): string[] {
  const zones = new Set<string>();
  for (const state of states ?? []) {
    const zone = getZoneForState(state);
    if (zone) zones.add(zone);
  }
  return [...zones];
}

// ─── Location normalisation ─────────────────
/** Canonical form used for every stored/compared state or LGA name. */
export function normalizeLocation(value?: string | null): string {
  return (value ?? "").trim().toUpperCase();
}

const stateKeyToName = new Map<string, string>(
  STATE_LGA_DATA.map((entry) => [normalizeLocation(entry.state), entry.state])
);

/** Title-cased state name as it appears in the reference data, or the input unchanged. */
export function displayState(state?: string | null): string {
  const key = normalizeLocation(state);
  return stateKeyToName.get(key) ?? (state ?? "");
}

export function isKnownState(state?: string | null): boolean {
  return stateKeyToName.has(normalizeLocation(state));
}

// ─── LGA → State reverse lookup ─────────────
// LGA names are NOT unique nationwide: SURULERE exists in both Lagos and Oyo,
// OBI in Benue and Nasarawa, BASSA in Kogi and Plateau, IFELODUN/IREPODUN in
// Kwara and Osun, NASARAWA in Kano and Nasarawa. The map therefore records every
// state an LGA name appears in, and callers pass the states they already know
// about (e.g. a mentor's assigned states) so the right one is chosen.
/**
 * Aggressive key for matching LGA names across sources.
 *
 * Stored LGA names come from CSV uploads and hand entry, while the reference
 * dataset holds its own abbreviations, so the same LGA appears as "ABUA/ODUAL",
 * "Abua/Odu", "Akuku-Toru (Rivers)" or "Uvwie Local Government". Dropping the
 * state suffix, the "local government"/"LGA" wording and every non-alphanumeric
 * character reduces them all to one comparable key.
 */
function lgaMatchKey(value?: string | null): string {
  return normalizeLocation(value)
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/\bLOCAL\s+GOVERNMENT(\s+AREA)?\b/g, " ")
    .replace(/\bL\.?G\.?A\.?\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");
}

const lgaToStatesMap = new Map<string, string[]>();
/** Match key → states, used for the tolerant lookup. */
const lgaKeyToStatesMap = new Map<string, string[]>();
/** Match key → the dataset's own spelling, for normalising stored values. */
const lgaKeyToNameMap = new Map<string, string>();

function addLgaState(map: Map<string, string[]>, key: string, state: string) {
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    if (!existing.includes(state)) existing.push(state);
  } else {
    map.set(key, [state]);
  }
}

for (const entry of statesLgaData) {
  const state = normalizeLocation(entry.state as string);
  for (const lga of entry.lgas as Array<{ name: string }>) {
    addLgaState(lgaToStatesMap, normalizeLocation(lga.name), state);
    addLgaState(lgaKeyToStatesMap, lgaMatchKey(lga.name), state);
    const key = lgaMatchKey(lga.name);
    if (key && !lgaKeyToNameMap.has(key)) lgaKeyToNameMap.set(key, lga.name);
  }
}

const lgaMatchKeys = [...lgaKeyToStatesMap.keys()];

/**
 * Alternate spellings, abbreviations and misspellings that appear in real
 * records and cannot be derived by normalisation or prefix matching.
 *
 * Keys are match keys (see `lgaMatchKey`); values are the canonical LGA name in
 * `nigerian-states-lga.json`. Add an entry only for a variant actually observed
 * in the data — `tools/audit-stored-lga-values.cjs` lists anything unresolved.
 */
const LGA_ALIASES: Record<string, string> = {
  BIRNIWA: "Biriniwa", // Jigawa — common short form
  EITHOPEEAST: "Ethiope East", // Delta — misspelling
  EITHOPEWEST: "Ethiope West", // Delta — misspelling
  ILELA: "Illela", // Sokoto — single-l spelling
  KMC: "Kano Municipal", // Kano — "Kano Municipal Council"
  ONAORA: "Ona-Ara", // Oyo — misspelling
  WASAGUDANKO: "Danko/Wasagu", // Kebbi — both orderings are in official use
  WATERSIDE: "Ogun Waterside", // Ogun — short form
  YAKUUR: "Yakurr", // Cross River — misspelling
};

const lgaAliasToStates = new Map<string, string[]>();
for (const [alias, canonical] of Object.entries(LGA_ALIASES)) {
  const states = lgaKeyToStatesMap.get(lgaMatchKey(canonical));
  // A typo in the table itself would silently do nothing, so fail loudly in dev.
  if (!states && process.env.NODE_ENV !== "production") {
    console.warn(`LGA alias "${alias}" points at unknown LGA "${canonical}"`);
  }
  if (states) lgaAliasToStates.set(alias, states);
}

/**
 * Every state the given LGA name exists in (empty when nothing matches).
 *
 * Falls back to prefix matching because the reference dataset abbreviates some
 * names ("IsokoSou" for Isoko South, "AniochaN" for Aniocha North); without it
 * a large share of real, correctly-entered LGAs would resolve to no state.
 */
export function getStatesForLGA(lga?: string | null): string[] {
  const exact = lgaToStatesMap.get(normalizeLocation(lga));
  if (exact) return exact;

  const key = lgaMatchKey(lga);
  if (!key) return [];

  const normalized = lgaKeyToStatesMap.get(key);
  if (normalized) return normalized;

  const aliased = lgaAliasToStates.get(key);
  if (aliased) return aliased;

  // One side is an abbreviation of the other. Require ≥4 characters so short
  // names can't swallow unrelated ones, and ignore anything matching several
  // different LGAs.
  if (key.length < 4) return [];
  const prefixMatches = lgaMatchKeys.filter(
    (candidate) =>
      candidate.length >= 4 && (candidate.startsWith(key) || key.startsWith(candidate))
  );
  if (prefixMatches.length !== 1) return [];

  // A guess must never introduce cross-state ambiguity: "NASARAWA EGGON" once
  // matched the separate, shorter "Nasarawa" LGA and came back as Kano/Nasarawa.
  const prefixStates = lgaKeyToStatesMap.get(prefixMatches[0]) ?? [];
  return prefixStates.length === 1 ? prefixStates : [];
}

/** True when the LGA name exists in more than one state and needs disambiguating. */
export function isAmbiguousLGA(lga?: string | null): boolean {
  return getStatesForLGA(lga).length > 1;
}

export function isKnownLGA(lga?: string | null): boolean {
  return getStatesForLGA(lga).length > 0;
}

/**
 * Resolve the state an LGA belongs to.
 *
 * `candidateStates` (typically a mentor's assigned states) disambiguates names
 * shared by several states. When the LGA is not in any candidate state we still
 * return its real state — a mentor whose `states` list is missing an entry is a
 * data gap, not a reason to mis-attribute the fellow.
 */
export function resolveStateForLGA(
  lga?: string | null,
  candidateStates?: readonly string[] | null
): string | null {
  const matches = getStatesForLGA(lga);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  const candidates = (candidateStates ?? []).map(normalizeLocation).filter(Boolean);
  const narrowed = matches.filter((s) => candidates.includes(s));
  return narrowed[0] ?? matches[0];
}

/**
 * The dataset's own spelling of an LGA, plus the state it resolves to.
 *
 * Use it to normalise user input and stored values so "IKPOBA-OKHA LGA",
 * "ABUA/ODUAL (RIVERS)" and "KALGO LGA, KEBBI STATE" all settle on one form.
 * Returns null when the name cannot be matched at all.
 */
export function resolveCanonicalLGA(
  lga?: string | null,
  candidateStates?: readonly string[] | null
): { name: string; state: string } | null {
  const state = resolveStateForLGA(lga, candidateStates);
  if (!state) return null;

  // Find the dataset entry for the resolved state, so shared names such as
  // SURULERE pick the spelling belonging to the right state.
  const key = lgaMatchKey(lga);
  const direct = lgaKeyToNameMap.get(key);
  if (direct) return { name: direct, state };

  const aliased = LGA_ALIASES[key];
  if (aliased) return { name: aliased, state };

  const prefixMatch = lgaMatchKeys.find(
    (candidate) =>
      candidate.length >= 4 &&
      key.length >= 4 &&
      (candidate.startsWith(key) || key.startsWith(candidate))
  );
  const viaPrefix = prefixMatch ? lgaKeyToNameMap.get(prefixMatch) : undefined;
  return viaPrefix ? { name: viaPrefix, state } : null;
}

/** @deprecated Prefer {@link resolveStateForLGA} and pass the known candidate states. */
export function getStateForLGA(
  lga: string,
  candidateStates?: readonly string[] | null
): string | null {
  return resolveStateForLGA(lga, candidateStates);
}

/**
 * Best-effort state for a fellow / mentee / per-fellow report.
 *
 * The fellow's own LGA is authoritative. Only when the LGA is unknown do we fall
 * back to the mentor — and then only if that mentor works in exactly one state.
 * Mentors spanning several states must never have their fellows silently
 * attributed to `states[0]`.
 */
export function resolveFellowState(
  lga?: string | null,
  mentorStates?: readonly string[] | null
): string | null {
  const fromLga = resolveStateForLGA(lga, mentorStates);
  if (fromLga) return fromLga;

  const states = [...new Set((mentorStates ?? []).map(normalizeLocation).filter(Boolean))];
  return states.length === 1 ? states[0] : null;
}

/**
 * Every state a mentor actually covers: the states recorded on the profile plus
 * any state implied by an assigned LGA (profiles are frequently missing the
 * second state when a mentor picked up LGAs across a border).
 */
export function resolveMentorStates(mentor?: {
  states?: readonly string[] | null;
  lgas?: readonly string[] | null;
} | null): string[] {
  const declared = (mentor?.states ?? []).map(normalizeLocation).filter(Boolean);
  const implied = (mentor?.lgas ?? []).flatMap((lga) => {
    const matches = getStatesForLGA(lga);
    // Only trust an unambiguous LGA to introduce a state the profile omitted.
    return matches.length === 1 ? matches : [];
  });
  return [...new Set([...declared, ...implied])];
}

/** LGAs belonging to the given states, each tagged with the state it came from. */
export function lgasForStates(
  states: readonly string[]
): Array<{ lga: string; state: string }> {
  const wanted = new Set(states.map(normalizeLocation).filter(Boolean));
  const result: Array<{ lga: string; state: string }> = [];
  for (const entry of STATE_LGA_DATA) {
    if (!wanted.has(normalizeLocation(entry.state))) continue;
    for (const lga of entry.lgas) {
      result.push({ lga: lga.name, state: entry.state });
    }
  }
  return result;
}

/** True when the LGA exists inside at least one of the given states. */
export function lgaBelongsToStates(lga: string, states: readonly string[]): boolean {
  const matches = getStatesForLGA(lga);
  if (matches.length === 0) return false;
  const wanted = new Set(states.map(normalizeLocation).filter(Boolean));
  return matches.some((s) => wanted.has(s));
}
