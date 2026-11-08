/* ──────────────────────────────────────────
   Cohort service
   • membership lookups (login / session refresh)
   • the roster the new-cohort wizard starts from
   • creating a cohort in setup, activating it, discarding it
   • safe add/remove of people for the user-management routes

   A User (login) is global; role profiles (Coordinator, Mentor, Fellow, …)
   are per cohort. Moving to a new cohort creates *new* profiles, so every
   report keeps pointing at the profile — and therefore the coordinator,
   states and LGAs — that was in force when it was written.
   ────────────────────────────────────────── */
import { Types, type Model } from "mongoose";
import {
  AppSettings,
  Cohort,
  Coordinator,
  DeskOfficer,
  Fellow,
  MEOfficer,
  Mentor,
  MentorAvailabilityTemplate,
  TeamResearchLead,
  User,
  type ICohort,
} from "@/models";
import { UserRole } from "@/lib/constants";
import {
  COHORT_ROLES,
  COHORT_ROLE_LABELS,
  CohortStatus,
  isCohortRole,
  isCohortStaffRole,
  type CohortRole,
  type CohortStaffRole,
  type CohortSummary,
} from "@/lib/cohort";
import {
  cohortFilterValue,
  dropLegacyCohortIndexes,
  getActiveCohort,
  getCohortScopedModelNames,
  invalidateCohortCache,
  resolveConcreteCohortScope,
  runAcrossCohorts,
  runInCohort,
  stampUnassignedRecords,
  toScope,
  type CachedCohort,
  type CohortScope,
} from "@/lib/cohort-scope";
import mongoose from "mongoose";
import { DEFAULT_REPORT_SEASON } from "@/lib/report-season";

/* ── Role ↔ profile model ─────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProfileModel = Model<any>;

export const PROFILE_MODELS: Record<CohortRole, ProfileModel> = {
  coordinator: Coordinator,
  mentor: Mentor,
  zonal_desk_officer: DeskOfficer,
  me_officer: MEOfficer,
  team_research_lead: TeamResearchLead,
  fellow: Fellow,
};

/** Roles whose profile carries a `states` list. */
const ROLES_WITH_STATES = new Set<CohortRole>(["coordinator", "mentor", "zonal_desk_officer"]);

/* ═══════════════════════════════════════════════════════════════════════
   Membership
   ═══════════════════════════════════════════════════════════════════════ */

export interface CohortMembership {
  role: CohortRole;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
}

/**
 * The profile `userId` holds in `scope`, checking `preferredRole` first. The
 * explicit `cohort` filter makes these lookups bypass request scoping, which
 * matters because they run inside the auth callbacks.
 */
export async function findCohortMembership(
  userId: string | Types.ObjectId,
  scope: CohortScope,
  preferredRole?: string,
): Promise<CohortMembership | null> {
  const order: CohortRole[] = isCohortRole(preferredRole)
    ? [preferredRole, ...COHORT_ROLES.filter((r) => r !== preferredRole)]
    : [...COHORT_ROLES];
  const cohort = cohortFilterValue(scope);
  for (const role of order) {
    const profile = await PROFILE_MODELS[role].findOne({ authId: userId, cohort }).lean();
    if (profile) return { role, profile };
  }
  return null;
}

/** Session fields derived from a user's membership of the active cohort. */
export interface SessionIdentity {
  role: string;
  state?: string;
  states?: string[];
  mentorId?: string;
  fellowId?: string;
  cohortId: string;
}

export type MembershipFailure = "not_in_cohort" | "cohort_not_started";

/**
 * Resolve what a user is in the active cohort. Admins are global and always
 * pass. Everyone else needs a profile in the live cohort.
 */
