/* ──────────────────────────────────────────
   Cohort scope — server only
   Decides which cohort a database operation belongs to. Read by the cohort
   plugin (lib/cohort-plugin.ts) on every query/write of a cohort-scoped model,
   so route handlers stay cohort-unaware by default.

   Resolution order:
     1. An explicit scope set with runInCohort() / runAcrossCohorts().
     2. An admin's "view cohort" cookie — re-verified here (admin role + real
        cohort). Archived cohorts are read-only; setup cohorts are writable.
     3. The active cohort.

   On first use against a database with no cohorts, the platform's existing
   data is adopted as Cohort 2 (see bootstrapCohorts()).
   ────────────────────────────────────────── */
import { AsyncLocalStorage } from "node:async_hooks";
import mongoose, { Types } from "mongoose";
import { Cohort } from "@/models/Cohort";
import {
  BOOTSTRAP_COHORT_NUMBER,
  COHORT_VIEW_COOKIE,
  CohortStatus,
  decodeCohortViewCookie,
} from "@/lib/cohort";

export interface CachedCohort {
  _id: Types.ObjectId;
  number: number;
  name: string;
  status: CohortStatus;
}

export interface CohortScope {
  cohortId: Types.ObjectId;
  status: CohortStatus;
  /** The live cohort — legacy records with no cohort stamp also belong here. */
  isActive: boolean;
  /** Archived cohorts can be browsed but never written to. */
  readOnly: boolean;
}

/** "all" disables scoping entirely (maintenance code only). */
export type ResolvedScope = CohortScope | "all";

export class CohortReadOnlyError extends Error {
  readonly status = 423;
  constructor() {
    super("This cohort is archived and read-only. Switch back to the current cohort to make changes.");
    this.name = "CohortReadOnlyError";
  }
}

/* ── Registry of cohort-scoped models (filled by the plugin) ───────────── */
const scopedModelNames = new Set<string>();
export function registerCohortScopedModel(name: string) {
  scopedModelNames.add(name);
}
export function getCohortScopedModelNames(): string[] {
  return [...scopedModelNames];
}

/* ── Explicit scopes ───────────────────────────────────────────────────── */
const scopeStorage = new AsyncLocalStorage<{ scope: ResolvedScope }>();

export function toScope(cohort: { _id: Types.ObjectId | string; status: CohortStatus }, opts?: { allowArchivedWrites?: boolean }): CohortScope {
  return {
    cohortId: new Types.ObjectId(String(cohort._id)),
    status: cohort.status,
    isActive: cohort.status === CohortStatus.ACTIVE,
    readOnly: cohort.status === CohortStatus.ARCHIVED && !opts?.allowArchivedWrites,
  };
}

/** Run `fn` with every cohort-scoped operation pinned to `cohort`. */
// Mongoose queries are lazy thenables: if `fn` returns one un-awaited it would
// execute *after* leaving the scope. Awaiting inside run() keeps it pinned.
export function runInCohort<T>(
  cohort: { _id: Types.ObjectId | string; status: CohortStatus },
  fn: () => PromiseLike<T> | T,
  opts?: { allowArchivedWrites?: boolean },
): Promise<T> {
  return scopeStorage.run({ scope: toScope(cohort, opts) }, async () => await fn());
}

/** Run `fn` with cohort scoping switched off (cross-cohort maintenance only). */
export function runAcrossCohorts<T>(fn: () => PromiseLike<T> | T): Promise<T> {
  return scopeStorage.run({ scope: "all" }, async () => await fn());
}

/** Filter value selecting a scope's records. */
export function cohortFilterValue(scope: CohortScope): Types.ObjectId | { $in: (Types.ObjectId | null)[] } {
  // Records written before cohorts existed (or by an instance still running
  // the previous build) carry no stamp; they belong to the live cohort. They
  // are stamped onto the outgoing cohort before any new cohort goes live.
  return scope.isActive ? { $in: [scope.cohortId, null] } : scope.cohortId;
}

/* ── Active cohort (cached per server instance) ────────────────────────── */
const ACTIVE_TTL_MS = 15_000;
let activeCache: { value: CachedCohort; at: number } | null = null;
let activeInflight: Promise<CachedCohort> | null = null;
const byIdCache = new Map<string, { value: CachedCohort | null; at: number }>();

export function invalidateCohortCache() {
  activeCache = null;
  activeInflight = null;
  byIdCache.clear();
}

function toCached(doc: { _id: unknown; number: number; name: string; status: CohortStatus }): CachedCohort {
  return { _id: new Types.ObjectId(String(doc._id)), number: doc.number, name: doc.name, status: doc.status };
}

export async function getActiveCohort(): Promise<CachedCohort> {
  if (activeCache && Date.now() - activeCache.at < ACTIVE_TTL_MS) return activeCache.value;
  if (!activeInflight) {
    activeInflight = (async () => {
      try {
        // During activation the incoming cohort is switched on before the
        // outgoing one is archived, so prefer the newest active cohort.
        let doc = await Cohort.findOne({ status: CohortStatus.ACTIVE }).sort({ number: -1 }).lean();
        if (!doc) doc = await bootstrapCohorts();
        const value = toCached(doc);
        activeCache = { value, at: Date.now() };
        return value;
      } finally {
        activeInflight = null;
      }
    })();
  }
  return activeInflight;
}

