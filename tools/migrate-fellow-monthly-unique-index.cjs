/**
 * Migration: fellow monthly reports are now unique per fellow + month (the
 * "yyyy-MM" key carries the year), instead of per mentor + fellow + month.
 *
 * Drops the old `mentor_1_fellow_1_month_1` unique index and creates
 * `fellow_1_month_1` unique. Reports any fellow+month that already has more
 * than one document — those must be resolved by hand before the new index
 * can be built.
 *
 * Dry-run:  node tools/migrate-fellow-monthly-unique-index.cjs
 * Apply:    node tools/migrate-fellow-monthly-unique-index.cjs --apply
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
const OLD_INDEX = "mentor_1_fellow_1_month_1";
const NEW_INDEX = "fellow_1_month_1";

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
  console.log("Connecting to MongoDB...");
  const client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  await client.connect();
  console.log("Connected.\n");

  try {
    const col = client.db().collection("mentormonthlyreports");

    const indexes = await col.indexes();
    console.log("Existing indexes:");
    for (const ix of indexes) {
      console.log(`  ${ix.name}${ix.unique ? " (unique)" : ""}`);
    }
    console.log("");

    // ── Duplicates that would block the new unique index ──
    const duplicates = await col
      .aggregate([
        { $group: { _id: { fellow: "$fellow", month: "$month" }, count: { $sum: 1 }, ids: { $push: "$_id" }, mentors: { $push: "$mentor" }, names: { $push: "$fellowName" } } },
        { $match: { count: { $gt: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    if (duplicates.length) {
      console.log(`Found ${duplicates.length} fellow+month group(s) with more than one report:`);
      for (const d of duplicates) {
        console.log(
          `  ${d.names[0] || d._id.fellow} · ${d._id.month} → ${d.count} reports: ${d.ids
            .map(String)
            .join(", ")} (mentors: ${d.mentors.map(String).join(", ")})`,
        );
      }
      console.log(
        "\nResolve these first (keep one report per fellow+month), then re-run. Aborting.",
      );
      return;
    }
    console.log("No fellow+month duplicates found.\n");

    const hasOld = indexes.some((ix) => ix.name === OLD_INDEX);
    const hasNew = indexes.some((ix) => ix.name === NEW_INDEX);

    if (!APPLY) {
      console.log("Would apply:");
      console.log(hasOld ? `  drop index ${OLD_INDEX}` : `  (no ${OLD_INDEX} index to drop)`);
      console.log(hasNew ? `  (${NEW_INDEX} already exists)` : `  create unique index ${NEW_INDEX}`);
      console.log("\nRe-run with --apply to make these changes.");
      return;
    }

    if (hasOld) {
      await col.dropIndex(OLD_INDEX);
      console.log(`Dropped ${OLD_INDEX}.`);
    } else {
      console.log(`${OLD_INDEX} not present — nothing to drop.`);
    }

    if (hasNew) {
      console.log(`${NEW_INDEX} already exists.`);
    } else {
      await col.createIndex({ fellow: 1, month: 1 }, { unique: true, name: NEW_INDEX });
      console.log(`Created unique ${NEW_INDEX}.`);
    }

    console.log("\nDone.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
