/* ──────────────────────────────────────────
   Mentor Schedule page
   Manage meeting link, recurring availability,
   one-off slots, and publish availability to fellows.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type AvailabilityTemplate, type TimeSlotItem } from "@/lib/api-client";
import { SESSION_DURATION_MINUTES } from "@/lib/constants";
import { Trash2, Plus } from "lucide-react";

const DAYS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

interface TemplateRow {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

const TZ = "Africa/Lagos";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Minutes since midnight for an "HH:MM" value, or null if invalid. */
function toMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Format minutes-since-midnight as a 12-hour label, e.g. "10:40 AM". */
function labelFromMinutes(total: number): string {
  const h24 = Math.floor(total / 60) % 24;
  const min = total % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(min).padStart(2, "0")} ${period}`;
}

/**
 * Split an availability window into consecutive session-length slots.
 * Returns each slot's "start – end" label. Empty if the window is invalid
 * or too short for a single session.
 */
function splitWindow(startTime: string, endTime: string): string[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  if (start === null || end === null || end <= start) return [];
  const out: string[] = [];
  for (let m = start; m + SESSION_DURATION_MINUTES <= end; m += SESSION_DURATION_MINUTES) {
    out.push(`${labelFromMinutes(m)} – ${labelFromMinutes(m + SESSION_DURATION_MINUTES)}`);
  }
  return out;
}

export default function SchedulePage() {
  const [meetingLink, setMeetingLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [googleEmail, setGoogleEmail] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [slots, setSlots] = useState<TimeSlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // One-off slot
  const [oneOffStart, setOneOffStart] = useState("");
  const [oneOffLink, setOneOffLink] = useState("");
  const [addingSlot, setAddingSlot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, availability] = await Promise.all([
        api.scheduling.getMe(),
        api.scheduling.getAvailability(),
      ]);
      setMeetingLink(me.meetingLink ?? "");
      setGoogleEmail(me.google?.email ?? null);
      setRows(
        availability.templates.map((t: AvailabilityTemplate) => ({
          dayOfWeek: String(t.dayOfWeek),
          startTime: t.startTime,
          endTime: t.endTime,
        })),
      );
      setSlots(availability.slots);
    } catch {
      setError("Failed to load your schedule.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the result of the Google OAuth redirect (?google=connected|denied|...).
  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get("google");
    if (!status) return;
    if (status === "connected") setMessage("Google account connected.");
    else if (status === "denied") setError("Google connection was cancelled.");
    else if (status === "no_refresh")
      setError("Google did not return a refresh token. Please remove app access in your Google account and reconnect.");
    else if (status === "mismatch" || status === "error")
      setError("Google connection failed. Please try again.");
    // Clean the query string.
    window.history.replaceState({}, "", "/schedule");
  }, []);

  function flash(msg: string) {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 4000);
  }

  async function connectGoogle() {
    setConnectingGoogle(true);
    setError("");
    try {
      const { url } = await api.scheduling.connectGoogle();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start Google connection.");
      setConnectingGoogle(false);
    }
  }

  async function saveMeetingLink() {
    setSavingLink(true);
    setError("");
    try {
      await api.scheduling.updateMeetingLink(meetingLink.trim());
      flash("Meeting link saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save meeting link.");
    } finally {
      setSavingLink(false);
    }
  }

  function addRow() {
    setRows((r) => [...r, { dayOfWeek: "1", startTime: "10:00", endTime: "12:00" }]);
  }

  function updateRow(i: number, field: keyof TemplateRow, value: string) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function saveTemplates() {
    setSavingTemplates(true);
    setError("");
    try {
      const res = await api.scheduling.saveTemplates(
        rows.map((r) => ({
          dayOfWeek: Number(r.dayOfWeek),
          startTime: r.startTime,
          endTime: r.endTime,
          active: true,
        })),
      );
      flash(`Availability saved. ${res.slotsCreated} new slot(s) created.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save availability.");
    } finally {
      setSavingTemplates(false);
    }
  }

  async function addOneOff() {
    if (!oneOffStart) return;
    setAddingSlot(true);
    setError("");
    try {
      await api.scheduling.addSlot({
        startAt: new Date(oneOffStart).toISOString(),
        meetingLinkOverride: oneOffLink.trim() || undefined,
      });
      setOneOffStart("");
      setOneOffLink("");
      flash("One-off slot added.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add slot.");
    } finally {
      setAddingSlot(false);
    }
  }

  async function deleteSlot(id: string) {
    try {
      await api.scheduling.deleteSlot(id);
      setSlots((s) => s.filter((x) => x._id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove slot.");
    }
  }

  async function publish() {
    setPublishing(true);
    setError("");
    try {
      const res = await api.scheduling.publish();
      flash(`Notified ${res.notified} fellow(s) about ${res.openSlots} open slot(s).`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish availability.");
    } finally {
      setPublishing(false);
    }
  }

  const groupedSlots = useMemo(() => {
    const groups: Record<string, TimeSlotItem[]> = {};
    for (const s of slots) {
      const key = new Date(s.startAt).toLocaleDateString("en-GB", {
        timeZone: TZ,
        weekday: "long",
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      (groups[key] ??= []).push(s);
    }
    return groups;
  }, [slots]);

  return (
    <>
      <Header title="My Schedule" subtitle="Set your availability for fellows to book" />
      <div className="p-4 md:p-6 space-y-6">
        {message && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
            {message}
          </div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Google Meet connection — hidden once a meeting link is set */}
        {!meetingLink && (
        <Card>
          <CardHeader>
            <CardTitle>Google Meet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              Connect your Google account so an admin can generate a persistent Meet link for you.
              You start recording and transcription manually inside each meeting.
            </p>
            {googleEmail ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm text-gray-800">
                  Connected as <span className="font-medium">{googleEmail}</span>
                </p>
                <Button variant="secondary" onClick={connectGoogle} disabled={connectingGoogle}>
                  {connectingGoogle ? "Redirecting…" : "Reconnect"}
                </Button>
              </div>
            ) : (
              <Button onClick={connectGoogle} disabled={connectingGoogle}>
                {connectingGoogle ? "Redirecting…" : "Connect Google Meet"}
              </Button>
            )}
          </CardContent>
        </Card>
        )}

        {/* Meeting link */}
        <Card>
          <CardHeader>
            <CardTitle>Default Meeting Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              Prefilled on every slot unless a slot has its own link.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="meetingLink"
                name="meetingLink"
                placeholder="https://meet.google.com/your-room"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                className="flex-1"
              />
              <Button onClick={saveMeetingLink} disabled={savingLink}>
                {savingLink ? "Saving…" : "Save link"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Recurring availability */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Each window is automatically split into {SESSION_DURATION_MINUTES}-minute bookable
              sessions for the next few weeks.
            </p>
            {rows.length === 0 && (
              <p className="text-sm text-gray-400">No recurring availability yet.</p>
            )}
            <div className="space-y-4">
              {rows.map((row, i) => {
                const sessions = splitWindow(row.startTime, row.endTime);
                const hasWindow = Boolean(row.startTime && row.endTime);
                return (
                  <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="w-40">
                        <Select
                          label="Day"
                          options={DAYS}
                          value={row.dayOfWeek}
                          onChange={(e) => updateRow(i, "dayOfWeek", e.target.value)}
                        />
                      </div>
                      <Input
                        id={`start-${i}`}
                        label="Start"
                        type="time"
                        value={row.startTime}
                        onChange={(e) => updateRow(i, "startTime", e.target.value)}
                      />
                      <Input
                        id={`end-${i}`}
                        label="End"
                        type="time"
                        value={row.endTime}
                        onChange={(e) => updateRow(i, "endTime", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-md"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Live split preview */}
                    {hasWindow && sessions.length === 0 ? (
                      <p className="text-xs text-amber-600">
                        This window is shorter than one {SESSION_DURATION_MINUTES}-minute session.
                      </p>
                    ) : sessions.length > 0 ? (
                      <div>
                        <p className="text-xs text-gray-500 mb-1.5">
                          {sessions.length} session{sessions.length === 1 ? "" : "s"} of{" "}
                          {SESSION_DURATION_MINUTES} min:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {sessions.map((label, si) => (
                            <span
                              key={si}
                              className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700"
                            >
                              {label}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" /> Add window
              </Button>
              <Button onClick={saveTemplates} disabled={savingTemplates}>
                {savingTemplates ? "Saving…" : "Save availability"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* One-off slot */}
        <Card>
          <CardHeader>
            <CardTitle>Add a One-off Slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <Input
                id="oneOffStart"
                label="Date & time"
                type="datetime-local"
                value={oneOffStart}
                onChange={(e) => setOneOffStart(e.target.value)}
              />
              <Input
                id="oneOffLink"
                label="Meeting link (optional)"
                placeholder="Overrides default"
                value={oneOffLink}
                onChange={(e) => setOneOffLink(e.target.value)}
              />
              <Button onClick={addOneOff} disabled={addingSlot || !oneOffStart}>
                {addingSlot ? "Adding…" : "Add slot"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming slots */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Slots</CardTitle>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? "Notifying…" : "Notify fellows"}
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No upcoming slots yet.
              </p>
            ) : (
              <div className="space-y-5">
                {Object.entries(groupedSlots).map(([day, daySlots]) => (
                  <div key={day}>
                    <p className="text-sm font-semibold text-gray-700 mb-2">{day}</p>
                    <div className="flex flex-wrap gap-2">
                      {daySlots.map((s) => (
                        <div
                          key={s._id}
                          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5"
                        >
                          <span className="text-sm text-gray-800">{fmtTime(s.startAt)}</span>
                          <Badge variant={s.status === "open" ? "info" : s.status === "booked" ? "warning" : "secondary"}>
                            {s.status}
                          </Badge>
                          {s.status === "open" && (
                            <button
                              type="button"
                              onClick={() => deleteSlot(s._id)}
                              className="text-red-500 hover:text-red-700"
                              aria-label="Delete slot"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
