/**
 * @openapi
 * /api/reports/compliance:
 *   get:
 *     tags: [Reports]
 *     summary: Mentors missing weekly reports and fellows with no recorded sessions
 *     description: >
 *       For a range of ISO weeks, lists (a) active mentors who have not submitted
 *       a weekly report for one or more of those weeks, and (b) fellows for whom
 *       no session was recorded in any submitted weekly report in those weeks.
 *       Drafts never count as submitted. Weeks before a mentor or fellow was added
 *       to the platform are not counted against them.
 *
 *       Scope: admins, M&E officers and team research leads see every mentor;
 *       coordinators see the mentors assigned to them (within their states);
 *       desk officers see mentors working in their states and only the fellows
 *       located in those states. Mentors and fellows are forbidden.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: fromWeek
 *         description: First ISO week (e.g. 2026-W44). Defaults to the current week.
 *         schema: { type: string }
 *       - in: query
 *         name: toWeek
 *         description: Last ISO week, inclusive. Defaults to fromWeek.
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         description: Narrow to one state (intersected with the caller's scope).
 *         schema: { type: string }
 *     responses:
 *       200: { description: Week list, summary counts, flagged mentors and fellows }
 *       400: { description: Invalid or too-long week range }
 *       401: { description: Not authenticated }
 *       403: { description: Role not permitted }
 */
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Coordinator, DeskOfficer, Fellow, Mentor, User, WeeklyReport } from "@/models";
import {
    UserRole,
    ReportStatus,
    normalizeLocation,
    resolveFellowState,
    resolveMentorStates,
} from "@/lib/constants";
import { addDays, currentWeekKey, isoWeekKey, parseWeekKey } from "@/lib/date-helpers";

/** Longest range served in one request, to keep the per-week breakdown readable. */
const MAX_WEEKS = 26;

const WEEK_KEY = /^\d{4}-W\d{2}$/;

/** Matches the fellow-sessions lookup: case-insensitive, whitespace-collapsed. */
const nameKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();

/** Every ISO week key from `from` to `to` inclusive, or null if the range is invalid. */
function weeksBetween(from: string, to: string): string[] | null {
    const start = parseWeekKey(from);
    if (!start || !parseWeekKey(to) || from > to) return null;
    const weeks: string[] = [];
    for (let monday = start; ; monday = addDays(monday, 7)) {
        const key = isoWeekKey(monday);
        if (key > to) break;
        weeks.push(key);
        if (weeks.length > MAX_WEEKS) break;
    }
    return weeks;
}

const empty = (weeks: string[]) =>
    jsonOk({
        weeks,
        scopeStates: [],
        summary: { totalMentors: 0, mentorsMissing: 0, totalFellows: 0, fellowsWithoutSessions: 0 },
        mentors: [],
        fellows: [],
    });

