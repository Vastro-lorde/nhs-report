/* ──────────────────────────────────────────
   Fellow "Book a Session" page
   Browse the mentor's open slots and book one.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type TimeSlotItem } from "@/lib/api-client";

const TZ = "Africa/Lagos";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    timeZone: TZ,
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BookPage() {
  const [mentorName, setMentorName] = useState("");
  const [slots, setSlots] = useState<TimeSlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimeSlotItem | null>(null);
  const [note, setNote] = useState("");
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fellows.mySlots();
      setMentorName(res.mentorName);
      setSlots(res.slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load slots.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmBooking() {
    if (!selected) return;
    setBooking(true);
    setError("");
    try {
      await api.bookings.create({ slotId: selected._id, note: note.trim() || undefined });
      setMessage(`Session booked for ${fmtDay(selected.startAt)}, ${fmtTime(selected.startAt)}.`);
      setSelected(null);
      setNote("");
      await load();
      setTimeout(() => setMessage(""), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book this slot.");
    } finally {
      setBooking(false);
    }
  }

  const grouped = useMemo(() => {
    const groups: Record<string, TimeSlotItem[]> = {};
    for (const s of slots) {
      (groups[fmtDay(s.startAt)] ??= []).push(s);
    }
    return groups;
  }, [slots]);

  return (
    <>
      <Header
        title="Book a Session"
        subtitle={mentorName ? `Available times with ${mentorName}` : "Available session times"}
      />
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

        {loading ? (
          <p className="text-sm text-gray-500 py-10 text-center">Loading available slots…</p>
        ) : slots.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No open slots right now. Your mentor will notify you when new times are available.
            </CardContent>
          </Card>
        ) : (
          Object.entries(grouped).map(([day, daySlots]) => (
            <Card key={day}>
              <CardHeader>
                <CardTitle className="text-base">{day}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((s) => (
                    <button
                      key={s._id}
                      type="button"
                      onClick={() => {
                        setSelected(s);
                        setError("");
                      }}
                      className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-800 hover:bg-orange-100"
                    >
                      {fmtTime(s.startAt)} – {fmtTime(s.endAt)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Booking modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Confirm your session</h2>
            <p className="text-sm text-gray-600">
              {fmtDay(selected.startAt)}
              <br />
              {fmtTime(selected.startAt)} – {fmtTime(selected.endAt)}
            </p>
            {selected.meetingLink && (
              <p className="text-xs text-gray-500 break-all">
                Meeting link: {selected.meetingLink}
              </p>
            )}
            <Textarea
              id="note"
              label="Note to your mentor (optional)"
              placeholder="Anything you'd like to discuss?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                  setNote("");
                }}
                disabled={booking}
              >
                Cancel
              </Button>
              <Button onClick={confirmBooking} disabled={booking}>
                {booking ? "Booking…" : "Confirm booking"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
