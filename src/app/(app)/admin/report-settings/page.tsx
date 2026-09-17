/* ──────────────────────────────────────────
   Admin: Report Settings (report season + edit-lock toggles)
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/Card";
import { api, type ReportSettings } from "@/lib/api-client";
import {
  DEFAULT_REPORT_SEASON,
  REPORT_SEASONS,
  REPORT_SEASON_LABELS,
  normalizeReportSeason,
  type ReportSeason,
} from "@/lib/report-season";
import { AlertTriangle, Info } from "lucide-react";

const DEFAULT_SETTINGS: ReportSettings = {
  blockWeeklyReportEdits: { mentor: false, coordinator: false },
  blockMonthlyReportEdits: { mentor: false, coordinator: false },
  blockZonalAuditEdits: false,
  reportSeason: DEFAULT_REPORT_SEASON,
};

/** Merge an API response over the current state, defaulting anything missing. */
function mergeSettings(data: Partial<ReportSettings>, fallback: ReportSettings): ReportSettings {
  return {
    blockWeeklyReportEdits: data.blockWeeklyReportEdits ?? fallback.blockWeeklyReportEdits,
    blockMonthlyReportEdits: data.blockMonthlyReportEdits ?? fallback.blockMonthlyReportEdits,
    blockZonalAuditEdits: data.blockZonalAuditEdits ?? fallback.blockZonalAuditEdits,
    reportSeason: normalizeReportSeason(data.reportSeason ?? fallback.reportSeason),
  };
}

const SEASON_DESCRIPTIONS: Record<ReportSeason, string> = {
  regular:
    "Standard forms: weekly sessions record the topic discussed; fellow monthly reports include Learning / Courses Completed.",
  capstone:
    "Weekly sessions record the capstone project progress discussed; the Learning / Courses Completed field is removed from fellow monthly reports.",
};

type EditableLockSection = "blockWeeklyReportEdits" | "blockMonthlyReportEdits";

/* ─── Toggle Row ────────────────────────── */
function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-b-0">
      <div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <label
        className={["relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer", disabled ? "opacity-50 pointer-events-none" : ""].join(" ")}
        data-tooltip={checked ? `Disable: ${label}` : `Enable: ${label}`}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={["inline-flex h-6 w-11 rounded-full transition-colors", checked ? "bg-blue-600" : "bg-gray-300"].join(" ")}
        >
          <span
            className={["inline-block h-4 w-4 rounded-full bg-white shadow mt-1 transition-transform", checked ? "translate-x-6" : "translate-x-1"].join(" ")}
          />
        </span>
      </label>
    </div>
  );
}