export async function resolveSessionIdentity(user: {
  _id: unknown;
  role: string;
}): Promise<{ identity: SessionIdentity } | { failure: MembershipFailure }> {
  const active = await getActiveCohort();
  const cohortId = String(active._id);
  if (user.role === UserRole.ADMIN) return { identity: { role: user.role, cohortId } };

  const membership = await findCohortMembership(String(user._id), toScope(active), user.role);
  if (!membership) {
    // Someone added to a cohort that hasn't started yet gets a clearer message.
    const setup = await Cohort.findOne({ status: CohortStatus.SETUP }).select("_id status").lean();
    if (setup && (await findCohortMembership(String(user._id), toScope(setup)))) {
      return { failure: "cohort_not_started" };
    }
    return { failure: "not_in_cohort" };
  }

  const { role, profile } = membership;
  // Keep the stored role in step with the live cohort (self-heals any drift).
  if (role !== user.role) await User.updateOne({ _id: String(user._id) }, { $set: { role } });

  const identity: SessionIdentity = { role, cohortId };
  if (ROLES_WITH_STATES.has(role)) {
    identity.states = profile.states ?? [];
    identity.state = identity.states?.[0];
  }
  if (role === "mentor") identity.mentorId = String(profile._id);
  if (role === "fellow") {
    identity.fellowId = String(profile._id);
    identity.mentorId = profile.mentor ? String(profile.mentor) : undefined;
  }
  return { identity };
}

/* ═══════════════════════════════════════════════════════════════════════
   Listing
   ═══════════════════════════════════════════════════════════════════════ */

function summarize(c: Pick<ICohort, "number" | "name" | "status" | "startedAt" | "endedAt" | "notes" | "createdAt"> & { _id: unknown }): CohortSummary {
  return {
    _id: String(c._id),
    number: c.number,
    name: c.name,
    status: c.status,
    startedAt: c.startedAt ? new Date(c.startedAt).toISOString() : null,
    endedAt: c.endedAt ? new Date(c.endedAt).toISOString() : null,
    notes: c.notes ?? "",
    createdAt: new Date(c.createdAt).toISOString(),
  };
}

export async function listCohorts(opts?: { withCounts?: boolean }): Promise<CohortSummary[]> {
  await getActiveCohort(); // bootstraps on a fresh database
  const docs = await Cohort.find({}).sort({ number: -1 }).lean();
  const list = docs.map(summarize);
  if (!opts?.withCounts) return list;

  const { WeeklyReport, MentorMonthlyReport } = await import("@/models");
  for (const c of list) {
    const scope = toScope({ _id: c._id, status: c.status });
    const filter = { cohort: cohortFilterValue(scope) };
    const counts: CohortSummary["counts"] = {};
    for (const role of COHORT_ROLES) counts[role] = await PROFILE_MODELS[role].countDocuments(filter);
    counts.weeklyReports = await WeeklyReport.countDocuments({ ...filter, status: { $ne: "draft" } });
    counts.fellowMonthlyReports = await MentorMonthlyReport.countDocuments({ ...filter, status: { $ne: "draft" } });
    c.counts = counts;
  }
  return list;
}

export async function getCohortSummary(id: string | Types.ObjectId): Promise<CohortSummary | null> {
  const doc = await Cohort.findById(id).lean();
  return doc ? summarize(doc) : null;
}

/* ═══════════════════════════════════════════════════════════════════════
   Roster (what the wizard starts from)
   ═══════════════════════════════════════════════════════════════════════ */

export interface RosterStaff {
  userId: string;
  name: string;
  email: string;
  active: boolean;
  role: CohortStaffRole;
  states: string[];
  lgas: string[];
  /** Mentors: the user id of their coordinator. */
  coordinatorUserId?: string | null;
  /** Mentors: how many fellows they carry. */
  fellowCount?: number;
}

export interface RosterFellow {
  fellowId: string;
  name: string;
  email?: string;
  lga: string;
  /** User id of the fellow's login, if they were invited. */
  userId?: string | null;
  mentorUserId?: string | null;
}

export interface CohortRoster {
  cohort: CohortSummary;
  nextNumber: number;
  staff: RosterStaff[];
  fellows: RosterFellow[];
}

