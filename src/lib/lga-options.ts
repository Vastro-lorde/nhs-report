/* ──────────────────────────────────────────
   LGA option lists for mentor-facing pickers
   ────────────────────────────────────────── */
import { getStatesForLGA, lgasForStates, normalizeLocation } from "@/lib/constants";

export interface LgaOption {
  /** Display text — carries the state, since LGA names repeat across states. */
  label: string;
  /** Stored value — the bare LGA name, matching Fellow.lga / menteeLGA. */
  value: string;
  /** State(s) this option belongs to. */
  states: string[];
}

/**
 * Build the LGA choices a mentor may assign a fellow to.
 *
 * Mentors frequently cover LGAs in more than one state, and their profile often
 * lists LGAs for only one of them. Restricting the picker to `lgas` alone then
 * leaves them unable to record a fellow from the other state at all, so every
 * assigned state that contributed no LGA falls back to its full LGA list.
 *
 * Labels always name the state: without it "SURULERE" or "OBI" is ambiguous.
 */
export function buildMentorLgaOptions(
  lgas: readonly string[] | null | undefined,
  states: readonly string[] | null | undefined
): LgaOption[] {
  const assignedStates = [...new Set((states ?? []).map(normalizeLocation).filter(Boolean))];
  const assignedLgas = [...new Set((lgas ?? []).map(normalizeLocation).filter(Boolean))];

  const options: LgaOption[] = [];
  const seen = new Set<string>();
  const coveredStates = new Set<string>();

  for (const lga of assignedLgas) {
    const all = getStatesForLGA(lga);
    // Prefer the mentor's own states when the name exists in several.
    const narrowed = all.filter((s) => assignedStates.includes(s));
    const lgaStates = narrowed.length ? narrowed : all;
    lgaStates.forEach((s) => coveredStates.add(s));

    if (seen.has(lga)) continue;
    seen.add(lga);
    options.push({
      label: lgaStates.length ? `${lga} — ${lgaStates.join(" / ")}` : lga,
      value: lga,
      states: lgaStates,
    });
  }

  for (const state of assignedStates) {
    if (coveredStates.has(state)) continue;
    for (const { lga, state: stateName } of lgasForStates([state])) {
      const value = normalizeLocation(lga);
      if (seen.has(value)) continue;
      seen.add(value);
      options.push({
        label: `${value} — ${normalizeLocation(stateName)}`,
        value,
        states: [normalizeLocation(stateName)],
      });
    }
  }

  return options.sort((a, b) => a.label.localeCompare(b.label));
}

/** Ready-to-spread options for a `<Select>`, including the empty placeholder. */
export function mentorLgaSelectOptions(
  lgas: readonly string[] | null | undefined,
  states: readonly string[] | null | undefined,
  placeholder = "Select LGA"
): Array<{ label: string; value: string }> {
  return [
    { label: placeholder, value: "" },
    ...buildMentorLgaOptions(lgas, states).map(({ label, value }) => ({ label, value })),
  ];
}
