/**
 * @openapi
 * /api/fellows/{id}/sessions:
 *   get:
 *     tags: [Fellows, Reports]
 *     summary: Weekly-report sessions held with a fellow
 *     description: >
 *       Collates every mentorship session entry, across the fellow's mentor's
 *       weekly reports, whose mentee name matches this fellow (case- and
 *       whitespace-insensitive). Draft reports are excluded unless explicitly
 *       requested by the authoring mentor. Newest sessions first.
 *       Mentor (own fellows) and admin only.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         description: Sessions on or after this day (YYYY-MM-DD).
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: to
 *         description: Sessions on or before this day (YYYY-MM-DD).
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: season
 *         schema: { type: string, enum: [regular, capstone] }
 *       - in: query
 *         name: reportStatus
 *         description: Defaults to every non-draft report. "draft" is only honoured for the authoring mentor.
 *         schema: { type: string, enum: [submitted, reviewed, draft] }
 *       - in: query
 *         name: q
 *         description: Keyword matched against topic, challenges, solutions and action plan.
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200: { description: Fellow summary, totals across all matches, and one page of sessions }
 *       401: { description: Not authenticated }
 *       403: { description: Role not permitted / not this mentor's fellow }
 *       404: { description: Fellow not found }
 */
import { NextRequest } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parsePagination, withExceptionLog } from "@/lib/api-helpers";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor, WeeklyReport } from "@/models";
import { UserRole, ReportStatus } from "@/lib/constants";
import { ReportSeason } from "@/lib/report-season";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Session dates are stored as UTC midnight of the calendar day the mentor
 * picked, so a "YYYY-MM-DD" bound maps straight onto UTC day boundaries.
 */
function parseDay(value: string | null, offsetDays = 0): Date | null {
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays));
}

export const GET = withExceptionLog(
    "GET /api/fellows/[id]/sessions",
    async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
        const { session, error } = await requireRole(UserRole.MENTOR, UserRole.ADMIN);
        if (error) return error;

        const { id } = await params;
        if (!isValidObjectId(id)) return jsonError("Fellow not found", 404);

        await connectDB();
        const fellow = await Fellow.findById(id).select("name lga qualification mentor").lean();
        if (!fellow) return jsonError("Fellow not found", 404);

        const isMentor = session!.user.role === UserRole.MENTOR;
        if (isMentor) {
            const mentor = await Mentor.findOne({ authId: session!.user.id }).select("_id").lean();
            if (!mentor || String(mentor._id) !== String(fellow.mentor)) return jsonError("Forbidden", 403);
        }

        const url = new URL(request.url);

        // ── Report-level filters ─────────────
        const reportMatch: Record<string, unknown> = { mentor: fellow.mentor };

        // Drafts are private to their author: only the fellow's own mentor may ask for them.
        const reportStatus = url.searchParams.get("reportStatus");
        if (reportStatus === ReportStatus.DRAFT) {
            if (!isMentor) return jsonError("Forbidden", 403);
            reportMatch.status = ReportStatus.DRAFT;
        } else if (reportStatus === ReportStatus.SUBMITTED || reportStatus === ReportStatus.REVIEWED) {
            reportMatch.status = reportStatus;
        } else {
            reportMatch.status = { $ne: ReportStatus.DRAFT };
        }

        // Reports predating seasons carry no season and count as regular.
        const season = url.searchParams.get("season");
        if (season === ReportSeason.CAPSTONE) reportMatch.season = ReportSeason.CAPSTONE;
        else if (season === ReportSeason.REGULAR) reportMatch.season = { $ne: ReportSeason.CAPSTONE };

        // ── Session-level filters ────────────
        const nameTokens = fellow.name.trim().split(/\s+/).map(escapeRegex);
        const sessionMatch: Record<string, unknown> = {
            "sessions.menteeName": { $regex: `^\\s*${nameTokens.join("\\s+")}\\s*$`, $options: "i" },
        };

        const from = parseDay(url.searchParams.get("from"));
        const toExclusive = parseDay(url.searchParams.get("to"), 1);
        if (from || toExclusive) {
            sessionMatch["sessions.sessionDate"] = {
                ...(from && { $gte: from }),
                ...(toExclusive && { $lt: toExclusive }),
            };
        }

        const q = url.searchParams.get("q")?.trim();
        if (q) {
            const keyword = { $regex: escapeRegex(q), $options: "i" };
            sessionMatch.$or = [
                { "sessions.topicDiscussed": keyword },
                { "sessions.challenges": keyword },
                { "sessions.solutions": keyword },
                { "sessions.actionPlan": keyword },
            ];
        }

        const { page, limit, skip } = parsePagination(url);

        const [result] = await WeeklyReport.aggregate([
            { $match: reportMatch },
            { $unwind: "$sessions" },
            { $match: sessionMatch },
            {
                $facet: {
                    // Totals cover every matching session, not just this page.
                    meta: [{ $group: { _id: null, total: { $sum: 1 }, reports: { $addToSet: "$_id" } } }],
                    data: [
                        { $sort: { "sessions.sessionDate": -1, weekEnding: -1, "sessions._id": 1 } },
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $project: {
                                _id: "$sessions._id",
                                reportId: "$_id",
                                weekKey: 1,
                                weekEnding: 1,
                                reportStatus: "$status",
                                season: 1,
                                menteeName: "$sessions.menteeName",
                                menteeLGA: "$sessions.menteeLGA",
                                sessionDate: "$sessions.sessionDate",
                                startTime: "$sessions.startTime",
                                endTime: "$sessions.endTime",
                                duration: "$sessions.duration",
                                topicDiscussed: "$sessions.topicDiscussed",
                                challenges: "$sessions.challenges",
                                solutions: "$sessions.solutions",
                                actionPlan: "$sessions.actionPlan",
                            },
                        },
                    ],
                },
            },
        ]);

        const total: number = result.meta[0]?.total ?? 0;
        return jsonOk({
            fellow: { _id: fellow._id, name: fellow.name, lga: fellow.lga, qualification: fellow.qualification },
            total,
            reportCount: result.meta[0]?.reports.length ?? 0,
            sessions: result.data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    },
);