async function loadRoster(source: CachedCohort): Promise<CohortRoster> {
  const scope = toScope(source);
  const cohort = cohortFilterValue(scope);

  const [coordinators, mentors, desks, mes, trls, fellows] = await Promise.all([
    Coordinator.find({ cohort }).lean(),
    Mentor.find({ cohort }).lean(),
    DeskOfficer.find({ cohort }).lean(),
    MEOfficer.find({ cohort }).lean(),
    TeamResearchLead.find({ cohort }).lean(),
    Fellow.find({ cohort }).sort({ name: 1 }).lean(),
  ]);

  const userIds = [
    ...coordinators, ...mentors, ...desks, ...mes, ...trls,
  ].map((p) => p.authId);
  const users = await User.find({ _id: { $in: userIds } }).select("name email active").lean();
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const coordUserByProfile = new Map(coordinators.map((c) => [String(c._id), String(c.authId)]));
  const mentorUserByProfile = new Map(mentors.map((m) => [String(m._id), String(m.authId)]));
  const fellowsPerMentor = new Map<string, number>();
  for (const f of fellows) fellowsPerMentor.set(String(f.mentor), (fellowsPerMentor.get(String(f.mentor)) ?? 0) + 1);

  const staff: RosterStaff[] = [];
  const push = (
    role: CohortStaffRole,
    profiles: { _id: unknown; authId: Types.ObjectId; states?: string[]; lgas?: string[]; coordinator?: Types.ObjectId }[],
  ) => {
    for (const p of profiles) {
      const u = userById.get(String(p.authId));
      if (!u) continue; // profile whose login was deleted
      staff.push({
        userId: String(p.authId),
        name: u.name,
        email: u.email,
        active: u.active,
        role,
        states: p.states ?? [],
        lgas: p.lgas ?? [],
        ...(role === "mentor"
          ? {
              coordinatorUserId: p.coordinator ? coordUserByProfile.get(String(p.coordinator)) ?? null : null,
              fellowCount: fellowsPerMentor.get(String(p._id)) ?? 0,
            }
          : {}),
      });
    }
  };
  push("coordinator", coordinators);
  push("mentor", mentors);
  push("zonal_desk_officer", desks);
  push("me_officer", mes);
  push("team_research_lead", trls);
  staff.sort((a, b) => a.name.localeCompare(b.name));

  const maxNumber = (await Cohort.findOne({}).sort({ number: -1 }).select("number").lean())?.number ?? source.number;
  const sourceDoc = await Cohort.findById(source._id).lean();

  return {
    cohort: summarize(sourceDoc!),
    nextNumber: maxNumber + 1,
    staff,
    fellows: fellows.map((f) => ({
      fellowId: String(f._id),
      name: f.name,
      email: f.email,
      lga: f.lga,
      userId: f.authId ? String(f.authId) : null,
      mentorUserId: mentorUserByProfile.get(String(f.mentor)) ?? null,
    })),
  };
}

export async function getActiveRoster(): Promise<CohortRoster> {
  return loadRoster(await getActiveCohort());
}

/* ═══════════════════════════════════════════════════════════════════════
   Creating the next cohort (setup)
   ═══════════════════════════════════════════════════════════════════════ */

export interface NewCohortStaffEntry {
  userId: string;
  role: CohortStaffRole;
  /** Required for mentors: the user id of a coordinator in the new cohort. */
  coordinatorUserId?: string;
}

export interface NewCohortFellowEntry {
  fellowId: string;
  /** Required: the user id of a mentor in the new cohort. */
  mentorUserId: string;
}

export interface NewCohortPlan {
  name?: string;
  notes?: string;
  /** Staff carried into the new cohort, possibly in a new role. Omitted = leaving. */
  staff: NewCohortStaffEntry[];
  /** Fellows carried into the new cohort. Omitted = leaving. */
  fellows: NewCohortFellowEntry[];
}

export class CohortPlanError extends Error {
  constructor(public readonly problems: string[]) {
    super(problems.length === 1 ? problems[0] : `${problems.length} problems with the cohort plan`);
    this.name = "CohortPlanError";
  }
}