export const GET = withExceptionLog("GET /api/reports/compliance", async (request: NextRequest) => {
    const { session, error } = await requireRole(
        UserRole.ADMIN,
        UserRole.COORDINATOR,
        UserRole.ZONAL_DESK_OFFICER,
        UserRole.ME_OFFICER,
        UserRole.TEAM_RESEARCH_LEAD,
    );
    if (error) return error;

    const url = new URL(request.url);
    const fromWeek = url.searchParams.get("fromWeek") || currentWeekKey();
    const toWeek = url.searchParams.get("toWeek") || fromWeek;
    if (!WEEK_KEY.test(fromWeek) || !WEEK_KEY.test(toWeek)) {
        return jsonError("Weeks must look like 2026-W08.", 400);
    }
    const weeks = weeksBetween(fromWeek, toWeek);
    if (!weeks || !weeks.length) return jsonError("The start week must not be after the end week.", 400);
    if (weeks.length > MAX_WEEKS) return jsonError(`Choose a range of at most ${MAX_WEEKS} weeks.`, 400);

    const requestedState = normalizeLocation(url.searchParams.get("state"));

    await connectDB();

    // ── Caller scope ─────────────────────────
    const role = session!.user.role;
    const mentorFilter: Record<string, unknown> = {};
    /** States a desk officer is limited to; fellows outside them are hidden too. */
    let zoneStates: string[] | null = null;

    if (role === UserRole.COORDINATOR) {
        const coordinator = await Coordinator.findOne({ authId: session!.user.id }).lean();
        if (!coordinator) return jsonError("Coordinator record not found", 404);
        mentorFilter.coordinator = coordinator._id;
        const states = (coordinator.states ?? []).map(normalizeLocation).filter(Boolean);
        if (states.length) mentorFilter.states = { $in: states };
    } else if (role === UserRole.ZONAL_DESK_OFFICER) {
        const officer = await DeskOfficer.findOne({ authId: session!.user.id }).lean();
        zoneStates = (officer?.states ?? []).map(normalizeLocation).filter(Boolean);
        if (!zoneStates.length) return empty(weeks);
        mentorFilter.states = { $in: zoneStates };
    }

    const mentorDocs = await Mentor.find(mentorFilter)
        .select("authId coordinator states lgas createdAt")
        .lean();

    // Deactivated mentors are not expected to report.
    const users = await User.find({
        // Membership comes from the mentor profile, not User.role (which may
        // have changed since, when browsing an earlier cohort).
        _id: { $in: mentorDocs.map((m) => m.authId) },
        active: true,
    })
        .select("name email phone")
        .lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    let mentors = mentorDocs
        .filter((m) => userById.has(String(m.authId)))
        .map((m) => ({ doc: m, user: userById.get(String(m.authId))!, states: resolveMentorStates(m) }));

    const scopeStates = [...new Set(mentors.flatMap((m) => m.states))]
        .filter((s) => !zoneStates || zoneStates.includes(s))
        .sort();

    if (requestedState) {
        if (zoneStates && !zoneStates.includes(requestedState)) return empty(weeks);
        mentors = mentors.filter((m) => m.states.includes(requestedState));
    }
    /** States fellows must fall in, when the view is narrowed geographically. */
    const fellowStates = requestedState ? [requestedState] : zoneStates;

    const mentorIds = mentors.map((m) => m.doc._id as Types.ObjectId);

    // Coordinator names for display.
    const coordinatorDocs = await Coordinator.find({ _id: { $in: [...new Set(mentors.map((m) => String(m.doc.coordinator)))] } })
        .select("authId")
        .lean();
    const coordinatorUsers = await User.find({ _id: { $in: coordinatorDocs.map((c) => c.authId) } })
        .select("name")
        .lean();
    const coordinatorUserName = new Map(coordinatorUsers.map((u) => [String(u._id), u.name]));
    const coordinatorName = new Map(
        coordinatorDocs.map((c) => [String(c._id), coordinatorUserName.get(String(c.authId)) ?? ""]),
    );

    // ── Reports ──────────────────────────────
    const [rangeReports, lastSubmitted, sessionGroups, fellowDocs] = await Promise.all([
        WeeklyReport.find({ mentor: { $in: mentorIds }, weekKey: { $in: weeks } })
            .select("mentor weekKey status")
            .lean(),
        WeeklyReport.aggregate<{ _id: Types.ObjectId; weekKey: string; weekEnding: Date }>([
            { $match: { mentor: { $in: mentorIds }, status: { $ne: ReportStatus.DRAFT } } },
            { $sort: { weekKey: -1 } },
            { $group: { _id: "$mentor", weekKey: { $first: "$weekKey" }, weekEnding: { $first: "$weekEnding" } } },
        ]),
        // One row per (mentor, mentee name as typed): when they were last seen and in which weeks.
        WeeklyReport.aggregate<{ _id: { mentor: Types.ObjectId; name: string }; lastSession: Date; weeks: string[] }>([
            { $match: { mentor: { $in: mentorIds }, status: { $ne: ReportStatus.DRAFT } } },
            { $unwind: "$sessions" },
            {
                $group: {
                    _id: { mentor: "$mentor", name: "$sessions.menteeName" },
                    lastSession: { $max: "$sessions.sessionDate" },
                    weeks: { $addToSet: "$weekKey" },
                },
            },
        ]),
        Fellow.find({ mentor: { $in: mentorIds } }).select("name lga mentor createdAt").sort({ name: 1 }).lean(),
    ]);

    const submittedWeeks = new Map<string, Set<string>>();
    const draftWeeks = new Map<string, Set<string>>();
    for (const r of rangeReports) {
        const target = r.status === ReportStatus.DRAFT ? draftWeeks : submittedWeeks;
        const key = String(r.mentor);
        if (!target.has(key)) target.set(key, new Set());
        target.get(key)!.add(r.weekKey);
    }
    const lastByMentor = new Map(lastSubmitted.map((r) => [String(r._id), r]));

    /** Weeks in range on or after the record's creation week. */
    const expectedWeeks = (createdAt?: Date) => {
        const firstWeek = createdAt ? isoWeekKey(new Date(createdAt)) : "";
        return weeks.filter((w) => w >= firstWeek);
    };

    // ── Mentors missing reports ──────────────
    const mentorRows = mentors
        .map(({ doc, user, states }) => {
            const id = String(doc._id);
            const expected = expectedWeeks(doc.createdAt);
            const submitted = submittedWeeks.get(id) ?? new Set<string>();
            const drafts = draftWeeks.get(id) ?? new Set<string>();
            const missing = expected.filter((w) => !submitted.has(w));
            const last = lastByMentor.get(id);
            return {
                mentorId: id,
                userId: String(user._id),
                name: user.name,
                email: user.email,
                phone: user.phone ?? "",
                states,
                coordinatorName: coordinatorName.get(String(doc.coordinator)) ?? "",
                expectedWeeks: expected.length,
                missingWeeks: missing,
                draftWeeks: missing.filter((w) => drafts.has(w)),
                lastSubmittedWeek: last?.weekKey ?? null,
                lastSubmittedWeekEnding: last?.weekEnding ?? null,
            };
        })
        .filter((m) => m.missingWeeks.length > 0)
        .sort((a, b) => b.missingWeeks.length - a.missingWeeks.length || a.name.localeCompare(b.name));

    // ── Fellows without sessions ─────────────
    const sessionsByFellow = new Map<string, { lastSession: Date; weeks: Set<string> }>();
    for (const g of sessionGroups) {
        if (!g._id.name) continue;
        const key = `${g._id.mentor}|${nameKey(g._id.name)}`;
        const entry = sessionsByFellow.get(key) ?? { lastSession: g.lastSession, weeks: new Set<string>() };
        if (g.lastSession > entry.lastSession) entry.lastSession = g.lastSession;
        g.weeks.forEach((w) => entry.weeks.add(w));
        sessionsByFellow.set(key, entry);
    }
    const mentorById = new Map(mentors.map((m) => [String(m.doc._id), m]));

    let fellowsInScope = 0;
    const fellowRows: Array<{
        fellowId: string;
        name: string;
        lga: string;
        state: string | null;
        mentorId: string;
        mentorName: string;
        mentorReportedWeeks: number;
        expectedWeeks: number;
        reason: "mentor_no_report" | "not_in_report";
        lastSessionDate: Date | null;
    }> = [];

    for (const f of fellowDocs) {
        const mentor = mentorById.get(String(f.mentor));
        if (!mentor) continue;
        // A fellow's state comes from their own LGA, never from the mentor alone.
        const state = resolveFellowState(f.lga, mentor.states);
        if (fellowStates) {
            // Unknown-state fellows stay visible in a zone their mentor covers,
            // but not when the user explicitly picked a state.
            if (state ? !fellowStates.includes(state) : Boolean(requestedState)) continue;
        }
        const expected = expectedWeeks(f.createdAt);
        if (!expected.length) continue;
        fellowsInScope++;

        const sessions = sessionsByFellow.get(`${f.mentor}|${nameKey(f.name)}`);
        if (sessions && expected.some((w) => sessions.weeks.has(w))) continue;

        const submitted = submittedWeeks.get(String(f.mentor)) ?? new Set<string>();
        const mentorReportedWeeks = expected.filter((w) => submitted.has(w)).length;
        fellowRows.push({
            fellowId: String(f._id),
            name: f.name,
            lga: f.lga,
            state,
            mentorId: String(f.mentor),
            mentorName: mentor.user.name,
            mentorReportedWeeks,
            expectedWeeks: expected.length,
            reason: mentorReportedWeeks ? "not_in_report" : "mentor_no_report",
            lastSessionDate: sessions?.lastSession ?? null,
        });
    }

    return jsonOk({
        weeks,
        scopeStates,
        summary: {
            totalMentors: mentors.filter((m) => expectedWeeks(m.doc.createdAt).length).length,
            mentorsMissing: mentorRows.length,
            totalFellows: fellowsInScope,
            fellowsWithoutSessions: fellowRows.length,
        },
        mentors: mentorRows,
        fellows: fellowRows,
    });
});
