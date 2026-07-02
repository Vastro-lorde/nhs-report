/* ──────────────────────────────────────────
   Scheduling helpers
   Shared utilities for materializing recurring
   availability into concrete slots and for
   formatting slot times in the app timezone.
   ────────────────────────────────────────── */
import { env } from "@/lib/env";
import { SESSION_DURATION_MINUTES } from "@/lib/constants";

/** Parse an "HH:MM" string into { hours, minutes }. Returns null if invalid. */
export function parseTimeOfDay(value: string): { hours: number; minutes: number } | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
    return { hours, minutes };
}

/** Minutes since midnight for an "HH:MM" string, or null if invalid. */
export function timeToMinutes(value: string): number | null {
    const parsed = parseTimeOfDay(value);
    if (!parsed) return null;
    return parsed.hours * 60 + parsed.minutes;
}

/**
 * Given a calendar date and a start/end time window, produce the list of
 * concrete slot start Date objects (each SESSION_DURATION_MINUTES long) that
 * fit fully within the window. Times are interpreted in the app timezone by
 * building an ISO string and letting the caller pass a date already anchored
 * to the correct day.
 *
 * `baseUtcMidnight` must be the UTC instant representing 00:00 of the target
 * day in the app timezone.
 */
export function buildSlotStartTimes(
    baseUtcMidnight: Date,
    startTime: string,
    endTime: string,
    durationMinutes: number = SESSION_DURATION_MINUTES,
): Date[] {
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (startMin === null || endMin === null || endMin <= startMin) return [];

    const slots: Date[] = [];
    for (let m = startMin; m + durationMinutes <= endMin; m += durationMinutes) {
        slots.push(new Date(baseUtcMidnight.getTime() + m * 60_000));
    }
    return slots;
}

/**
 * Compute the UTC instant of midnight (00:00) for a given calendar day in the
 * app timezone. `year`, `monthIndex` (0-based), `day` describe the local date.
 */
export function zonedMidnightUtc(year: number, monthIndex: number, day: number): Date {
    const tz = env.TIMEZONE();
    // Start from a UTC guess, then correct for the zone offset at that instant.
    const utcGuess = Date.UTC(year, monthIndex, day, 0, 0, 0);
    const offsetMs = timezoneOffsetMs(new Date(utcGuess), tz);
    return new Date(utcGuess - offsetMs);
}

/** Offset (ms) of `tz` from UTC at the given instant. Positive east of UTC. */
function timezoneOffsetMs(instant: Date, tz: string): number {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
    const parts = dtf.formatToParts(instant);
    const map: Record<string, number> = {};
    for (const p of parts) {
        if (p.type !== "literal") map[p.type] = Number(p.value);
    }
    const asUtc = Date.UTC(
        map.year,
        (map.month ?? 1) - 1,
        map.day,
        map.hour === 24 ? 0 : map.hour,
        map.minute,
        map.second,
    );
    return asUtc - instant.getTime();
}

/**
 * Human-friendly label for a session in the app timezone, e.g.
 * "Mon, 07 Jul 2026, 10:00 AM – 10:40 AM (WAT)".
 */
export function formatSlotLabel(startAt: Date, endAt: Date): string {
    const tz = env.TIMEZONE();
    const dayFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const timeFmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
    return `${dayFmt.format(startAt)}, ${timeFmt.format(startAt)} – ${timeFmt.format(endAt)}`;
}