export async function createSetupCohort(plan: NewCohortPlan, actorId: string) {
  const existingSetup = await Cohort.findOne({ status: CohortStatus.SETUP }).select("name").lean();
  if (existingSetup) {
    throw new CohortPlanError([`${existingSetup.name} is already being set up. Activate or discard it first.`]);
  }

  const source = await getActiveCohort();
  const roster = await loadRoster(source);
  const sourceFilter = cohortFilterValue(toScope(source));

  /* ── Validate ── */
  const problems: string[] = [];
  const staffByUser = new Map(roster.staff.map((s) => [s.userId, s]));
  const fellowsById = new Map(roster.fellows.map((f) => [f.fellowId, f]));
  const fellowByUser = new Map(roster.fellows.filter((f) => f.userId).map((f) => [f.userId!, f]));
  const nameOf = (userId: string) => staffByUser.get(userId)?.name ?? fellowByUser.get(userId)?.name ?? userId;

  const newRoleByUser = new Map<string, CohortStaffRole>();
  for (const entry of plan.staff ?? []) {
    if (!isCohortStaffRole(entry.role)) {
      problems.push(`Invalid role "${entry.role}" for ${nameOf(entry.userId)}.`);
      continue;
    }
    if (!staffByUser.has(entry.userId) && !fellowByUser.has(entry.userId)) {
      problems.push(`${entry.userId} is not part of ${source.name}.`);
      continue;
    }
    if (newRoleByUser.has(entry.userId)) {
      problems.push(`${nameOf(entry.userId)} is listed more than once.`);
      continue;
    }
    newRoleByUser.set(entry.userId, entry.role);
  }
  for (const entry of plan.staff ?? []) {
    if (entry.role !== "mentor") continue;
    if (!entry.coordinatorUserId) {
      problems.push(`Choose a coordinator for ${nameOf(entry.userId)}.`);
    } else if (newRoleByUser.get(entry.coordinatorUserId) !== "coordinator") {
      problems.push(`${nameOf(entry.userId)}'s coordinator (${nameOf(entry.coordinatorUserId)}) is not a coordinator in the new cohort.`);
    }
  }
  const seenFellows = new Set<string>();
  for (const entry of plan.fellows ?? []) {
    const f = fellowsById.get(entry.fellowId);
    if (!f) {
      problems.push(`Fellow ${entry.fellowId} is not part of ${source.name}.`);
      continue;
    }
    if (seenFellows.has(entry.fellowId)) continue;
    seenFellows.add(entry.fellowId);
    if (f.userId && newRoleByUser.has(f.userId)) {
      problems.push(`${f.name} can't continue both as a fellow and as ${COHORT_ROLE_LABELS[newRoleByUser.get(f.userId)!]}.`);
    }
    if (!entry.mentorUserId) {
      problems.push(`Choose a mentor for fellow ${f.name}.`);
    } else if (newRoleByUser.get(entry.mentorUserId) !== "mentor") {
      problems.push(`Fellow ${f.name}'s mentor (${nameOf(entry.mentorUserId)}) is not a mentor in the new cohort.`);
    }
  }
  if (problems.length) throw new CohortPlanError(problems);

  /* ── Source data needed to carry people over ── */
  const sourceMentors = await Mentor.find({ cohort: sourceFilter }).select("+google.refreshToken").lean();
  const sourceMentorByUser = new Map(sourceMentors.map((m) => [String(m.authId), m]));
  const sourceFellows = await Fellow.find({ cohort: sourceFilter, _id: { $in: (plan.fellows ?? []).map((f) => f.fellowId) } }).lean();
  const sourceFellowById = new Map(sourceFellows.map((f) => [String(f._id), f]));

  /* ── Create the cohort ── */
  await dropLegacyCohortIndexes();
  const number = roster.nextNumber;
  const cohort = await Cohort.create({
    number,
    name: plan.name?.trim() || `Cohort ${number}`,
    notes: plan.notes?.trim() ?? "",
    status: CohortStatus.SETUP,
    previousCohort: source._id,
    createdBy: new Types.ObjectId(actorId),
  });
  const target = { _id: cohort._id as Types.ObjectId, status: CohortStatus.SETUP };

  try {
    await runInCohort(target, async () => {
      const coordinatorProfileByUser = new Map<string, Types.ObjectId>();
      const mentorProfileByUser = new Map<string, Types.ObjectId>();

      // Carry a person's coverage into their new role where it makes sense.
      const statesFor = (userId: string) => staffByUser.get(userId)?.states ?? [];

      const staffEntries = plan.staff ?? [];
      const byRole = (role: CohortStaffRole) => staffEntries.filter((e) => e.role === role);

      // Coordinators first: mentors point at them.
      for (const e of byRole("coordinator")) {
        const doc = await Coordinator.create({ authId: e.userId, states: statesFor(e.userId) });
        coordinatorProfileByUser.set(e.userId, doc._id as Types.ObjectId);
      }
      for (const e of byRole("zonal_desk_officer")) {
        await DeskOfficer.create({ authId: e.userId, states: statesFor(e.userId) });
      }
      for (const e of byRole("me_officer")) await MEOfficer.create({ authId: e.userId });
      for (const e of byRole("team_research_lead")) await TeamResearchLead.create({ authId: e.userId });

      for (const e of byRole("mentor")) {
        const prev = sourceMentorByUser.get(e.userId);
        const doc = await Mentor.create({
          authId: e.userId,
          coordinator: coordinatorProfileByUser.get(e.coordinatorUserId!),
          states: prev?.states ?? statesFor(e.userId),
          lgas: prev?.lgas ?? [],
          // Keep the mentor's meeting setup so they don't have to reconnect.
          ...(prev?.meetingLink ? { meetingLink: prev.meetingLink } : {}),
          ...(prev?.google ? { google: prev.google } : {}),
        });
        mentorProfileByUser.set(e.userId, doc._id as Types.ObjectId);

        if (prev) {
          const templates = await MentorAvailabilityTemplate.find({ mentor: prev._id, active: true, cohort: sourceFilter }).lean();
          if (templates.length) {
            await MentorAvailabilityTemplate.insertMany(
              templates.map((t) => ({ mentor: doc._id, dayOfWeek: t.dayOfWeek, startTime: t.startTime, endTime: t.endTime, active: true })),
            );
          }
        }
      }

      for (const e of plan.fellows ?? []) {
        const prev = sourceFellowById.get(e.fellowId);
        if (!prev) continue;
        await Fellow.create({
          mentor: mentorProfileByUser.get(e.mentorUserId),
          name: prev.name,
          gender: prev.gender,
          lga: prev.lga,
          qualification: prev.qualification,
          email: prev.email,
          authId: prev.authId,
          inviteStatus: prev.inviteStatus,
          invitedAt: prev.invitedAt,
        });
      }
    });
  } catch (err) {
    await purgeCohortRecords(cohort._id as Types.ObjectId);
    await Cohort.deleteOne({ _id: cohort._id });
    throw err;
  }

  invalidateCohortCache();
  return getCohortSummary(cohort._id as Types.ObjectId);
}