export async function getCohortById(id: string | Types.ObjectId): Promise<CachedCohort | null> {
  const key = String(id);
  const hit = byIdCache.get(key);
  if (hit && Date.now() - hit.at < ACTIVE_TTL_MS) return hit.value;
  if (!Types.ObjectId.isValid(key)) return null;
  const doc = await Cohort.findById(key).select("number name status").lean();
  const value = doc ? toCached(doc) : null;
  byIdCache.set(key, { value, at: Date.now() });
  return value;
}

/* ── Admin "view cohort" selection (per request) ───────────────────────── */
const viewMemo = new WeakMap<object, Promise<CohortScope | null>>();

async function readAdminViewScope(): Promise<CohortScope | null> {
  let cookieStore: Awaited<ReturnType<typeof import("next/headers").cookies>>;
  try {
    const { cookies } = await import("next/headers");
    cookieStore = await cookies();
  } catch {
    return null; // outside a request (scripts, background work)
  }
  const parsed = decodeCohortViewCookie(cookieStore.get(COHORT_VIEW_COOKIE)?.value);
  if (!parsed) return null;

  const memo = viewMemo.get(cookieStore);
  if (memo) return memo;

  const pending = (async (): Promise<CohortScope | null> => {
    // The cookie is only ever honoured for admins.
    const { auth } = await import("@/lib/auth");
    const session = await auth().catch(() => null);
    if (session?.user?.role !== "admin") return null;
    const cohort = await getCohortById(parsed.cohortId);
    if (!cohort || cohort.status === CohortStatus.ACTIVE) return null;
    return toScope(cohort);
  })();
  viewMemo.set(cookieStore, pending);
  return pending;
}

/** The cohort the current operation belongs to. */
export async function resolveCohortScope(): Promise<ResolvedScope> {
  const store = scopeStorage.getStore();
  if (store) return store.scope;
  const view = await readAdminViewScope();
  if (view) return view;
  return toScope(await getActiveCohort());
}

/** Like resolveCohortScope() but never "all". */
export async function resolveConcreteCohortScope(): Promise<CohortScope> {
  const scope = await resolveCohortScope();
  return scope === "all" ? toScope(await getActiveCohort()) : scope;
}

/* ── Bootstrap: adopt the existing platform as Cohort 2 ────────────────── */

/**
 * Unique indexes that predate cohorts and would collide once the same
 * person/month/week appears in two cohorts. Their cohort-aware replacements
 * are declared on the schemas.
 */
const LEGACY_INDEXES: { model: string; index: string }[] = [
  { model: "Fellow", index: "email_1" },
  { model: "WeeklyRollup", index: "weekKey_1" },
  { model: "SavedNationalAudit", index: "month_1" },
  { model: "SavedNationalAuditPeriod", index: "startMonth_1_endMonth_1" },
];

export async function dropLegacyCohortIndexes(): Promise<void> {
  await import("@/models"); // make sure every model is registered
  for (const { model, index } of LEGACY_INDEXES) {
    const m = mongoose.models[model];
    if (!m) continue;
    try {
      await m.collection.dropIndex(index);
    } catch {
      // Already gone (or the collection doesn't exist yet) — nothing to do.
    }
  }
}

/**
 * Stamp every unstamped record of every cohort-scoped collection with
 * `cohortId`. Uses the raw driver so it bypasses scoping and doesn't touch
 * `updatedAt`.
 */
export async function stampUnassignedRecords(cohortId: Types.ObjectId): Promise<Record<string, number>> {
  await import("@/models");
  const result: Record<string, number> = {};
  for (const name of getCohortScopedModelNames()) {
    const m = mongoose.models[name];
    if (!m) continue;
    const res = await m.collection.updateMany({ cohort: null }, { $set: { cohort: cohortId } });
    result[name] = res.modifiedCount;
  }
  return result;
}

async function bootstrapCohorts() {
  const anyCohort = await Cohort.findOne({}).select("_id").lean();
  if (anyCohort) {
    throw new Error("No active cohort is configured. Activate a cohort from Admin → Cohorts.");
  }

  // Date the adopted cohort from the earliest programme record we have.
  await import("@/models");
  let startedAt: Date | null = null;
  const Mentor = mongoose.models.Mentor;
  if (Mentor) {
    const first = await Mentor.collection.find({}, { projection: { createdAt: 1 } }).sort({ createdAt: 1 }).limit(1).next();
    startedAt = (first?.createdAt as Date | undefined) ?? null;
  }

  try {
    await Cohort.create({
      number: BOOTSTRAP_COHORT_NUMBER,
      name: `Cohort ${BOOTSTRAP_COHORT_NUMBER}`,
      status: CohortStatus.ACTIVE,
      startedAt: startedAt ?? new Date(),
      notes: "Created automatically when cohorts were introduced; holds all records that existed at that time.",
    });
  } catch (err) {
    // Another instance won the race — fine, use theirs.
    if ((err as { code?: number }).code !== 11000) throw err;
  }

  const active = await Cohort.findOne({ status: CohortStatus.ACTIVE }).sort({ number: -1 }).lean();
  if (!active) throw new Error("Failed to initialise cohorts");

  await dropLegacyCohortIndexes();
  const stamped = await stampUnassignedRecords(active._id as Types.ObjectId);
  console.info(`[cohorts] Adopted existing data as ${active.name}:`, stamped);
  return active;
}
