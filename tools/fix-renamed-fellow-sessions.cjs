/**
 * Repair weekly-report sessions whose menteeName no longer matches a fellow
 * (usually because the fellow was renamed after the report was filed). Such a
 * fellow shows up twice on the mentor's Fellow Session Ranking.
 *
 * Audit every mentor (read-only):
 *   node tools/fix-renamed-fellow-sessions.cjs
 *
 * Merge a stale name into a fellow (dry-run, then apply):
 *   node tools/fix-renamed-fellow-sessions.cjs --fellow <fellowId> --from "Old Name"
 *   node tools/fix-renamed-fellow-sessions.cjs --fellow <fellowId> --from "Old Name" --apply
 */

"use strict";

const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");

try {
  require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
} catch {
  try {
    const fs = require("fs");
    const lines = fs.readFileSync(path.resolve(__dirname, "../.env"), "utf8").split("\n");
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

function arg(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}
const APPLY = process.argv.includes("--apply");
const FELLOW_ID = arg("--fellow");
const FROM = arg("--from");

const norm = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
const tokens = (s) => new Set(norm(s).split(" ").filter(Boolean));
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const nameRegex = (s) =>
  new RegExp(`^\\s*${s.trim().split(/\s+/).map(escapeRegex).join("\\s+")}\\s*$`, "i");

async function audit(db) {
  const fellows = await db.collection("fellows").find({}, { projection: { name: 1, mentor: 1 } }).toArray();
  const byMentor = new Map();
  for (const f of fellows) {
    const k = String(f.mentor);
    if (!byMentor.has(k)) byMentor.set(k, []);
    byMentor.get(k).push(f);
  }

  const rows = await db
    .collection("weeklyreports")
    .aggregate([
      { $unwind: "$sessions" },
      { $group: { _id: { mentor: "$mentor", name: "$sessions.menteeName" }, sessions: { $sum: 1 } } },
    ])
    .toArray();

  let orphans = 0;
  for (const r of rows) {
    const mentorFellows = byMentor.get(String(r._id.mentor)) || [];
    if (mentorFellows.some((f) => norm(f.name) === norm(r._id.name))) continue;
    orphans++;
    const t = tokens(r._id.name);
    const candidates = mentorFellows.filter((f) => {
      const ft = tokens(f.name);
      const [small, big] = t.size <= ft.size ? [t, ft] : [ft, t];
      return small.size > 0 && [...small].every((x) => big.has(x));
    });
    console.log(
      `mentor ${r._id.mentor}  "${r._id.name}"  (${r.sessions} session${r.sessions === 1 ? "" : "s"})` +
        (candidates.length
          ? `  -> likely ${candidates.map((c) => `"${c.name}" [${c._id}]`).join(", ")}`
          : "  -> no matching fellow")
    );
  }
  console.log(`\n${orphans} unmatched session name(s).`);
}

async function merge(db) {
  const fellow = await db.collection("fellows").findOne({ _id: new ObjectId(FELLOW_ID) });
  if (!fellow) throw new Error(`Fellow ${FELLOW_ID} not found`);
  const rx = nameRegex(FROM);
  const filter = { mentor: fellow.mentor, "sessions.menteeName": rx };

  const reports = await db
    .collection("weeklyreports")
    .find(filter, { projection: { weekKey: 1, status: 1, "sessions.menteeName": 1 } })
    .toArray();
  let count = 0;
  for (const r of reports) {
    for (const s of r.sessions) {
      if (rx.test(s.menteeName)) {
        count++;
        console.log(`  report ${r._id} ${r.weekKey} (${r.status}): "${s.menteeName}" -> "${fellow.name}"`);
      }
    }
  }
  console.log(`${count} session(s) in ${reports.length} report(s) to rename to "${fellow.name}".`);

  if (!APPLY) {
    console.log("Dry run. Re-run with --apply to write.");
    return;
  }
  const res = await db
    .collection("weeklyreports")
    .updateMany(filter, { $set: { "sessions.$[s].menteeName": fellow.name } }, { arrayFilters: [{ "s.menteeName": rx }] });
  console.log(`Applied: ${res.modifiedCount} report(s) updated.`);
}

(async () => {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  try {
    const db = client.db();
    if (FELLOW_ID || FROM) {
      if (!FELLOW_ID || !FROM) throw new Error("--fellow and --from must be given together");
      await merge(db);
    } else {
      await audit(db);
    }
  } finally {
    await client.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
