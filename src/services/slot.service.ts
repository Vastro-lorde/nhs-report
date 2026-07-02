/* ──────────────────────────────────────────
   Slot materializer service
   Expands recurring MentorAvailabilityTemplate rules
   into concrete TimeSlot documents for a rolling window.
   Idempotent: relies on the unique { mentor, startAt } index.
   ────────────────────────────────────────── */
import { Types } from "mongoose";
import { Mentor, MentorAvailabilityTemplate, TimeSlot } from "@/models";
import {
    SLOT_MATERIALIZATION_WEEKS,
    SESSION_DURATION_MINUTES,
    TimeSlotSource,
    TimeSlotStatus,
} from "@/lib/constants";
import { buildSlotStartTimes, zonedMidnightUtc } from "@/lib/schedule-helpers";
import { env } from "@/lib/env";

/** Day-of-week (0=Sun..6=Sat) for an instant in the app timezone. */
function zonedDayOfWeek(instant: Date): number {
    const weekday = new Intl.DateTimeFormat("en-US", {
        timeZone: env.TIMEZONE(),
        weekday: "short",
    }).format(instant);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[weekday] ?? 0;
}

/** Local calendar date parts (year, monthIndex, day) for an instant in the app timezone. */
function zonedDateParts(instant: Date): { year: number; monthIndex: number; day: number } {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: env.TIMEZONE(),
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(instant);
    const map: Record<string, number> = {};
    for (const p of parts) if (p.type !== "literal") map[p.type] = Number(p.value);
    return { year: map.year, monthIndex: (map.month ?? 1) - 1, day: map.day };
}

/**
 * Materialize concrete OPEN slots for a single mentor across the rolling window.
 * Existing slots (including booked/cancelled) are preserved. Past start times
 * are skipped. Returns the number of newly created slots.
 */
export async function materializeMentorSlots(
    mentorId: string | Types.ObjectId,
    weeks: number = SLOT_MATERIALIZATION_WEEKS,
): Promise<number> {
    const templates = await MentorAvailabilityTemplate.find({
        mentor: mentorId,
        active: true,
    }).lean();
    if (templates.length === 0) return 0;

    const now = new Date();
    const days = weeks * 7;
    const operations: {
        updateOne: {
            filter: Record<string, unknown>;
            update: Record<string, unknown>;
            upsert: true;
        };
    }[] = [];

    // Anchor on today's local date, then walk forward day by day.
    const todayParts = zonedDateParts(now);
    const dayCursor = zonedMidnightUtc(todayParts.year, todayParts.monthIndex, todayParts.day);

    for (let d = 0; d < days; d++) {
        const dayInstant = new Date(dayCursor.getTime() + d * 24 * 60 * 60 * 1000);
        const parts = zonedDateParts(dayInstant);
        const midnightUtc = zonedMidnightUtc(parts.year, parts.monthIndex, parts.day);
        const dow = zonedDayOfWeek(midnightUtc);

        for (const tpl of templates) {
            if (tpl.dayOfWeek !== dow) continue;
            const starts = buildSlotStartTimes(midnightUtc, tpl.startTime, tpl.endTime);
            for (const startAt of starts) {
                if (startAt.getTime() <= now.getTime()) continue; // skip past
                const endAt = new Date(startAt.getTime() + SESSION_DURATION_MINUTES * 60_000);
                operations.push({
                    updateOne: {
                        filter: { mentor: mentorId, startAt },
                        update: {
                            $setOnInsert: {
                                mentor: mentorId,
                                startAt,
                                endAt,
                                status: TimeSlotStatus.OPEN,
                                source: TimeSlotSource.TEMPLATE,
                                template: tpl._id,
                            },
                        },
                        upsert: true,
                    },
                });
            }
        }
    }

    if (operations.length === 0) return 0;
    const result = await TimeSlot.bulkWrite(operations, { ordered: false });
    return result.upsertedCount ?? 0;
}

/**
 * Materialize slots for every mentor that has at least one active template.
 * Intended for the daily cron that rolls the window forward.
 */
export async function materializeAllMentorSlots(
    weeks: number = SLOT_MATERIALIZATION_WEEKS,
): Promise<{ mentors: number; created: number }> {
    const mentorIds = await MentorAvailabilityTemplate.distinct("mentor", { active: true });
    let created = 0;
    for (const mentorId of mentorIds) {
        created += await materializeMentorSlots(mentorId as Types.ObjectId, weeks);
    }
    return { mentors: mentorIds.length, created };
}

/** Utility: does the given mentor exist? (guards callers) */
export async function mentorExists(mentorId: string | Types.ObjectId): Promise<boolean> {
    return (await Mentor.exists({ _id: mentorId })) !== null;
}
