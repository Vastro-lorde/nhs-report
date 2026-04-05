/* ──────────────────────────────────────────
   Fellow Monthly Report – History Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, FilePlus, FileEdit, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { api, type ReportHistoryEntry } from "@/lib/api-client";
import { safeFormatISO } from "@/lib/date-helpers";

const ACTION_META: Record<string, { label: string; icon: typeof FilePlus; color: string }> = {
  created: { label: "Created", icon: FilePlus, color: "bg-green-100 text-green-800" },
  updated: { label: "Updated", icon: FileEdit, color: "bg-blue-100 text-blue-800" },
  deleted: { label: "Deleted", icon: Trash2, color: "bg-red-100 text-red-800" },
};

export default function FellowMonthlyReportHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [entries, setEntries] = useState<ReportHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.reports.fellowMonthly
      .history(id)
      .then(setEntries)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <>
        <Header title="Report History" />
        <div className="p-6 text-gray-500">Loading history…</div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Report History" />
        <div className="p-6 text-red-600">{error}</div>
      </>
    );
  }

  return (
    <>
      <Header title="Report History" subtitle="Fellow Monthly Report" />

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/reports/fellow-monthly/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to report
        </Button>

        {entries.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-gray-500">
              No history entries found for this report.
            </CardContent>
          </Card>
        ) : (
          <div className="relative border-l-2 border-gray-200 ml-4 space-y-6">
            {entries.map((entry) => {
              const meta = ACTION_META[entry.action] ?? ACTION_META.updated;
              const Icon = meta.icon;
              const isExpanded = expandedId === entry._id;

              return (
                <div key={entry._id} className="relative pl-8">
                  {/* Timeline dot */}
                  <div className="absolute -left-[11px] top-1 h-5 w-5 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center">
                    <Icon className="h-3 w-3 text-gray-600" />
                  </div>

                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className={meta.color}>{meta.label}</Badge>
                          <span className="text-sm font-medium">{entry.actorName}</span>
                          <span className="text-xs text-gray-500">({entry.actorRole})</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {safeFormatISO(entry.createdAt, "dd MMM yyyy, HH:mm")}
                        </div>
                      </div>
                    </CardHeader>

                    {entry.snapshot && (
                      <CardContent className="pt-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry._id)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {isExpanded ? "Hide" : "View"} snapshot
                        </button>

                        {isExpanded && (
                          <pre className="mt-2 max-h-80 overflow-auto rounded bg-gray-50 p-3 text-xs whitespace-pre-wrap break-words">
                            {JSON.stringify(JSON.parse(entry.snapshot), null, 2)}
                          </pre>
                        )}
                      </CardContent>
                    )}
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