/* ─── Main Page ────────────────────────── */
export default function ReportSettingsPage() {
  const [settings, setSettings] = useState<ReportSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.admin.getReportSettings();
      setSettings(mergeSettings(data, DEFAULT_SETTINGS));
    } catch (err) {
      setError((err as Error).message ?? "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (
    section: EditableLockSection,
    role: "mentor" | "coordinator",
    value: boolean,
  ) => {
    const optimistic: ReportSettings = {
      ...settings,
      [section]: { ...settings[section], [role]: value },
    };
    setSettings(optimistic);
    setSaving(true);
    setError("");
    try {
      const updated = await api.admin.updateReportSettings({
        [section]: { ...settings[section], [role]: value },
      });
      setSettings(mergeSettings(updated, optimistic));
    } catch (err) {
      setError((err as Error).message ?? "Failed to save setting");
      // Revert optimistic update on error
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleZonalAuditToggle = async (value: boolean) => {
    const optimistic: ReportSettings = {
      ...settings,
      blockZonalAuditEdits: value,
    };
    setSettings(optimistic);
    setSaving(true);
    setError("");
    try {
      const updated = await api.admin.updateReportSettings({ blockZonalAuditEdits: value });
      setSettings(mergeSettings(updated, optimistic));
    } catch (err) {
      setError((err as Error).message ?? "Failed to save setting");
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  const handleSeasonChange = async (value: ReportSeason) => {
    if (value === settings.reportSeason) return;
    const optimistic: ReportSettings = { ...settings, reportSeason: value };
    setSettings(optimistic);
    setSaving(true);
    setError("");
    try {
      const updated = await api.admin.updateReportSettings({ reportSeason: value });
      setSettings(mergeSettings(updated, optimistic));
    } catch (err) {
      setError((err as Error).message ?? "Failed to save setting");
      setSettings(settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Report Settings" />
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {saving && (
          <div className="flex items-center gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
            <span className="animate-spin inline-block h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            Saving changes…
          </div>
        )}

        {/* ─── Report Season ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Report Season</h2>
            <p className="text-sm text-gray-500 mb-4">
              Switch the weekly and fellow monthly report forms between the regular season and the
              capstone season.
            </p>

            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                The season applies to reports created from the moment it is switched. Reports that
                already exist keep the form they were written on, so changing this never alters
                submitted reports.
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div role="radiogroup" aria-label="Report season" className="space-y-2">
                {REPORT_SEASONS.map((season) => {
                  const active = settings.reportSeason === season;
                  return (
                    <label
                      key={season}
                      className={[
                        "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                        active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50",
                        saving ? "opacity-50 pointer-events-none" : "",
                      ].join(" ")}
                      data-tooltip={`Set report season to ${REPORT_SEASON_LABELS[season]}`}
                    >
                      <input
                        type="radio"
                        name="reportSeason"
                        value={season}
                        checked={active}
                        disabled={saving}
                        onChange={() => handleSeasonChange(season)}
                        className="mt-1 accent-blue-600"
                      />
                      <span>
                        <span className="block text-sm font-medium text-gray-800">
                          {REPORT_SEASON_LABELS[season]}
                          {active && (
                            <span className="ml-2 text-xs font-normal text-blue-700">Current</span>
                          )}
                        </span>
                        <span className="block text-xs text-gray-500 mt-0.5">
                          {SEASON_DESCRIPTIONS[season]}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Weekly Reports ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Weekly Reports</h2>
            <p className="text-sm text-gray-500 mb-4">
              Block users from editing existing weekly report submissions.
            </p>
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <ToggleRow
                  label="Block edits by Mentors"
                  description="Prevents mentors from editing their submitted weekly reports"
                  checked={settings.blockWeeklyReportEdits.mentor}
                  disabled={saving}
                  onChange={(v) => handleToggle("blockWeeklyReportEdits", "mentor", v)}
                />
                <ToggleRow
                  label="Block edits by Coordinators"
                  description="Prevents coordinators from editing mentors' weekly reports"
                  checked={settings.blockWeeklyReportEdits.coordinator}
                  disabled={saving}
                  onChange={(v) => handleToggle("blockWeeklyReportEdits", "coordinator", v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Monthly Reports ─── */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Monthly Reports</h2>
            <p className="text-sm text-gray-500 mb-4">
              Block users from editing existing fellow monthly report submissions.
            </p>

            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                These settings apply to fellow monthly report edits. Aggregate monthly summary
                reports remain read-only because they do not have an edit flow.
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                <ToggleRow
                  label="Block edits by Mentors"
                  description="Prevents mentors from editing their submitted fellow monthly reports"
                  checked={settings.blockMonthlyReportEdits.mentor}
                  disabled={saving}
                  onChange={(v) => handleToggle("blockMonthlyReportEdits", "mentor", v)}
                />
                <ToggleRow
                  label="Block edits by Coordinators"
                  description="Prevents coordinators from editing fellow monthly reports for their mentors"
                  checked={settings.blockMonthlyReportEdits.coordinator}
                  disabled={saving}
                  onChange={(v) => handleToggle("blockMonthlyReportEdits", "coordinator", v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Zonal Audits</h2>
            <p className="text-sm text-gray-500 mb-4">
              Block all users from editing saved zonal audits.
            </p>

            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                This lock hides the Edit action on saved zonal audits and blocks audit updates
                through the API. Delete remains unchanged.
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                <div className="h-10 bg-gray-100 rounded animate-pulse" />
              </div>
            ) : (
              <ToggleRow
                label="Block all zonal audit edits"
                description="Prevents coordinators and admins from editing saved zonal audits"
                checked={settings.blockZonalAuditEdits}
                disabled={saving}
                onChange={handleZonalAuditToggle}
              />
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
