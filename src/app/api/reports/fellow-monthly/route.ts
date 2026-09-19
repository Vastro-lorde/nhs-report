import { NextResponse } from "next/server";
import mongoose, { type QueryFilter } from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { MentorMonthlyReport, type IMentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { Fellow } from "@/models/Fellow";
import { Mentor } from "@/models/Mentor";
import { User } from "@/models/User";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { ReportHistory } from "@/models/ReportHistory";
import { UserRole, ReportHistoryReportType, ReportHistoryAction } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";
import { monthLockReason, monthLabel, isValidMonthKey } from "@/lib/date-helpers";
import { getCurrentReportSeason } from "@/lib/report-season-server";

/** Fellows per mentor id, for the "reports / fellows" group headers. */
async function fellowCountsFor(mentorIds: mongoose.Types.ObjectId[]): Promise<Record<string, number>> {
    if (!mentorIds.length) return {};
    const counts = await Fellow.aggregate<{ _id: unknown; count: number }>([
        { $match: { mentor: { $in: mentorIds } } },
        { $group: { _id: "$mentor", count: { $sum: 1 } } },
    ]);
    return Object.fromEntries(counts.map((c) => [String(c._id), c.count]));
}

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        await connectDB();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const rawStateParam = searchParams.get("state");
        const stateParam = rawStateParam ? rawStateParam.toUpperCase().trim() : "";
        const qParam = (searchParams.get("q") || "").trim();
        const mentorQParam = (searchParams.get("mentorQ") || "").trim();
        const monthParam = (searchParams.get("month") || "").trim();
        const mentorIdParam = searchParams.get("mentorId");
        // ?mentorsPerPage=N pages over distinct mentors instead of reports, so a
        // mentor's group is never split across pages. Only with ?sort=mentor.
        const mentorsPerPage = parseInt(searchParams.get("mentorsPerPage") || "0", 10);
        const statusParam = searchParams.get("status");
        // ?sort=mentor keeps each mentor's reports contiguous across pages so
        // the listing can be grouped by mentor. Default order is newest month first.
        const sort: Record<string, 1 | -1> =
            searchParams.get("sort") === "mentor"
                ? { mentor: 1, month: -1, createdAt: -1 }
                : { month: -1, createdAt: -1 };
        const filter: Record<string, any> = {};

        // Drafts belong to their author alone. Only a mentor asking for
        // ?status=draft sees them, and then only their own; every other listing
        // shows submitted reports.
        const wantsDrafts = statusParam === "draft";
        if (wantsDrafts && session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        filter.status = wantsDrafts ? "draft" : { $ne: "draft" };

        const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        if (qParam) {
            // Case-insensitive search against denormalised fellow name
            filter.fellowName = { $regex: escapeRegex(qParam), $options: "i" };
        }

        if (monthParam) {
            if (!isValidMonthKey(monthParam)) {
                return NextResponse.json({ error: "Invalid month. Use yyyy-MM." }, { status: 400 });
            }
            filter.month = monthParam;
        }

        if (mentorIdParam) {
            // mentorIdParam may be Mentor._id or the user's authId
            const targetMentor = await Mentor.findOne({ $or: [{ _id: mentorIdParam }, { authId: mentorIdParam }] }).lean();
            if (!targetMentor) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            if (session.user.role === UserRole.ADMIN) {
                filter.mentor = targetMentor._id;
            } else if (session.user.role === UserRole.COORDINATOR) {
                const coordDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
                if (!coordDoc || String(targetMentor.coordinator) !== String(coordDoc._id)) {
                    return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
                }
                filter.mentor = targetMentor._id;
            } else {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        } else if (session.user.role === UserRole.MENTOR) {
            const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
            if (!mentorDoc) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            filter.mentor = mentorDoc._id;
        } else if (session.user.role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id }).lean();
            if (!coordDoc) return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            const mentorFilter: Record<string, any> = { coordinator: coordDoc._id };
            if (stateParam) mentorFilter.states = stateParam;
            const mentorIds = await Mentor.find(mentorFilter).distinct("_id");
            filter.mentor = { $in: mentorIds };
        } else if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskOfficerDoc = await DeskOfficer.findOne({ authId: session.user.id }).lean();
            if (!deskOfficerDoc || !deskOfficerDoc.states?.length) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            const officerStates = deskOfficerDoc.states.map((s: string) => String(s).toUpperCase());
            const allowedStates = stateParam
                ? officerStates.filter((s: string) => s === stateParam)
                : officerStates;
            const mentorIds = await Mentor.find({ states: { $in: allowedStates } }).distinct("_id");
            filter.mentor = { $in: mentorIds };
        } else if (stateParam) {
            // Admin, ME Officer, Team Research Lead – filter by state if provided
            const mentorIds = await Mentor.find({ states: stateParam }).distinct("_id");
            filter.mentor = { $in: mentorIds };
        }
        // Without stateParam, Admin/ME Officer/Team Research Lead see all

        // Mentor-name search: the name lives on the mentor's User record, so
        // resolve it to mentor ids and intersect with the scope decided above.
        // Mentors only ever see their own reports, so it is ignored for them.
        if (mentorQParam && session.user.role !== UserRole.MENTOR) {
            const userIds = await User.find({ name: { $regex: escapeRegex(mentorQParam), $options: "i" } }).distinct("_id");
            const matched = (await Mentor.find({ authId: { $in: userIds } }).distinct("_id")).map(String);
            const matchedSet = new Set(matched);
            if (filter.mentor === undefined) {
                filter.mentor = { $in: matched };
            } else if (filter.mentor.$in) {
                filter.mentor = { $in: (filter.mentor.$in as unknown[]).filter((id) => matchedSet.has(String(id))) };
            } else if (!matchedSet.has(String(filter.mentor))) {
                filter.mentor = { $in: [] };
            }
        }

        const populatedQuery = (queryFilter: QueryFilter<IMentorMonthlyReport>) =>
            MentorMonthlyReport.find(queryFilter)
                .populate({ path: "mentor", populate: { path: "authId", select: "name email" } })
                .populate({ path: "fellow", select: "name lga qualification" })
                .sort(sort);

        if (sort.mentor && mentorsPerPage > 0) {
            // ObjectId string order matches the `{ mentor: 1 }` sort, so the
            // page slice lines up with the order reports come back in.
            const mentorIdsWithReports = (await MentorMonthlyReport.distinct("mentor", filter)).map(String).sort();
            const totalMentors = mentorIdsWithReports.length;
            const pageMentorIds = mentorIdsWithReports
                .slice((page - 1) * mentorsPerPage, page * mentorsPerPage)
                .map((id) => new mongoose.Types.ObjectId(id));

            const [data, totalReports] = await Promise.all([
                populatedQuery({ ...filter, mentor: { $in: pageMentorIds } }).lean(),
                MentorMonthlyReport.countDocuments(filter),
            ]);

            return NextResponse.json({
                data,
                pagination: {
                    page,
                    limit: mentorsPerPage,
                    total: totalMentors,
                    totalPages: Math.ceil(totalMentors / mentorsPerPage),
                    unit: "mentors",
                },
                totalReports,
                mentorFellowCounts: await fellowCountsFor(pageMentorIds),
            });
        }

        const [data, total] = await Promise.all([
            populatedQuery(filter).skip(skip).limit(limit).lean(),
            MentorMonthlyReport.countDocuments(filter),
        ]);

        // Grouped listings show "reports / fellows" per mentor, so return how
        // many fellows each mentor on this page is responsible for.
        let mentorFellowCounts: Record<string, number> | undefined;
        if (sort.mentor) {
            const mentorIds = Array.from(new Set(data.map((r) => String(r.mentor?._id ?? r.mentor)).filter(Boolean)));
            mentorFellowCounts = await fellowCountsFor(mentorIds.map((id) => new mongoose.Types.ObjectId(id)));
        }

        return NextResponse.json({
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit), unit: "reports" },
            totalReports: total,
            ...(mentorFellowCounts ? { mentorFellowCounts } : {}),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== UserRole.MENTOR) {
            return NextResponse.json({ error: "Only mentors can submit fellow monthly reports." }, { status: 403 });
        }

        await connectDB();
        const mentorDoc = await Mentor.findOne({ authId: session.user.id }).lean();
        if (!mentorDoc) return NextResponse.json({ error: "Mentor profile not found." }, { status: 403 });

        const body = await request.json();

        const month = String(body.month ?? "");
        const isDraft = body.status === "draft";
        // A draft may be prepared before the month unlocks; the lock is enforced
        // when it is actually submitted.
        const lockReason = monthLockReason(month);
        if (lockReason && !isDraft) {
            return NextResponse.json({ error: lockReason }, { status: 400 });
        }

        const fellowDoc = await Fellow.findById(body.fellow).lean();
        if (!fellowDoc) return NextResponse.json({ error: "Fellow not found." }, { status: 400 });

        // One report per fellow per month, whichever mentor submits it
        const duplicate = await MentorMonthlyReport.findOne({ fellow: fellowDoc._id, month })
            .select("_id mentor status")
            .lean();
        if (duplicate) {
            const mine = String(duplicate.mentor) === String(mentorDoc._id);
            return NextResponse.json(
                {
                    error: mine
                        ? duplicate.status === "draft"
                            ? `You already have a draft for ${fellowDoc.name} for ${monthLabel(month)}. Open it from Drafts to continue.`
                            : `You have already submitted a report for ${fellowDoc.name} for ${monthLabel(month)}.`
                        : `A report for ${fellowDoc.name} for ${monthLabel(month)} has already been submitted by another mentor.`,
                    existingReportId: mine ? String(duplicate._id) : null,
                },
                { status: 409 }
            );
        }

        // Stamp the season in force right now; it never changes after creation.
        const season = await getCurrentReportSeason();

        const report = await MentorMonthlyReport.create({
            ...body,
            season,
            status: isDraft ? "draft" : "submitted",
            mentor: mentorDoc._id,
            fellowName: fellowDoc.name,
            fellowLGA: fellowDoc.lga ?? "",
            fellowQualification: fellowDoc.qualification ?? "",
        });

        void logActivity({
            session,
            action: isDraft ? "SAVE_MENTOR_MONTHLY_DRAFT" : "CREATE_MENTOR_MONTHLY_REPORT",
            targetType: "MentorMonthlyReport",
            targetId: String(report._id),
            targetName: `${fellowDoc.name} – ${body.month}`,
        });

        void ReportHistory.create({
            reportId: report._id,
            reportType: ReportHistoryReportType.MENTOR_MONTHLY_REPORT,
            action: ReportHistoryAction.CREATED,
            snapshot: null,
            actorId: session.user.id,
            actorName: session.user.name,
            actorRole: session.user.role,
        });

        return NextResponse.json(report, { status: 201 });
    } catch (error: any) {
        if (error.code === 11000) {
            return NextResponse.json(
                { error: "A report for this fellow and month already exists." },
                { status: 409 }
            );
        }
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
