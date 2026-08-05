/* ──────────────────────────────────────────
   Service: mentor geographic coverage
   Keeps a mentor's states/LGAs consistent with the fellows they actually carry.
   ────────────────────────────────────────── */
import { Types } from "mongoose";
import { Mentor } from "@/models/Mentor";
import {
  getStatesForLGA,
  isKnownState,
  normalizeLocation,
  resolveStateForLGA,
} from "@/lib/constants";

export interface NormalizedMentorLocations {
  states: string[];
  lgas: string[];
  /** Blocking problems — only ever an unrecognised state. */
  errors: string[];
  /** Non-blocking data-quality notes about the LGAs. */
  warnings: string[];
}

/**
 * Normalise and cross-check the states/LGAs assigned to a mentor.
 *
 * A mentor may be assigned LGAs across several states; an LGA whose state is
 * missing from the list pulls that state in automatically, so coverage matches
 * where the mentor actually works.
 *
 * LGA problems are warnings, never errors. `nigerian-states-lga.json` holds
 * abbreviated and misspelled names ("IsokoSou", "Esan Centtral"), so a name that
 * fails to match is more often a gap in the reference data than bad input, and
 * refusing the save would leave real mentors uneditable.
 */
export function normalizeMentorLocations(
  rawStates: unknown,
  rawLgas: unknown
): NormalizedMentorLocations {
  const errors: string[] = [];
  const warnings: string[] = [];

  const states = [
    ...new Set(
      (Array.isArray(rawStates) ? rawStates : [])
        .map((s) => normalizeLocation(String(s)))
        .filter(Boolean)
    ),
  ];
  for (const state of states) {
    if (!isKnownState(state)) errors.push(`"${state}" is not a recognised Nigerian state.`);
  }

  const lgas = [
    ...new Set(
      (Array.isArray(rawLgas) ? rawLgas : [])
        .map((l) => normalizeLocation(String(l)))
        .filter(Boolean)
    ),
  ];

  for (const lga of lgas) {
    const candidates = getStatesForLGA(lga);
    if (!candidates.length) {
      warnings.push(`"${lga}" could not be matched to a state — reports for it will show as Unknown.`);
      continue;
    }
    if (candidates.some((s) => states.includes(s))) continue;

    if (candidates.length === 1) {
      // The LGA proves the mentor works in a state the profile omitted.
      states.push(candidates[0]);
    } else {
      warnings.push(
        `"${lga}" exists in ${candidates.join(" and ")} — add the intended state so its fellows are counted in the right one.`
      );
    }
  }

  return { states, lgas, errors, warnings };
}

export interface ResolvedFellowLga {
  /** Canonical (uppercase, trimmed) LGA name. */
  lga: string;
  /** The state the LGA belongs to, or null when it could not be matched. */
  state: string | null;
  /** True when the LGA resolves to a state the mentor has not been assigned. */
  outsideMentorStates: boolean;
  /** Set when the name matched no LGA in the reference data. */
  warning?: string;
}

/**
 * Resolve a fellow's LGA to its state.
 *
 * Mentors legitimately carry fellows from LGAs in more than one state, so an LGA
 * outside the mentor's recorded states is accepted and reported — the mentor's
 * profile is usually the thing that is out of date.
 *
 * An unmatched name is accepted too, with `state: null`. The reference dataset
 * is incomplete enough that rejecting would block valid entries; the fellow
 * simply counts as state-unknown until the name or the dataset is corrected.
 * Only a blank LGA is an outright error.
 */
export function resolveFellowLga(
  rawLga: string,
  mentorStates: readonly string[]
): { error: string } | ResolvedFellowLga {
  const lga = normalizeLocation(rawLga);
  if (!lga) return { error: "LGA is required." };

  const states = mentorStates.map(normalizeLocation).filter(Boolean);
  const state = resolveStateForLGA(lga, states);

  if (!state) {
    return {
      lga,
      state: null,
      outsideMentorStates: false,
      warning: `"${rawLga}" could not be matched to a state — this fellow will show as state-unknown in reports.`,
    };
  }

  return {
    lga,
    state,
    outsideMentorStates: states.length > 0 && !states.includes(state),
  };
}

/**
 * Record an LGA (and its state) on the mentor's profile when it is not already
 * there.
 *
 * Every state-scoped query in the app — desk-officer visibility, coordinator
 * roll-ups, state filters — resolves through `Mentor.states`. A mentor who takes
 * on a fellow across a state border would otherwise stay invisible to that
 * state's desk officer, so the coverage is widened to match reality.
 * Ambiguous LGA names only widen coverage when the mentor already works in one
 * of the candidate states.
 */
export async function ensureMentorCoversLga(
  mentorId: Types.ObjectId | string,
  lga: string,
  mentorStates: readonly string[]
): Promise<void> {
  const normalized = normalizeLocation(lga);
  const candidates = getStatesForLGA(normalized);
  if (!candidates.length) return;
  const known = mentorStates.map(normalizeLocation).filter(Boolean);
  // Don't guess: a shared name only extends coverage if we can pin it down.
  if (candidates.length > 1 && !candidates.some((s) => known.includes(s))) return;

  const state = resolveStateForLGA(normalized, known);
  if (!state) return;

  const addToSet: Record<string, string> = { lgas: normalized };
  if (!known.includes(state)) addToSet.states = state;

  await Mentor.updateOne({ _id: mentorId }, { $addToSet: addToSet });
}
