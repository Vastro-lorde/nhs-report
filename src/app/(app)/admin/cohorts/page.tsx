/* ──────────────────────────────────────────
   Admin: Cohorts
   List of cohorts, the cohort being set up (activate / discard), and the
   entry point to the new-cohort wizard.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { switchCohortView } from "@/components/layout/CohortBar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { api } from "@/lib/api-client";
import { COHORT_STATUS_LABELS, CohortStatus, type CohortSummary } from "@/lib/cohort";
import { AlertTriangle, Info, Layers, Plus } from "lucide-react";

const STATUS_BADGE: Record<CohortStatus, "default" | "info" | "secondary"> = {
  active: "default",
  setup: "info",
  archived: "secondary",
};

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function ActivatePanel({
  setup,
  active,
  onDone,
  onCancel,
}: {
  setup: CohortSummary;
  active: CohortSummary;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [resetSeason, setResetSeason] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<string[]>([]);

  const activate = async () => {
    setBusy(true);
    setError("");
    setProblems([]);
    try {
      await api.cohorts.activate(setup._id, { resetReportSeason: resetSeason });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setProblems((err as { problems?: string[] }).problems ?? []);
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-gray-900">Make {setup.name} the current cohort?</p>
      <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
        <li>
          <strong>{active.name}</strong> will be archived. Its people and reports stay exactly as they are, and
          admins can still browse them, read-only.
        </li>
        <li>Everyone in {setup.name} signs in with their usual email and password, in their {setup.name} role.</li>
        <li>People who are not in {setup.name} will no longer be able to sign in.</li>
        <li>Anyone signed in right now is moved over (or signed out) on their next page load.</li>
      </ul>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-0.5" checked={resetSeason} onChange={(e) => setResetSeason(e.target.checked)} />
        Reset the report season to <strong>Regular</strong> for the new cohort
      </label>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I&apos;ve finished setting up {setup.name} and want it to go live now
      </label>
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          <p>{error}</p>
          {problems.length > 1 && (
            <ul className="list-disc pl-5 mt-1">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="flex gap-2">
        <Button onClick={activate} disabled={!confirmed || busy}>
          {busy ? "Activating…" : `Activate ${setup.name}`}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<CohortSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showActivate, setShowActivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.cohorts.list();
      setCohorts(res.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const active = cohorts.find((c) => c.status === CohortStatus.ACTIVE);
  const setup = cohorts.find((c) => c.status === CohortStatus.SETUP);

  const discard = async () => {
    if (!setup) return;
    if (!window.confirm(`Discard ${setup.name}? Everyone and everything added to it so far will be removed. ${active?.name ?? "The current cohort"} is not affected.`)) return;
    setBusy(true);
    try {
      const res = await api.cohorts.discard(setup._id);
      setNotice(`${res.discarded} was discarded.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Cohorts" subtitle="Each cohort keeps its own people, assignments and reports" />
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {notice && (
          <div className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-lg p-3">{notice}</div>
        )}

        <Card>
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1 text-sm text-gray-600 space-y-1">
              <p className="flex items-center gap-2 font-medium text-gray-900">
                <Info className="h-4 w-4 text-gray-500" /> How cohorts work
              </p>
              <p>
                Everyone except admins belongs to a cohort, and so does every report. Starting a new cohort
                carries over the people you choose — in the same role or a new one — and leaves the previous
                cohort&apos;s records untouched. The new cohort stays in <em>setup</em> (invisible to everyone else)
                until you activate it.
              </p>
            </div>
            {!setup && (
              <Link href="/admin/cohorts/new" className="shrink-0">
                <Button disabled={loading || !active}>
                  <Plus className="h-4 w-4 mr-1.5" /> Start next cohort
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>

        {setup && active && (
          <Card className="border-blue-200">
            <CardContent className="p-5">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <p className="text-base font-semibold text-gray-900 flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-600" /> {setup.name} is being set up
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {setup.counts?.coordinator ?? 0} coordinators · {setup.counts?.mentor ?? 0} mentors ·{" "}
                    {setup.counts?.fellow ?? 0} fellows · {(setup.counts?.zonal_desk_officer ?? 0) + (setup.counts?.me_officer ?? 0) + (setup.counts?.team_research_lead ?? 0)} other staff.
                    Open it to add new people (including bulk upload), reassign mentors or remove anyone — using the
                    usual pages. {active.name} keeps running meanwhile.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" onClick={() => switchCohortView(setup._id, "/mentors")}>
                    Open {setup.name}
                  </Button>
                  <Button onClick={() => setShowActivate(true)} disabled={showActivate}>
                    Activate…
                  </Button>
                  <Button variant="ghost" className="text-red-600" onClick={discard} disabled={busy}>
                    Discard
                  </Button>
                </div>
              </div>
              {showActivate && (
                <ActivatePanel
                  setup={setup}
                  active={active}
                  onCancel={() => setShowActivate(false)}
                  onDone={() => {
                    // Switch-cohort cookie was cleared server-side; reload everything.
                    window.location.href = "/admin/cohorts";
                  }}
                />
              )}
            </CardContent>
          </Card>
        )}

        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Cohort</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Started</th>
                <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Ended</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Coordinators</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Mentors</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right">Fellows</th>
                <th className="px-4 py-3 font-medium text-gray-600 text-right hidden sm:table-cell">Weekly reports</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">Loading…</td>
                </tr>
              )}
              {!loading &&
                cohorts.map((c) => (
                  <tr key={c._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      {c.notes && <p className="text-xs text-gray-500 line-clamp-1 max-w-xs">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_BADGE[c.status]}>{COHORT_STATUS_LABELS[c.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">{fmtDate(c.startedAt)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-600">{fmtDate(c.endedAt)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.counts?.coordinator ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.counts?.mentor ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{c.counts?.fellow ?? 0}</td>
                    <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell">{c.counts?.weeklyReports ?? 0}</td>
                    <td className="px-4 py-3 text-right">
                      {c.status !== CohortStatus.ACTIVE && (
                        <Button size="sm" variant="outline" onClick={() => switchCohortView(c._id, "/dashboard")}>
                          View
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
