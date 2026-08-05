/**
 * Normalise every stored LGA value to the reference dataset's own spelling, and
 * drop values that are not LGAs at all.
 *
 * Records accumulated a lot of noise: state suffixes ("ABUA/ODUAL (RIVERS)",
 * "OBI NGWA - ABIA", "KALGO LGA, KEBBI STATE"), the word "LGA"/"Local
 * Government" ("IKPOBA-OKHA LGA", "UVWIE LOCAL GOVERNMENT"), misspellings
 * ("EITHOPE EAST", "YAKUUR", "ONA ORA") and a bare state name in an LGA field
 * ("PLATEAU"). They resolve today only thanks to tolerant matching; writing the
 * canonical name back makes reports read consistently and removes the guesswork.
 *
 * Touches: mentors.lgas, fellows.lga, mentormonthlyreports.fellowLGA,
 *          weeklyreports.sessions[].menteeLGA, weeklyreports.fellows[].lga
 *
 * Dry-run:  node tools/normalize-stored-lga-values.cjs
 * Apply:    node tools/normalize-stored-lga-values.cjs --apply
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
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
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

// Mirrors getStatesForLGA()/resolveCanonicalLGA() in src/lib/constants.ts.
const matchKey = (v) =>
  norm(v)
    .replace(/\(([^)]*)\)/g, " ")
    .replace(/\bLOCAL\s+GOVERNMENT(\s+AREA)?\b/g, " ")
    .replace(/\bL\.?G\.?A\.?\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");

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

const exactToStates = new Map();
const keyToStates = new Map();
const keyToName = new Map();
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
    const k = matchKey(lga.name);
    add(keyToStates, k, state);
    if (k && !keyToName.has(k)) keyToName.set(k, lga.name);
  }
}

const allKeys = [...keyToStates.keys()];

/** → canonical dataset spelling (uppercased, matching how the app stores LGAs). */
function canonical(value) {
  const key = matchKey(value);
  if (!key) return null;

  if (keyToName.has(key)) return norm(keyToName.get(key));
  if (LGA_ALIASES[key]) return norm(LGA_ALIASES[key]);

  if (key.length < 4) return null;
  const prefix = allKeys.filter(
    (c) => c.length >= 4 && (c.startsWith(key) || key.startsWith(c)),
  );
  if (prefix.length !== 1) return null;
  // A guess must never introduce cross-state ambiguity.
  const states = keyToStates.get(prefix[0]);
  if (!states || states.length !== 1) return null;
  return norm(keyToName.get(prefix[0]));
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`);
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();

  try {
    const db = client.db();
    const changes = [];
    const dropped = [];
    const ops = { mentors: [], fellows: [], monthly: [], weekly: [] };

    // ── mentors.lgas ────────────────────────────────────────────────
    for (const m of await db.collection("mentors").find({}, { projection: { lgas: 1 } }).toArray()) {
      const before = m.lgas ?? [];
      const after = [];
      for (const raw of before) {
        const c = canonical(raw);
        if (!c) {
          dropped.push(`mentors/${m._id}: "${raw}" is not an LGA — removed`);
          continue;
        }
        if (!after.includes(c)) after.push(c);
        if (norm(raw) !== c) changes.push(`mentors/${m._id}: "${raw}" → "${c}"`);
      }
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        ops.mentors.push({ updateOne: { filter: { _id: m._id }, update: { $set: { lgas: after } } } });
      }
    }

    // ── fellows.lga ─────────────────────────────────────────────────
    for (const f of await db.collection("fellows").find({}, { projection: { lga: 1 } }).toArray()) {
      const c = canonical(f.lga);
      // Never blank out a fellow's LGA: an unmatched value is better kept for a
      // human to correct than silently erased.
      if (!c || c === norm(f.lga)) continue;
      changes.push(`fellows/${f._id}: "${f.lga}" → "${c}"`);
      ops.fellows.push({ updateOne: { filter: { _id: f._id }, update: { $set: { lga: c } } } });
    }

    // ── mentormonthlyreports.fellowLGA ──────────────────────────────
    for (const r of await db
      .collection("mentormonthlyreports")
      .find({}, { projection: { fellowLGA: 1 } })
      .toArray()) {
      const c = canonical(r.fellowLGA);
      if (!c || c === norm(r.fellowLGA)) continue;
      changes.push(`mentormonthlyreports/${r._id}: "${r.fellowLGA}" → "${c}"`);
      ops.monthly.push({ updateOne: { filter: { _id: r._id }, update: { $set: { fellowLGA: c } } } });
    }

    // ── weeklyreports.sessions[].menteeLGA + fellows[].lga ──────────
    for (const w of await db
      .collection("weeklyreports")
      .find({}, { projection: { sessions: 1, fellows: 1 } })
      .toArray()) {
      const set = {};
      (w.sessions ?? []).forEach((s, i) => {
        const c = canonical(s.menteeLGA);
        if (c && c !== norm(s.menteeLGA)) {
          set[`sessions.${i}.menteeLGA`] = c;
          changes.push(`weeklyreports/${w._id} sessions[${i}]: "${s.menteeLGA}" → "${c}"`);
        }
      });
      (w.fellows ?? []).forEach((f, i) => {
        const c = canonical(f.lga);
        if (c && c !== norm(f.lga)) {
          set[`fellows.${i}.lga`] = c;
          changes.push(`weeklyreports/${w._id} fellows[${i}]: "${f.lga}" → "${c}"`);
        }
      });
      if (Object.keys(set).length) {
        ops.weekly.push({ updateOne: { filter: { _id: w._id }, update: { $set: set } } });
      }
    }

    const total = ops.mentors.length + ops.fellows.length + ops.monthly.length + ops.weekly.length;

    if (dropped.length) {
      console.log(`Values removed as not-an-LGA (${dropped.length}):`);
      for (const d of dropped) console.log(`  ${d}`);
      console.log("");
    }

    // Summarise rather than print thousands of identical rewrites.
    const summary = new Map();
    for (const c of changes) {
      const m = c.match(/"([^"]+)" → "([^"]+)"/);
      if (!m) continue;
      const k = `${m[1]} → ${m[2]}`;
      summary.set(k, (summary.get(k) ?? 0) + 1);
    }
    console.log(`Distinct rewrites (${summary.size}), ${changes.length} field(s) total:`);
    for (const [k, n] of [...summary.entries()].sort()) console.log(`  ${k}  ×${n}`);
    console.log("");
    console.log(
      `Documents to update — mentors: ${ops.mentors.length}, fellows: ${ops.fellows.length}, ` +
        `monthly reports: ${ops.monthly.length}, weekly reports: ${ops.weekly.length}`,
    );

    if (!APPLY) {
      console.log("\nDry run — re-run with --apply to write these changes.");
      return;
    }
    if (!total) {
      console.log("\nNothing to do.");
      return;
    }

    if (ops.mentors.length) await db.collection("mentors").bulkWrite(ops.mentors);
    if (ops.fellows.length) await db.collection("fellows").bulkWrite(ops.fellows);
    if (ops.monthly.length) await db.collection("mentormonthlyreports").bulkWrite(ops.monthly);
    if (ops.weekly.length) await db.collection("weeklyreports").bulkWrite(ops.weekly);

    console.log(`\nUpdated ${total} document(s).`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
