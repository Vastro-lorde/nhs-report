process.env.MONGODB_URI = "mongodb+srv://seun1234567:seun1234567@cluster0.owwon.mongodb.net/nhs-report?retryWrites=true&w=majority";
import { connectDB } from "./src/lib/db";
import { WeeklyReport, User, Alert, WeeklyRollup, Mentor, Coordinator } from "./src/models";
import mongoose from "mongoose";
import { UserRole, AlertStatus } from "./src/lib/constants";
import { currentWeekKey } from "./src/lib/date-helpers";

async function test() {
    await connectDB();
    const weekKey = currentWeekKey();

    const baseMentorFilter: any = { role: UserRole.MENTOR };
    const activeMentorFilter: any = { ...baseMentorFilter, active: true };
    const reportFilter: any = { weekKey };
    const alertFilter: any = { status: { $ne: AlertStatus.RESOLVED } };

    try {
        const [
            totalMentors,
            activeMentors,
            reportsThisWeek,
            openAlerts,
            latestRollups,
        ] = await Promise.all([
            User.countDocuments(baseMentorFilter),
            User.countDocuments(activeMentorFilter),
            WeeklyReport.countDocuments(reportFilter),
            Alert.countDocuments(alertFilter),
            WeeklyRollup.find().sort({ weekKey: -1 }).limit(12).lean(),
        ]);

        console.log("Stats count success");

        const aggregatePipeline: any[] = [];
        aggregatePipeline.push(
            {
                $lookup: {
                    from: "mentors",
                    localField: "mentor",
                    foreignField: "_id",
                    as: "mentorData",
                },
            },
            { $unwind: "$mentorData" },
            {
                $group: {
                    _id: { state: "$mentorData.state", weekKey: "$weekKey" },
                    count: { $sum: 1 },
                    sessions: { $sum: "$sessionsCount" },
                    checkins: { $sum: "$menteesCheckedIn" },
                },
            },
            { $sort: { "_id.weekKey": -1 } },
            { $limit: 200 }
        );

        const submissionsByState = await WeeklyReport.aggregate(aggregatePipeline);
        console.log("Submissions aggregate success", submissionsByState);

    } catch (err) {
        console.error("DASHBOARD ERROR:", err);
    }
    process.exit(0);
}

test();
