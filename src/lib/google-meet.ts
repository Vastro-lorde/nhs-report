/* ──────────────────────────────────────────
   Google Meet integration (OAuth + Meet REST API v2)
   Uses a per-mentor OAuth refresh token so that
   generated spaces (and their recordings/transcripts)
   are owned by the mentor's Google account.
   ────────────────────────────────────────── */
import { env } from "@/lib/env";

const MEET_API = "https://meet.googleapis.com/v2";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Scopes: create spaces, read conference artifacts, read the user's email. */
export const GOOGLE_MEET_SCOPES = [
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
];

export interface GoogleTokenResponse {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
}

export interface MeetSpace {
    name: string; // "spaces/abc"
    meetingUri: string;
    meetingCode: string;
}

/** Build the Google OAuth consent URL. `state` round-trips the mentor id. */
export function buildAuthUrl(state: string): string {
    const { clientId, authUri } = env.GOOGLE_CREDENTIALS();
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: env.GOOGLE_REDIRECT_URI(),
        response_type: "code",
        scope: GOOGLE_MEET_SCOPES.join(" "),
        access_type: "offline",
        prompt: "consent", // force a refresh_token every time
        include_granted_scopes: "true",
        state,
    });
    return `${authUri}?${params.toString()}`;
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const { clientId, clientSecret, tokenUri } = env.GOOGLE_CREDENTIALS();
    const res = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: env.GOOGLE_REDIRECT_URI(),
            grant_type: "authorization_code",
        }),
    });
    if (!res.ok) {
        throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as GoogleTokenResponse;
}

/** Get a fresh access token from a stored refresh token. */
export async function getAccessToken(refreshToken: string): Promise<string> {
    const { clientId, clientSecret, tokenUri } = env.GOOGLE_CREDENTIALS();
    const res = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
        }),
    });
    if (!res.ok) {
        throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as GoogleTokenResponse;
    return data.access_token;
}

/** Fetch the email address of the connected Google account. */
export async function getUserEmail(accessToken: string): Promise<string | undefined> {
    const res = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { email?: string };
    return data.email;
}

/**
 * Create a reusable Meet space owned by the connected Google account. The
 * returned `meetingUri` becomes the mentor's meeting link. Recording and
 * transcription are started manually by the mentor inside the meeting.
 */
export async function createMeetSpace(accessToken: string): Promise<MeetSpace> {
    const res = await fetch(`${MEET_API}/spaces`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ config: { accessType: "TRUSTED", entryPointAccess: "ALL" } }),
    });
    if (!res.ok) {
        throw new Error(`Failed to create Meet space: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as MeetSpace;
}

export interface MeetMeetingStat {
    conferenceRecord: string;
    startTime?: string;
    endTime?: string;
    durationMinutes: number | null;
    participantCount: number;
    recordingUri?: string;
    transcriptUri?: string;
}

export interface MeetStatsSummary {
    totalMeetings: number;
    totalMinutes: number;
    totalRecordings: number;
    totalTranscripts: number;
    meetings: MeetMeetingStat[];
}

async function meetGet<T>(accessToken: string, path: string): Promise<T> {
    const res = await fetch(`${MEET_API}/${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        throw new Error(`Meet API GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return (await res.json()) as T;
}

/**
 * Aggregate meeting statistics for a mentor's space: past conferences with
 * duration, participant counts, and links to recordings/transcripts.
 */
export async function getMeetStats(
    accessToken: string,
    spaceName: string,
    maxMeetings = 25,
): Promise<MeetStatsSummary> {
    const filter = encodeURIComponent(`space.name="${spaceName}"`);
    const listed = await meetGet<{
        conferenceRecords?: Array<{ name: string; startTime?: string; endTime?: string }>;
    }>(accessToken, `conferenceRecords?filter=${filter}&pageSize=${maxMeetings}`);

    const records = listed.conferenceRecords ?? [];
    const meetings: MeetMeetingStat[] = [];
    let totalMinutes = 0;
    let totalRecordings = 0;
    let totalTranscripts = 0;

    for (const rec of records) {
        const id = rec.name; // "conferenceRecords/xxx"

        const [participants, recordings, transcripts] = await Promise.all([
            meetGet<{ totalSize?: number; participants?: unknown[] }>(
                accessToken,
                `${id}/participants?pageSize=100`,
            ).catch(() => ({ totalSize: 0, participants: [] })),
            meetGet<{ recordings?: Array<{ driveDestination?: { exportUri?: string } }> }>(
                accessToken,
                `${id}/recordings`,
            ).catch(() => ({ recordings: [] })),
            meetGet<{ transcripts?: Array<{ docsDestination?: { exportUri?: string } }> }>(
                accessToken,
                `${id}/transcripts`,
            ).catch(() => ({ transcripts: [] })),
        ]);

        let durationMinutes: number | null = null;
        if (rec.startTime && rec.endTime) {
            durationMinutes = Math.max(
                0,
                Math.round((new Date(rec.endTime).getTime() - new Date(rec.startTime).getTime()) / 60000),
            );
            totalMinutes += durationMinutes;
        }

        const recordingUri = recordings.recordings?.[0]?.driveDestination?.exportUri;
        const transcriptUri = transcripts.transcripts?.[0]?.docsDestination?.exportUri;
        if (recordings.recordings?.length) totalRecordings += recordings.recordings.length;
        if (transcripts.transcripts?.length) totalTranscripts += transcripts.transcripts.length;

        meetings.push({
            conferenceRecord: id,
            startTime: rec.startTime,
            endTime: rec.endTime,
            durationMinutes,
            participantCount: participants.totalSize ?? participants.participants?.length ?? 0,
            recordingUri,
            transcriptUri,
        });
    }

    return {
        totalMeetings: records.length,
        totalMinutes,
        totalRecordings,
        totalTranscripts,
        meetings,
    };
}
