/**
 * Backfill: widen each mentor's `states` / `lgas` to cover the fellows they
 * actually carry.
 *
 * Mentors frequently take on fellows from LGAs in a second state, but their
 * profile only ever listed the first one. Every state-scoped view in the app —
 * desk-officer visibility, coordinator roll-ups, state filters, the analytics
 * and audit breakdowns — resolves through `Mentor.states`, so those fellows and
 * their reports stay invisible to the second state until the profile catches up.
 *
 * Also reports two classes of data problem it will not guess at:
 *   - fellows whose LGA is not a recognised Nigerian LGA;
 *   - fellows whose LGA name exists in several states (SURULERE: Lagos & Oyo,
 *     OBI: Benue & Nasarawa, BASSA: Kogi & Plateau, IFELODUN / IREPODUN: Kwara &
 *     Osun, NASARAWA: Kano & Nasarawa) while the mentor covers none of them.
 *
 * Dry-run:  node tools/backfill-mentor-states-from-fellows.cjs
 * Apply:    node tools/backfill-mentor-states-from-fellows.cjs --apply
 *
 * Requires MONGODB_URI in your .env (or set it in the environment).
 */

"use strict";

const { MongoClient } = require("mongodb");
const path = require("path");

// Load .env if present
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch {
  try {
    const fs = require("fs");
    const envPath = path.resolve(__dirname, "../.env");
    const lines = fs.readFileSync(envPath, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // no .env file, rely on process.env
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

const statesLgaData = require("../nigerian-states-lga.json");

const norm = (v) => String(v ?? "").trim().toUpperCase();

/**
 * Mirrors getStatesForLGA() in src/lib/constants.ts — keep the two in step.
 * Tolerant matching is required because stored names and the reference dataset
 * disagree on punctuation, state suffixes and abbreviations.
 */
const matchKey = (v) =>
  norm(v)
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/\bLOCAL\s+GOVERNMENT(\s+AREA)?\b/g, " ")
    .replace(/\bL\.?G\.?A\.?\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");

const exactToStates = new Map();
const keyToStates = new Map();
const add = (map, k, state) => {
  if (!k) return;
  const list = map.get(k);
  if (list) {
    if (!list.includes(state)) list.push(state);
  } else {
    map.set(k, [state]);
  }
};

for (const entry of statesLgaData) {
  const state = norm(entry.state);
  for (const lga of entry.lgas) {
    add(exactToStates, norm(lga.name), state);
    add(keyToStates, matchKey(lga.name), state);
  }
}

const allKeys = [...keyToStates.keys()];

/**
 * Alternate spellings and abbreviations seen in real records — mirrors
 * LGA_ALIASES in src/lib/constants.ts. Keep the two in step.
 */
const LGA_ALIASES = {
  BIRNIWA: "Biriniwa",
  EITHOPEEAST: "Ethiope East",
  EITHOPEWEST: "Ethiope West",
  ILELA: "Illela",
  KMC: "Kano Municipal",
  ONAORA: "Ona-Ara",
  WASAGUDANKO: "Danko/Wasagu",
  WATERSIDE: "Ogun Waterside",
  YAKUUR: "Yakurr",
};

const aliasToStates = new Map();
for (const [alias, canonical] of Object.entries(LGA_ALIASES)) {
  const states = keyToStates.get(matchKey(canonical));
  if (states) aliasToStates.set(alias, states);
}


function statesForLga(value) {
  const exact = exactToStates.get(norm(value));
  if (exact) return exact;

  const key = matchKey(value);
  if (!key) return null;

  const normalized = keyToStates.get(key);
  if (normalized) return normalized;


  const aliased = aliasToStates.get(key);
  if (aliased) return aliased;

  if (key.length < 4) return null;
  const prefix = allKeys.filter(
    (c) => c.length >= 4 && (c.startsWith(key) || key.startsWith(c)),
  );
  if (prefix.length !== 1) return null;
  return keyToStates.get(prefix[0]);
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log("Connected.\n");

  try {
    const db = client.db();
    const mentors = await db.collection("mentors").find({}).toArray();
    const fellows = await db.collection("fellows").find({}).toArray();
    const users = await db.collection("users").find({ role: "mentor" }).toArray();
    const nameByAuthId = new Map(users.map((u) => [String(u._id), u.name]));

    const fellowsByMentor = new Map();
    for (const f of fellows) {
      const key = String(f.mentor);
      if (!fellowsByMentor.has(key)) fellowsByMentor.set(key, []);
      fellowsByMentor.get(key).push(f);
    }

    const updates = [];
    const unknownLgas = [];
    const ambiguousLgas = [];

    for (const mentor of mentors) {
      const label = nameByAuthId.get(String(mentor.authId)) || String(mentor._id);
      const declaredStates = [...new Set((mentor.states ?? []).map(norm).filter(Boolean))];
      const declaredLgas = [...new Set((mentor.lgas ?? []).map(norm).filter(Boolean))];

      const addStates = new Set();
      const addLgas = new Set();

      // The mentor's own LGA list can already imply a missing state.
      for (const lga of declaredLgas) {
        const candidates = statesForLga(lga);
        if (!candidates) {
          unknownLgas.push(`${label}: assigned LGA "${lga}" is not a recognised LGA`);
          continue;
        }
        if (candidates.some((s) => declaredStates.includes(s) || addStates.has(s))) continue;
        if (candidates.length === 1) addStates.add(candidates[0]);
        else ambiguousLgas.push(`${label}: assigned LGA "${lga}" exists in ${candidates.join(" and ")}`);
      }

      // Then the fellows they actually carry.
      for (const fellow of fellowsByMentor.get(String(mentor._id)) ?? []) {
        const lga = norm(fellow.lga);
        if (!lga) continue;
        const candidates = statesForLga(lga);
        if (!candidates) {
          unknownLgas.push(`${label}: fellow "${fellow.name}" has LGA "${fellow.lga}" (not recognised)`);
          continue;
        }

        const known = candidates.filter((s) => declaredStates.includes(s) || addStates.has(s));
        if (!known.length) {
          if (candidates.length > 1) {
            ambiguousLgas.push(
              `${label}: fellow "${fellow.name}" is in "${lga}", which exists in ${candidates.join(" and ")} — mentor covers neither`,
            );
            continue;
          }
          addStates.add(candidates[0]);
        }
        if (!declaredLgas.includes(lga)) addLgas.add(lga);
      }

      if (addStates.size || addLgas.size) {
        updates.push({
          _id: mentor._id,
          label,
          currentStates: declaredStates,
          addStates: [...addStates],
          addLgas: [...addLgas],
        });
      }
    }

    if (unknownLgas.length) {
      console.log(`Unrecognised LGAs (${unknownLgas.length}) — fix these by hand:`);
      for (const line of unknownLgas) console.log(`  ${line}`);
      console.log("");
    }

    if (ambiguousLgas.length) {
      console.log(`Ambiguous LGAs (${ambiguousLgas.length}) — add the intended state to the mentor, then re-run:`);
      for (const line of ambiguousLgas) console.log(`  ${line}`);
      console.log("");
    }

    if (!updates.length) {
      console.log("Every mentor already covers the states their fellows are in. Nothing to do.");
      return;
    }

    console.log(`${updates.length} mentor(s) need widened coverage:`);
    for (const u of updates) {
      const states = u.addStates.length ? `+states [${u.addStates.join(", ")}]` : "";
      const lgas = u.addLgas.length ? `+lgas [${u.addLgas.join(", ")}]` : "";
      console.log(`  ${u.label} (currently [${u.currentStates.join(", ") || "none"}]) ${states} ${lgas}`.trimEnd());
    }
    console.log("");

    if (!APPLY) {
      console.log("Re-run with --apply to make these changes.");
      return;
    }

    for (const u of updates) {
      const addToSet = {};
      if (u.addStates.length) addToSet.states = { $each: u.addStates };
      if (u.addLgas.length) addToSet.lgas = { $each: u.addLgas };
      await db.collection("mentors").updateOne({ _id: u._id }, { $addToSet: addToSet });
    }

    console.log(`Updated ${updates.length} mentor(s).`);
    console.log("\nDone.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
