/* ──────────────────────────────────────────
   Alerts Management Page (admin/coordinator)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type AlertItem } from "@/lib/api-client";
import { AlertStatus } from "@/lib/constants";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle, Clock, MessageSquare } from "lucide-react";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "New", value: AlertStatus.NEW },
  { label: "In Review", value: AlertStatus.IN_REVIEW },
  { label: "Resolved", value: AlertStatus.RESOLVED },
];

const statusIcon = (status: string) => {
  switch (status) {
    case AlertStatus.NEW:
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case AlertStatus.IN_REVIEW:
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case AlertStatus.RESOLVED:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return null;
  }
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const result = await api.alerts.list(params);
      const items = result.data ?? [];
      setAlerts(items);
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const updateAlert = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await api.alerts.update(id, { status, notes: notes || undefined });
      setExpandedId(null);
      setNotes("");
      fetchAlerts();
    } catch {
      /* no-op */
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <Header title="Urgent Alerts" subtitle="Monitor and manage outbreak alerts" />

      <div className="p-6 space-y-4">
        {/* Filter */}
        <Card>
          <CardContent className="pt-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={STATUS_OPTIONS}
              className="w-48"
            />
          </CardContent>
        </Card>

        {/* Alert list */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : !alerts.length ? (
          <div className="text-center py-12 text-gray-400">
            No alerts found.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card key={alert._id}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {statusIcon(alert.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge
                          variant={
                            alert.status === AlertStatus.NEW
                              ? "destructive"
                              : alert.status === AlertStatus.IN_REVIEW
                              ? "warning"
                              : "default"
                          }
                        >
                          {alert.status}
                        </Badge>
                        <span className="text-sm text-gray-500 font-mono">
                          {alert.weekKey}
                        </span>
                        <span className="text-sm text-gray-500">
                          {alert.state}
                        </span>
                        {(alert.mentorName || alert.mentor?.name) && (
                          <span className="text-sm text-gray-600 font-medium">
                            — {alert.mentorName ?? alert.mentor?.name}
                          </span>
                        )}
                      </div>

                      <p className="text-sm whitespace-pre-wrap">
                        {alert.urgentDetails}
                      </p>

                      {alert.notes && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                          <strong>Notes:</strong> {alert.notes}
                        </div>
                      )}

                      {alert.resolvedAt && (
                        <p className="text-xs text-gray-400 mt-1">
                          Resolved{" "}
                          {format(new Date(alert.resolvedAt), "MMM d, yyyy hh:mm a")}
                        </p>
                      )}

                      <p className="text-xs text-gray-400 mt-1">
                        Created{" "}
                        {format(new Date(alert.createdAt), "MMM d, yyyy hh:mm a")}
                      </p>
                    </div>

                    {/* Actions */}
                    {alert.status !== AlertStatus.RESOLVED && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expandedId === alert._id ? null : alert._id)
                        }
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Update
                      </Button>
                    )}
                  </div>

                  {/* Expanded update form */}
                  {expandedId === alert._id && (
                    <div className="mt-4 pt-4 border-t space-y-3">
                      <Select
                        label="Change Status"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) updateAlert(alert._id, e.target.value);
                        }}
                        options={[
                          { label: "Select new status…", value: "" },
                          { label: "In Review", value: AlertStatus.IN_REVIEW },
                          { label: "Resolved", value: AlertStatus.RESOLVED },
                        ]}
                        className="w-48"
                      />
                      <Textarea
                        label="Notes"
                        placeholder="Add notes about this alert…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => updateAlert(alert._id, AlertStatus.IN_REVIEW)}
                          disabled={updating}
                        >
                          Mark In Review
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => updateAlert(alert._id, AlertStatus.RESOLVED)}
                          disabled={updating}
                        >
                          Resolve
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
