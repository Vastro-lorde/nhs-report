/* ──────────────────────────────────────────
   Mongoose plugin: cohort scoping
   Applied to every model whose records belong to a cohort. It
     • adds an indexed `cohort` field,
     • stamps the current cohort onto new records (save / insertMany /
       bulkWrite / upsert),
     • narrows every query, update, delete and aggregate to the current cohort,
     • refuses writes while an admin is browsing an archived cohort.

   Any operation whose filter already names `cohort` is left untouched — that
   is how cohort-aware code (the cohort wizard, login) reaches across cohorts.
   ────────────────────────────────────────── */
import { Schema, type Query, type Aggregate, type PipelineStage } from "mongoose";
import {
  CohortReadOnlyError,
  cohortFilterValue,
  registerCohortScopedModel,
  resolveCohortScope,
  type CohortScope,
} from "@/lib/cohort-scope";

const READ_OPS = ["find", "findOne", "countDocuments", "distinct"] as const;
const WRITE_OPS = [
  "updateOne",
  "updateMany",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndUpdate",
  "findOneAndReplace",
  "findOneAndDelete",
] as const;
const REPLACE_OPS = new Set<string>(["replaceOne", "findOneAndReplace"]);
const UPSERTABLE_OPS = new Set<string>(["updateOne", "updateMany", "replaceOne", "findOneAndUpdate", "findOneAndReplace"]);
/** Aggregation stages that must stay first in a pipeline. */
const LEADING_STAGES = ["$geoNear", "$search", "$searchMeta", "$vectorSearch", "$collStats", "$indexStats"];

type AnyRecord = Record<string, unknown>;

/** Does a filter already constrain `cohort` (top level or inside $and/$or/$nor)? */
export function filterMentionsCohort(filter: unknown): boolean {
  if (!filter || typeof filter !== "object") return false;
  const f = filter as AnyRecord;
  if ("cohort" in f) return true;
  for (const op of ["$and", "$or", "$nor"]) {
    const branch = f[op];
    if (Array.isArray(branch) && branch.some(filterMentionsCohort)) return true;
  }
  return false;
}

function updateSetsCohort(update: AnyRecord): boolean {
  if ("cohort" in update) return true;
  for (const op of ["$set", "$setOnInsert"]) {
    const part = update[op];
    if (part && typeof part === "object" && "cohort" in (part as AnyRecord)) return true;
  }
  return false;
}

/**
 * For upserts in the live cohort the filter is `{ $in: [id, null] }`, which
 * MongoDB can't copy onto the inserted document — so stamp it explicitly.
 */
function stampUpsert(op: string, update: unknown, scope: CohortScope): unknown {
  if (!scope.isActive || !update || typeof update !== "object" || Array.isArray(update)) return update;
  const u = { ...(update as AnyRecord) };
  if (REPLACE_OPS.has(op)) {
    if (u.cohort == null) u.cohort = scope.cohortId;
    return u;
  }
  if (updateSetsCohort(u)) return u;
  u.$setOnInsert = { ...((u.$setOnInsert as AnyRecord | undefined) ?? {}), cohort: scope.cohortId };
  return u;
}

export function cohortScopePlugin(schema: Schema, options: { modelName: string }) {
  registerCohortScopedModel(options.modelName);

  schema.add({ cohort: { type: Schema.Types.ObjectId, ref: "Cohort", index: true } });

  /* ── Queries, updates and deletes ── */
  schema.pre(
    [...READ_OPS, ...WRITE_OPS],
    { document: false, query: true },
    async function (this: Query<unknown, unknown>) {
      if (filterMentionsCohort(this.getFilter())) return;
      const scope = await resolveCohortScope();
      if (scope === "all") return;

      // `op` is set on every Query at runtime but missing from the typings.
      const op = String((this as unknown as { op?: string }).op ?? "");
      const isWrite = (WRITE_OPS as readonly string[]).includes(op);
      if (isWrite && scope.readOnly) throw new CohortReadOnlyError();

      this.where({ cohort: cohortFilterValue(scope) });

      if (isWrite && UPSERTABLE_OPS.has(op) && this.getOptions().upsert) {
        this.setUpdate(stampUpsert(op, this.getUpdate(), scope) as never);
      }
    },
  );

  /* ── New documents (create / save) and edits to loaded documents ── */
  schema.pre("save", async function () {
    const stamped = this.get("cohort");
    if (stamped && !this.isNew) {
      // Editing a loaded record: only refuse when browsing an archived cohort.
      const scope = await resolveCohortScope();
      if (scope !== "all" && scope.readOnly) throw new CohortReadOnlyError();
      return;
    }
    if (stamped) return; // explicitly placed in a cohort by the caller
    const scope = await resolveCohortScope();
    if (scope === "all") return;
    if (scope.readOnly) throw new CohortReadOnlyError();
    this.set("cohort", scope.cohortId);
  });

  /* ── insertMany ── */
  schema.pre("insertMany", async function (_docs: unknown) {
    const docs = (Array.isArray(_docs) ? _docs : [_docs]) as AnyRecord[];
    if (docs.every((d) => d && d.cohort)) return;
    const scope = await resolveCohortScope();
    if (scope === "all") return;
    if (scope.readOnly) throw new CohortReadOnlyError();
    for (const d of docs) {
      if (d && !d.cohort) d.cohort = scope.cohortId;
    }
  });

  /* ── bulkWrite ── */
  schema.pre("bulkWrite", async function (ops) {
    if (!ops.length) return;
    let scope: Awaited<ReturnType<typeof resolveCohortScope>> | undefined;
    const getScope = async () => (scope ??= await resolveCohortScope());

    for (const raw of ops as unknown as AnyRecord[]) {
      if (raw.insertOne) {
        const spec = raw.insertOne as { document: AnyRecord };
        if (spec.document?.cohort) continue;
        const s = await getScope();
        if (s === "all") continue;
        if (s.readOnly) throw new CohortReadOnlyError();
        spec.document.cohort = s.cohortId;
        continue;
      }
      for (const kind of ["updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany"] as const) {
        const spec = raw[kind] as
          | { filter?: AnyRecord; update?: unknown; replacement?: AnyRecord; upsert?: boolean }
          | undefined;
        if (!spec || filterMentionsCohort(spec.filter)) continue;
        const s = await getScope();
        if (s === "all") continue;
        if (s.readOnly) throw new CohortReadOnlyError();
        spec.filter = { ...(spec.filter ?? {}), cohort: cohortFilterValue(s) };
        if (spec.upsert && s.isActive) {
          if (kind === "replaceOne" && spec.replacement && spec.replacement.cohort == null) {
            spec.replacement.cohort = s.cohortId;
          } else if (kind === "updateOne" || kind === "updateMany") {
            spec.update = stampUpsert(kind, spec.update, s);
          }
        }
      }
    }
  });

  /* ── Aggregations ── */
  schema.pre("aggregate", async function (this: Aggregate<unknown>) {
    const pipeline = this.pipeline() as PipelineStage[];
    const first = pipeline[0] as unknown as AnyRecord | undefined;
    if (first && "$match" in first && filterMentionsCohort(first.$match)) return;
    const scope = await resolveCohortScope();
    if (scope === "all") return;
    const match = { $match: { cohort: cohortFilterValue(scope) } } as PipelineStage;
    const leadIdx = first && LEADING_STAGES.some((s) => s in first) ? 1 : 0;
    pipeline.splice(leadIdx, 0, match);
  });
}
