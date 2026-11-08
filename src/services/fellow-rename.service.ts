import { Types } from "mongoose";
import { WeeklyReport } from "@/models/WeeklyReport";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Weekly report sessions reference a fellow only by name (`menteeName`), so a
 * rename leaves earlier sessions pointing at a name that no longer exists. That
 * splits the fellow in two on the session ranking, the fellow sessions page and
 * the fellow-monthly prefill. Carry the new name into the mentor's existing
 * reports so they keep resolving to the same fellow.
 */
export async function cascadeFellowRename(
    fellowId: Types.ObjectId,
    mentorId: Types.ObjectId,
    oldName: string,
    newName: string
): Promise<{ weeklyReports: number; monthlyReports: number }> {
    const from = oldName.trim();
    const to = newName.trim();
    if (!from || !to || from === to) return { weeklyReports: 0, monthlyReports: 0 };

    // Same tolerance the session lookups use: case-insensitive, any whitespace run.
    const tokens = from.split(/\s+/).map(escapeRegex);
    const nameRx = new RegExp(`^\\s*${tokens.join("\\s+")}\\s*$`, "i");

    const weekly = await WeeklyReport.updateMany(
        { mentor: mentorId, "sessions.menteeName": nameRx },
        { $set: { "sessions.$[s].menteeName": to } },
        { arrayFilters: [{ "s.menteeName": nameRx }], timestamps: false }
    );

    const monthly = await MentorMonthlyReport.updateMany(
        { fellow: fellowId, fellowName: { $ne: to } },
        { $set: { fellowName: to } },
        { timestamps: false }
    );

    return { weeklyReports: weekly.modifiedCount, monthlyReports: monthly.modifiedCount };
}
