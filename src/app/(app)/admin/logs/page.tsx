/* ──────────────────────────────────────────
   Admin: Logs Page  (Activity / Exception / Integration)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import {
  api,
  type ActivityLog,
  type ExceptionLog,
  type IntegrationLog,
} from "@/lib/api-client";
import { UserRole } from "@/lib/constants";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
  Activity,
  AlertOctagon,
  Link2,
} from "lucide-react";

/* ─── Helpers ───────────────────────────── */
function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function roleBadgeVariant(role: string): "destructive" | "secondary" | "default" {
  if (role === UserRole.ADMIN) return "destructive";
  if (role === UserRole.COORDINATOR) return "secondary";
  return "default";
}

function actionVariant(action: string): "default" | "destructive" | "warning" | "secondary" {
  if (action.startsWith("DELETE") || action.startsWith("PERMANENT")) return "destructive";
  if (action.startsWith("CREATE") || action.startsWith("BULK")) return "default";
  if (action.startsWith("UPDATE") || action.startsWith("REASSIGN") || action.startsWith("PATCH") || action.startsWith("DEACTIVATE")) return "secondary";
  return "warning";
}

/* ─── Pagination ────────────────────────── */
function Pagination({
  page, totalPages, total,
  onPrev, onNext,
}: {
  page: number; totalPages: number; total: number;
  onPrev: () => void; onNext: () => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
      <span>Page {page} of {totalPages} ({total} entries)</span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/* ─── Date range inputs ─────────────────── */
function DateRange({
  from, to,
  onChange,
}: {
  from: string; to: string;
  onChange: (field: "from" | "to", val: string) => void;
}) {
  const cls = "h-10 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-600";
  return (
    <>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">From</label>
        <input type="date" value={from} onChange={(e) => onChange("from", e.target.value)} className={cls} />
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">To</label>
        <input type="date" value={to} onChange={(e) => onChange("to", e.target.value)} className={cls} />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   TAB 1 — Activity Logs
   ══════════════════════════════════════════ */
function ActivityLogsTab() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actorName, setActorName] = useState("");
  const [actorRole, setActorRole] = useState("");
  const [targetType, setTargetType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const TARGET_TYPES = ["Mentor", "Coordinator", "Admin", "DeskOfficer", "Report", "Fellow", "Alert", "DocumentType"];

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { page: String(page), limit: "50" };
      if (actorName) p.actorName = actorName;
      if (actorRole) p.actorRole = actorRole;
      if (targetType) p.targetType = targetType;
      if (from) p.from = from;
      if (to) p.to = to;
      const res = await api.logs.list(p);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, [page, actorName, actorRole, targetType, from, to]);

  useEffect(() => { void fetch(); }, [fetch]);

  const reset = () => { setActorName(""); setActorRole(""); setTargetType(""); setFrom(""); setTo(""); setPage(1); };
  const handleDateChange = (field: "from" | "to", val: string) => {
    field === "from" ? setFrom(val) : setTo(val);
    setPage(1);
  };

  const clearLogs = async () => {
    if (!window.confirm("Permanently clear ALL activity logs? This cannot be undone.")) return;
    setIsClearing(true);
    try { const r = await api.logs.clear(); alert(r.message); void fetch(); }
    catch (err) { alert((err as Error).message); }
    finally { setIsClearing(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <Input label="Actor name" placeholder="Search…" value={actorName}
              onChange={(e) => { setActorName(e.target.value); setPage(1); }} className="w-44" />
            <Select label="Actor role" value={actorRole}
              onChange={(e) => { setActorRole(e.target.value); setPage(1); }}
              options={[
                { label: "All Roles", value: "" },
                { label: "Admin", value: UserRole.ADMIN },
                { label: "Coordinator", value: UserRole.COORDINATOR },
                { label: "Mentor", value: UserRole.MENTOR },
                { label: "Desk Officer", value: UserRole.ZONAL_DESK_OFFICER },
              ]} className="w-44" />
            <Select label="Target type" value={targetType}
              onChange={(e) => { setTargetType(e.target.value); setPage(1); }}
              options={[{ label: "All Types", value: "" }, ...TARGET_TYPES.map((t) => ({ label: t, value: t }))]}
              className="w-44" />
            <DateRange from={from} to={to} onChange={handleDateChange} />
            <Button variant="outline" size="sm" onClick={reset}><RefreshCw className="h-4 w-4 mr-1" />Reset</Button>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={clearLogs} disabled={isClearing}>
              <Trash2 className="h-4 w-4 mr-1" />{isClearing ? "Clearing…" : "Clear All"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {["Time", "Actor", "Role", "Action", "Target", "IP"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : !logs.length ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No activity logs found.</td></tr>
            ) : logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(log.createdAt)}</td>
                <td className="px-4 py-3 font-medium">{log.actorName}</td>
                <td className="px-4 py-3">
                  <Badge variant={roleBadgeVariant(log.actorRole)}>{log.actorRole.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={actionVariant(log.action)}>{log.action.replace(/_/g, " ")}</Badge>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.targetType && <span className="font-medium text-gray-700">{log.targetType}: </span>}
                  {log.targetName || log.targetId || "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{log.ip || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total}
        onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 2 — Exception Logs
   ══════════════════════════════════════════ */
function ExceptionLogsTab() {
  const [logs, setLogs] = useState<ExceptionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [context, setContext] = useState("");
  const [message, setMessage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { page: String(page), limit: "50" };
      if (context) p.context = context;
      if (message) p.message = message;
      if (from) p.from = from;
      if (to) p.to = to;
      const res = await api.exceptionLogs.list(p);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, [page, context, message, from, to]);

  useEffect(() => { void fetch(); }, [fetch]);

  const reset = () => { setContext(""); setMessage(""); setFrom(""); setTo(""); setPage(1); };
  const handleDateChange = (field: "from" | "to", val: string) => {
    field === "from" ? setFrom(val) : setTo(val);
    setPage(1);
  };

  const clearLogs = async () => {
    if (!window.confirm("Permanently clear ALL exception logs? This cannot be undone.")) return;
    setIsClearing(true);
    try { const r = await api.exceptionLogs.clear(); alert(r.message); void fetch(); }
    catch (err) { alert((err as Error).message); }
    finally { setIsClearing(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <Input label="Context" placeholder="e.g. POST /api/reports" value={context}
              onChange={(e) => { setContext(e.target.value); setPage(1); }} className="w-56" />
            <Input label="Message" placeholder="Search error message…" value={message}
              onChange={(e) => { setMessage(e.target.value); setPage(1); }} className="w-56" />
            <DateRange from={from} to={to} onChange={handleDateChange} />
            <Button variant="outline" size="sm" onClick={reset}><RefreshCw className="h-4 w-4 mr-1" />Reset</Button>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={clearLogs} disabled={isClearing}>
              <Trash2 className="h-4 w-4 mr-1" />{isClearing ? "Clearing…" : "Clear All"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {["Time", "Context", "Message", "Actor", "Stack Trace"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : !logs.length ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No exception logs found.</td></tr>
            ) : logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(log.createdAt)}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-700 whitespace-nowrap">{log.context}</td>
                <td className="px-4 py-3 text-red-700 max-w-xs truncate">{log.message}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.actorName || "—"}</td>
                <td className="px-4 py-3">
                  {log.stack ? (
                    <button
                      className="text-xs text-blue-600 underline"
                      onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                    >
                      {expanded === log._id ? "Hide" : "Show"}
                    </button>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                  {expanded === log._id && (
                    <pre className="mt-2 text-xs bg-gray-100 rounded p-2 overflow-x-auto max-w-xl whitespace-pre-wrap break-all">
                      {log.stack}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total}
        onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

/* ══════════════════════════════════════════
   TAB 3 — Integration Logs
   ══════════════════════════════════════════ */
function IntegrationLogsTab() {
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [service, setService] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p: Record<string, string> = { page: String(page), limit: "50" };
      if (service) p.service = service;
      if (status) p.status = status;
      if (from) p.from = from;
      if (to) p.to = to;
      const res = await api.integrationLogs.list(p);
      setLogs(res.data);
      setTotalPages(res.pagination.totalPages);
      setTotal(res.pagination.total);
    } catch { /* no-op */ } finally { setLoading(false); }
  }, [page, service, status, from, to]);

  useEffect(() => { void fetch(); }, [fetch]);

  const reset = () => { setService(""); setStatus(""); setFrom(""); setTo(""); setPage(1); };
  const handleDateChange = (field: "from" | "to", val: string) => {
    field === "from" ? setFrom(val) : setTo(val);
    setPage(1);
  };

  const clearLogs = async () => {
    if (!window.confirm("Permanently clear ALL integration logs? This cannot be undone.")) return;
    setIsClearing(true);
    try { const r = await api.integrationLogs.clear(); alert(r.message); void fetch(); }
    catch (err) { alert((err as Error).message); }
    finally { setIsClearing(false); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <Select label="Service" value={service}
              onChange={(e) => { setService(e.target.value); setPage(1); }}
              options={[
                { label: "All Services", value: "" },
                { label: "Email", value: "email" },
                { label: "Cloudinary", value: "cloudinary" },
                { label: "Cron", value: "cron" },
              ]} className="w-44" />
            <Select label="Status" value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              options={[
                { label: "All", value: "" },
                { label: "Success", value: "success" },
                { label: "Failure", value: "failure" },
              ]} className="w-36" />
            <DateRange from={from} to={to} onChange={handleDateChange} />
            <Button variant="outline" size="sm" onClick={reset}><RefreshCw className="h-4 w-4 mr-1" />Reset</Button>
            <div className="flex-1" />
            <Button variant="destructive" size="sm" onClick={clearLogs} disabled={isClearing}>
              <Trash2 className="h-4 w-4 mr-1" />{isClearing ? "Clearing…" : "Clear All"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              {["Time", "Service", "Action", "Status", "Duration", "Actor", "Payload / Error"].map((h) => (
                <th key={h} className="px-4 py-3 font-medium text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
            ) : !logs.length ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No integration logs found.</td></tr>
            ) : logs.map((log) => (
              <tr key={log._id} className="hover:bg-gray-50 align-top">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{fmt(log.createdAt)}</td>
                <td className="px-4 py-3 font-medium capitalize">{log.service}</td>
                <td className="px-4 py-3 text-gray-700">{log.action.replace(/_/g, " ")}</td>
                <td className="px-4 py-3">
                  <Badge variant={log.status === "success" ? "default" : "destructive"}>
                    {log.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                  {log.durationMs != null ? `${log.durationMs} ms` : "—"}
                </td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{log.actorName || "—"}</td>
                <td className="px-4 py-3">
                  {(log.payload || log.error) && (
                    <button
                      className="text-xs text-blue-600 underline"
                      onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                    >
                      {expanded === log._id ? "Hide" : "Show"}
                    </button>
                  )}
                  {expanded === log._id && (
                    <pre className="mt-2 text-xs bg-gray-100 rounded p-2 overflow-x-auto max-w-sm whitespace-pre-wrap break-all">
                      {log.error
                        ? `Error: ${log.error}`
                        : JSON.stringify(log.payload, null, 2)}
                    </pre>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} totalPages={totalPages} total={total}
        onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}

/* ══════════════════════════════════════════
   Root page with tabs
   ══════════════════════════════════════════ */
type Tab = "activity" | "exception" | "integration";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "activity",    label: "Activity Logs",    icon: Activity },
  { id: "exception",   label: "Exception Logs",   icon: AlertOctagon },
  { id: "integration", label: "Integration Logs", icon: Link2 },
];

export default function LogsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("activity");

  return (
    <>
      <Header title="Logs" subtitle="Activity, exception, and integration audit trail" />

      <div className="p-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-gray-200">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={[
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md transition-colors",
                activeTab === id
                  ? "border border-b-white border-gray-200 bg-white text-orange-700 -mb-px"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "activity"    && <ActivityLogsTab />}
        {activeTab === "exception"   && <ExceptionLogsTab />}
        {activeTab === "integration" && <IntegrationLogsTab />}
      </div>
    </>
  );
}