/** Hard-delete every cohort-scoped record of a cohort (raw driver, unscoped). */
async function purgeCohortRecords(cohortId: Types.ObjectId) {
  await import("@/models");
  for (const name of getCohortScopedModelNames()) {
    const m = mongoose.models[name];
    if (m) await m.collection.deleteMany({ cohort: cohortId });
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   Activating / discarding
   ═══════════════════════════════════════════════════════════════════════ */

export async function activateCohort(cohortId: string, actorId: string, opts?: { resetReportSeason?: boolean }) {
  const incoming = await Cohort.findById(cohortId);
  if (!incoming) throw new CohortPlanError(["Cohort not found."]);
  if (incoming.status !== CohortStatus.SETUP) throw new CohortPlanError([`${incoming.name} is not in setup.`]);

  const outgoing = await getActiveCohort();
  const incomingScope = toScope({ _id: incoming._id as Types.ObjectId, status: CohortStatus.SETUP });

  // Anything still unstamped belongs to the cohort that is ending — pin it
  // there before the live cohort changes.
  await stampUnassignedRecords(outgoing._id);

  // Sanity: a cohort with no coordinators or mentors is almost certainly a mistake.
  const [coordinatorCount, mentorCount] = await Promise.all([
    Coordinator.countDocuments({ cohort: incomingScope.cohortId }),
    Mentor.countDocuments({ cohort: incomingScope.cohortId }),
  ]);
  if (!coordinatorCount || !mentorCount) {
    throw new CohortPlanError([`${incoming.name} needs at least one coordinator and one mentor before it can go live.`]);
  }

  // Each person's login role follows the profile they hold in the new cohort.
  for (const role of COHORT_ROLES) {
    const ids = await PROFILE_MODELS[role].distinct("authId", { cohort: incomingScope.cohortId, authId: { $ne: null } });
    if (ids.length) {
      await User.updateMany({ _id: { $in: ids }, role: { $ne: UserRole.ADMIN } }, { $set: { role } });
    }
  }

  // Switch on the new cohort before archiving the old one, so there is never
  // a moment without a live cohort.
  const now = new Date();
  incoming.status = CohortStatus.ACTIVE;
  incoming.startedAt = now;
  incoming.activatedBy = new Types.ObjectId(actorId);
  await incoming.save();
  await Cohort.updateMany(
    { _id: { $ne: incoming._id }, status: CohortStatus.ACTIVE },
    { $set: { status: CohortStatus.ARCHIVED, endedAt: now } },
  );

  if (opts?.resetReportSeason) {
    await AppSettings.findOneAndUpdate({}, { $set: { reportSeason: DEFAULT_REPORT_SEASON } }, { upsert: true });
  }

  invalidateCohortCache();
  return { activated: await getCohortSummary(incoming._id as Types.ObjectId), archived: outgoing.name };
}

export async function discardSetupCohort(cohortId: string) {
  const cohort = await Cohort.findById(cohortId);
  if (!cohort) throw new CohortPlanError(["Cohort not found."]);
  if (cohort.status !== CohortStatus.SETUP) {
    throw new CohortPlanError(["Only a cohort that is still being set up can be discarded."]);
  }
  await purgeCohortRecords(cohort._id as Types.ObjectId);
  await Cohort.deleteOne({ _id: cohort._id });
  invalidateCohortCache();
  return { discarded: cohort.name };
}

/* ═══════════════════════════════════════════════════════════════════════
   People management helpers (used by the create / delete routes)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Before adding someone to the cohort being viewed: is the email free, or
 * does it belong to a returning person we can attach a new profile to?
 */
export async function checkEmailForNewMember(email: string): Promise<
  | { ok: true; existingUser: (InstanceType<typeof User>) | null; scope: CohortScope }
  | { ok: false; status: number; error: string }
> {
  const scope = await resolveConcreteCohortScope();
  const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
  if (!existingUser) return { ok: true, existingUser: null, scope };
  if (existingUser.role === UserRole.ADMIN) {
    return { ok: false, status: 409, error: "This email belongs to an administrator account." };
  }
  const membership = await findCohortMembership(String(existingUser._id), scope);
  if (membership) {
    return {
      ok: false,
      status: 409,
      error: `A user with this email is already in this cohort as ${COHORT_ROLE_LABELS[membership.role]}.`,
    };
  }
  return { ok: true, existingUser, scope };
}

/**
 * Re-use a returning person's login for a new role. Their password is left as
 * it is. Their login role only changes immediately when they're joining the
 * live cohort — for a cohort in setup it changes on activation.
 */
export async function reuseUserForMembership(
  user: InstanceType<typeof User>,
  role: CohortRole,
  scope: CohortScope,
  updates: { name?: string; phone?: string },
) {
  if (updates.name) user.name = updates.name.trim();
  if (updates.phone) user.phone = updates.phone.trim();
  user.active = true;
  if (scope.isActive) user.role = role;
  await user.save();
  return user;
}

/**
 * Remove people from the cohort being viewed. Their login is only deleted
 * when they belong to no other cohort, so earlier cohorts keep their names
 * and history. Returns how many profiles and logins were removed.
 */
export async function removeMembersFromCohort(
  role: CohortRole,
  userIds: (string | Types.ObjectId)[],
): Promise<{ profilesRemoved: number; usersDeleted: number }> {
  if (!userIds.length) return { profilesRemoved: 0, usersDeleted: 0 };
  const ids = userIds.map((id) => String(id));
  const res = await PROFILE_MODELS[role].deleteMany({ authId: { $in: ids } });

  const stillMember = new Set<string>();
  await runAcrossCohorts(async () => {
    for (const r of COHORT_ROLES) {
      const remaining = await PROFILE_MODELS[r].distinct("authId", { authId: { $in: ids } });
      for (const id of remaining) stillMember.add(String(id));
    }
  });
  const orphanIds = ids.filter((id) => !stillMember.has(id));
  const del = orphanIds.length
    ? await User.deleteMany({ _id: { $in: orphanIds }, role: { $ne: UserRole.ADMIN } })
    : { deletedCount: 0 };
  return { profilesRemoved: res.deletedCount ?? 0, usersDeleted: del.deletedCount ?? 0 };
}

/** User ids holding a `role` profile in the cohort being viewed. */
export async function memberUserIds(role: CohortRole): Promise<string[]> {
  const ids = await PROFILE_MODELS[role].distinct("authId");
  return ids.filter(Boolean).map(String);
}
