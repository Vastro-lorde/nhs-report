/**
 * Read-only audit: every distinct LGA value stored anywhere in the database,
 * and whether it resolves to a state against the current reference dataset.
 *
 * Use it before and after changing `nigerian-states-lga.json` to prove no
 * stored value stops resolving. Writes nothing.
 *
 *   node tools/audit-stored-lga-values.cjs                  # human-readable
 *   node tools/audit-stored-lga-values.cjs --json out.json  # machine-readable snapshot
 *
 * Requires MONGODB_URI in your .env (or set it in the environment).
 */

"use strict";

const { MongoClient } = require("mongodb");
const fs = require("fs");
const path = require("path");

// Load .env if present
try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch {
  try {
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

const jsonArgIdx = process.argv.indexOf("--json");
const JSON_OUT = jsonArgIdx !== -1 ? process.argv[jsonArgIdx + 1] : null;

const statesLgaData = require("../nigerian-states-lga.json");

const norm = (v) => String(v ?? "").trim().toUpperCase();

// Mirrors getStatesForLGA() in src/lib/constants.ts — keep the two in step.
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


function resolve(value) {
  const exact = exactToStates.get(norm(value));
  if (exact) return { states: exact, how: "exact" };

  const key = matchKey(value);
  if (!key) return null;

  const normalized = keyToStates.get(key);
  if (normalized) return { states: normalized, how: "normalized" };


  const aliased = aliasToStates.get(key);
  if (aliased) return { states: aliased, how: "alias" };

  if (key.length < 4) return null;
  const prefix = allKeys.filter(
    (c) => c.length >= 4 && (c.startsWith(key) || key.startsWith(c)),
  );
  if (prefix.length !== 1) return null;

  // A guess must never introduce cross-state ambiguity.
  const prefixStates = keyToStates.get(prefix[0]);
  if (!prefixStates || prefixStates.length !== 1) return null;
  return { states: prefixStates, how: `prefix:${prefix[0]}` };
}

/** Where LGA values live across the schema. */
async function collect(db) {
  const found = new Map(); // normalised value → { raw, sources: Map<source, count> }

  const note = (raw, source) => {
    const key = norm(raw);
    if (!key) return;
    if (!found.has(key)) found.set(key, { raw: String(raw).trim(), sources: new Map() });
    const sources = found.get(key).sources;
    sources.set(source, (sources.get(source) ?? 0) + 1);
  };

  for (const m of await db.collection("mentors").find({}, { projection: { lgas: 1 } }).toArray()) {
    for (const l of m.lgas ?? []) note(l, "mentors.lgas");
  }
  for (const f of await db.collection("fellows").find({}, { projection: { lga: 1 } }).toArray()) {
    note(f.lga, "fellows.lga");
  }
  for (const r of await db
    .collection("mentormonthlyreports")
    .find({}, { projection: { fellowLGA: 1 } })
    .toArray()) {
    note(r.fellowLGA, "mentormonthlyreports.fellowLGA");
  }
  for (const w of await db
    .collection("weeklyreports")
    .find({}, { projection: { "sessions.menteeLGA": 1, "fellows.lga": 1 } })
    .toArray()) {
    for (const s of w.sessions ?? []) note(s.menteeLGA, "weeklyreports.sessions.menteeLGA");
    for (const f of w.fellows ?? []) note(f.lga, "weeklyreports.fellows.lga");
  }

  return found;
}

async function main() {
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();

  try {
    const found = await collect(client.db());
    const rows = [...found.entries()]
      .map(([key, { raw, sources }]) => {
        const r = resolve(key);
        return {
          value: key,
          raw,
          resolvedTo: r ? r.states.join("/") : null,
          how: r ? r.how : null,
          occurrences: [...sources.values()].reduce((a, b) => a + b, 0),
          sources: [...sources.keys()],
        };
      })
      .sort((a, b) => a.value.localeCompare(b.value));

    const resolved = rows.filter((r) => r.resolvedTo);
    const unresolved = rows.filter((r) => !r.resolvedTo);

    if (JSON_OUT) {
      fs.writeFileSync(JSON_OUT, JSON.stringify(rows, null, 2));
      console.log(`Wrote ${rows.length} distinct LGA values to ${JSON_OUT}`);
    }

    console.log(`Distinct stored LGA values: ${rows.length}`);
    console.log(`  resolve to a state: ${resolved.length}`);
    console.log(`  unresolved:         ${unresolved.length}`);
    console.log("");

    if (unresolved.length) {
      console.log("Unresolved values (occurrences):");
      for (const r of unresolved) {
        console.log(`  ${r.value}  ×${r.occurrences}  [${r.sources.join(", ")}]`);
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
