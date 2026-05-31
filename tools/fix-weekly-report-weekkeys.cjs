/**
 * Recovery: re-derive WeeklyReport.weekKey from weekEnding.
 *
 * Dry-run:  node tools/fix-weekly-report-weekkeys.cjs
 * Apply:    node tools/fix-weekly-report-weekkeys.cjs --apply
 */

"use strict";

const { MongoClient } = require("mongodb");
const path = require("path");

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
    // no .env file
  }
}

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI is not set. Aborting.");
  process.exit(1);
}

const APPLY = process.argv.includes("--apply");

async function main() {
  const { startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear } =
    await import("date-fns");

  const isoWeekKey = (date) => {
    const d = startOfISOWeek(date);
    const year = getISOWeekYear(d);
    const week = getISOWeek(d);
    return `${year}-W${String(week).padStart(2, "0")}`;
  };

  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log("Connected.\n");

  const db = client.db();
  const col = db.collection("weeklyreports");

  const total = await col.countDocuments();
  console.log(`Total weekly reports: ${total}`);
  console.log("Loading all docs into memory...");

  const docs = await col
    .find({}, { projection: { _id: 1, mentor: 1, weekKey: 1, weekEnding: 1 } })
    .toArray();
  console.log(`Loaded ${docs.length} docs.\n`);

  const byMentorKey = new Map();
  for (const d of docs) {
    const m = String(d.mentor);
    if (!byMentorKey.has(m)) byMentorKey.set(m, new Map());
    byMentorKey.get(m).set(d.weekKey, d._id);
  }

  let scanned = 0;
  let badDate = 0;
  let inSync = 0;
  const fixable = [];
  const conflicts = [];

  for (const doc of docs) {
    scanned++;
    if (scanned % 500 === 0) console.log(`  ...scanned ${scanned}/${docs.length}`);

    const we = doc.weekEnding ? new Date(doc.weekEnding) : null;
    if (!we || isNaN(we.getTime())) {
      badDate++;
      console.log(`  invalid weekEnding on ${doc._id}: ${doc.weekEnding}`);
      continue;
    }

    const correctEnding = endOfISOWeek(we);
    const correctKey = isoWeekKey(we);

    if (doc.weekKey === correctKey) {
      inSync++;
      continue;
    }

    const mentorKey = String(doc.mentor);
    const owner = byMentorKey.get(mentorKey)?.get(correctKey);
    const entry = {
      _id: doc._id,
      mentor: doc.mentor,
      currentKey: doc.weekKey,
      correctKey,
      currentEnding: doc.weekEnding,
      correctEnding,
    };

    if (owner && String(owner) !== String(doc._id)) {
      conflicts.push({ ...entry, conflictWith: owner });
    } else {
      fixable.push(entry);
    }
  }

  console.log("\n-- Summary --");
  console.log(`Scanned:        ${scanned}`);
  console.log(`In sync:        ${inSync}`);
  console.log(`Invalid dates:  ${badDate}`);
  console.log(`Fixable:        ${fixable.length}`);
  console.log(`Conflicts:      ${conflicts.length}`);

  if (fixable.length) {
    console.log("\n-- Fixable rows --");
    for (const r of fixable) {
      console.log(`  ${r._id}  mentor=${r.mentor}  ${r.currentKey} -> ${r.correctKey}`);
    }
  }

  if (conflicts.length) {
    console.log("\n-- Conflicts (NOT fixed) --");
    for (const r of conflicts) {
      console.log(
        `  ${r._id}  mentor=${r.mentor}  wants ${r.correctKey} but ${r.conflictWith} already owns it`,
      );
    }
  }

  if (APPLY && fixable.length) {
    console.log("\n-- Applying fixes --");
    let updated = 0;
    for (const r of fixable) {
      const res = await col.updateOne(
        { _id: r._id },
        { $set: { weekKey: r.correctKey, weekEnding: r.correctEnding } },
      );
      if (res.modifiedCount === 1) updated++;
    }
    console.log(`Updated ${updated}/${fixable.length} rows.`);
  } else if (fixable.length) {
    console.log("\nDry-run only. Re-run with --apply to commit changes.");
  }

  await client.close();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
