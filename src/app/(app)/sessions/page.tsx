/* ──────────────────────────────────────────
   My Sessions page (mentor + fellow)
   List bookings and cancel upcoming ones.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type BookingItem } from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import { toExternalUrl } from "@/lib/utils";

const TZ = "Africa/Lagos";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: TZ,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

const STATUS_OPTIONS = [
  { label: "Upcoming", value: "upcoming" },
  { label: "All", value: "all" },
  { label: "Cancelled", value: "cancelled" },
];

const statusVariant = (status: string) =>
  status === "confirmed" ? "info" : status === "cancelled" ? "destructive" : "secondary";

export default function SessionsPage() {
  const { data: session } = useSession();
  const isMentor = session?.user?.role === UserRole.MENTOR;
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [error, setError] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: Record<string, string> = {};
      if (filter === "upcoming") {
        params.upcoming = "true";
        params.status = "confirmed";
      } else if (filter === "cancelled") {
        params.status = "cancelled";
      }
      const res = await api.bookings.list(params);
      setBookings(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sessions.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancel(id: string) {
    if (!confirm("Cancel this session?")) return;
    setCancellingId(id);
    try {
      await api.bookings.cancel(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel.");
    } finally {
      setCancellingId(null);
    }
  }

  function counterparty(b: BookingItem): string {
    if (isMentor) {
      return typeof b.fellow === "object" ? b.fellow.name : "Fellow";
    }
    return "your mentor";
  }

  return (
    <>
      <Header title="My Sessions" subtitle="Your booked mentorship sessions" />
      <div className="p-4 md:p-6 space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="w-48">
          <Select
            options={STATUS_OPTIONS}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="text-sm text-gray-500 py-10 text-center">Loading…</p>
        ) : bookings.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-gray-500">
              No sessions to show.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const isFuture = new Date(b.endAt).getTime() > Date.now();
              const canCancel = b.status === "confirmed" && isFuture;
              return (
                <Card key={b._id}>
                  <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900">{fmt(b.startAt)}</p>
                        <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-500">
                        {isMentor ? `With ${counterparty(b)}` : "With your mentor"}
                      </p>
                      {b.note && <p className="text-xs text-gray-600">Note: {b.note}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {b.meetingLink && b.status === "confirmed" && (
                        <a
                          href={toExternalUrl(b.meetingLink)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-orange-700 hover:underline"
                        >
                          Join
                        </a>
                      )}
                      {canCancel && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => cancel(b._id)}
                          disabled={cancellingId === b._id}
                        >
                          {cancellingId === b._id ? "Cancelling…" : "Cancel"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
