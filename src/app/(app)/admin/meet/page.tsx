/* ──────────────────────────────────────────
   Admin: Google Meet monitoring
   Generate a mentor's persistent Meet link and view
   their meeting statistics (recordings / transcripts).
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { ScoreCard, Card, CardHeader, CardTitle, CardContent, SearchableSelect } from "@/components/ui";
import { api, type MeetStatsResponse } from "@/lib/api-client";
import { toExternalUrl } from "@/lib/utils";

const TZ = "Africa/Lagos";

function fmt(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminMeetPage() {
  const [mentorOptions, setMentorOptions] = useState<{ value: string; label: string }[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [mentorId, setMentorId] = useState("");
  const [selectedMentorLabel, setSelectedMentorLabel] = useState("");
  const [stats, setStats] = useState<MeetStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadMentors = useCallback(async (query?: string) => {
    setMentorLoading(true);
    try {
      const params: Record<string, string> = { limit: "50" };
      if (query) params.search = query;
      const res = await api.mentors.list(params);
      setMentorOptions(res.data.map((m) => ({ value: m._id, label: `${m.name} (${m.email})` })));
    } catch {
      setError("Failed to load mentors.");
    } finally {
      setMentorLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMentors();
  }, [loadMentors]);

  const onMentorSearch = (query: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadMentors(query), 300);
  };

  const loadStats = useCallback(async (id: string) => {
    if (!id) {
      setStats(null);
      return;
    }
    setLoadingStats(true);
    setError("");
    try {
      const res = await api.scheduling.meetStats(id);
      setStats(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load statistics.");
      setStats(null);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  useEffect(() => {
    loadStats(mentorId);
  }, [mentorId, loadStats]);

  async function generate() {
    if (!mentorId) return;
    setGenerating(true);
    setError("");
    setMessage("");
    try {
      const res = await api.scheduling.generateMeetLink(mentorId);
      setMessage(`Meet link generated and saved: ${res.meetingLink}`);
      await loadStats(mentorId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate the Meet link.");
    } finally {
      setGenerating(false);
    }
  }

  const summary = stats?.summary;

  return (
    <>
      <Header title="Meet Monitoring" subtitle="Generate mentor Meet links and review meeting activity" />
      <div className="p-4 md:p-6 space-y-6">
        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 break-all">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Select Mentor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-w-md">
              <SearchableSelect
                label="Mentor"
                placeholder="Search mentors by name or email…"
                options={mentorOptions}
                value={mentorId}
                selectedLabel={selectedMentorLabel}
                loading={mentorLoading}
                onSearch={onMentorSearch}
                onChange={(v) => {
                  setMentorId(v);
                  const opt = mentorOptions.find((o) => o.value === v);
                  setSelectedMentorLabel(opt?.label ?? "");
                }}
              />
            </div>

            {mentorId && stats && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-500">Google account:</span>
                  {stats.connected ? (
                    <Badge variant="info">{stats.email ?? "Connected"}</Badge>
                  ) : (
                    <Badge variant="secondary">Not connected</Badge>
                  )}
                </div>
                {stats.meetingLink && (
                  <p className="text-sm text-gray-700 break-all">
                    Current link:{" "}
                    <a href={toExternalUrl(stats.meetingLink)} target="_blank" rel="noopener noreferrer" className="text-orange-700 hover:underline">
                      {stats.meetingLink}
                    </a>
                  </p>
                )}
                {!stats.connected ? (
                  <p className="text-sm text-gray-500">
                    This mentor must connect their Google account (from their Schedule page) before a
                    link can be generated.
                  </p>
                ) : (
                  <div>
                    <Button onClick={generate} disabled={generating}>
                      {generating ? "Generating…" : "Generate & update meeting link"}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {mentorId && (
          <Card>
            <CardHeader>
              <CardTitle>Meeting Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
              ) : !summary ? (
                <p className="text-sm text-gray-500 py-6 text-center">
                  No statistics available yet.
                </p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ScoreCard title="Meetings" value={String(summary.totalMeetings)} />
                    <ScoreCard title="Total minutes" value={String(summary.totalMinutes)} />
                    <ScoreCard title="Recordings" value={String(summary.totalRecordings)} />
                    <ScoreCard title="Transcripts" value={String(summary.totalTranscripts)} />
                  </div>

                  {summary.meetings.length === 0 ? (
                    <p className="text-sm text-gray-500">No past meetings recorded for this space.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-gray-600 border-b">
                            <th className="px-3 py-2 font-medium">Started</th>
                            <th className="px-3 py-2 font-medium">Duration</th>
                            <th className="px-3 py-2 font-medium">Participants</th>
                            <th className="px-3 py-2 font-medium">Recording</th>
                            <th className="px-3 py-2 font-medium">Transcript</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {summary.meetings.map((m) => (
                            <tr key={m.conferenceRecord}>
                              <td className="px-3 py-2">{fmt(m.startTime)}</td>
                              <td className="px-3 py-2">
                                {m.durationMinutes === null ? "—" : `${m.durationMinutes} min`}
                              </td>
                              <td className="px-3 py-2">{m.participantCount}</td>
                              <td className="px-3 py-2">
                                {m.recordingUri ? (
                                  <a href={m.recordingUri} target="_blank" rel="noopener noreferrer" className="text-orange-700 hover:underline">
                                    View
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="px-3 py-2">
                                {m.transcriptUri ? (
                                  <a href={m.transcriptUri} target="_blank" rel="noopener noreferrer" className="text-orange-700 hover:underline">
                                    View
                                  </a>
                                ) : (
                                  "—"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
