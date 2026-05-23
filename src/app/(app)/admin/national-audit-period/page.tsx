/* ──────────────────────────────────────────
   Periodic National Audit List + Generate Page
   Generate and view multi-month national federal
   oversight audit reports from saved zonal audits.
   ────────────────────────────────────────── */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, type GeneratedNationalAuditPeriod, type SavedNationalAuditPeriod } from "@/lib/api-client";
import { safeFormatISO } from "@/lib/date-helpers";
import { UserRole } from "@/lib/constants";
import type { NationalAuditPeriodType } from "@/types/national-audit";
import NationalAuditPeriodPreview from "@/components/reports/NationalAuditPeriodPreview";
import { useSession } from "next-auth/react";
import { CalendarRange, ClipboardList, Eye, Loader2, Save, Sparkles, Trash2 } from "lucide-react";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PRESETS = [
  { key: "q1", label: "Q1", start: 1, end: 3, periodType: "quarter" as const },
  { key: "q2", label: "Q2", start: 4, end: 6, periodType: "quarter" as const },
  { key: "q3", label: "Q3", start: 7, end: 9, periodType: "quarter" as const },
  { key: "q4", label: "Q4", start: 10, end: 12, periodType: "quarter" as const },
  { key: "h1", label: "H1", start: 1, end: 6, periodType: "half-year" as const },
  { key: "h2", label: "H2", start: 7, end: 12, periodType: "half-year" as const },
  { key: "year", label: "Year", start: 1, end: 12, periodType: "year" as const },
];

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

type RangeMode = "preset" | "custom";

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

function enumerateMonthKeys(startMonth: string, endMonth: string): string[] {
  if (!startMonth || !endMonth || startMonth > endMonth) return [];
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  const months: string[] = [];
  let cursorYear = start.year;
  let cursorMonth = start.monthNumber;

  while (cursorYear < end.year || (cursorYear === end.year && cursorMonth <= end.monthNumber)) {
    months.push(monthKey(cursorYear, cursorMonth));
    cursorMonth += 1;
    if (cursorMonth > 12) {
      cursorMonth = 1;
      cursorYear += 1;
    }
  }

  return months;
}

function monthShortLabel(month: string) {
  if (!MONTH_KEY_PATTERN.test(month)) return month || "-";
  const { year, monthNumber } = parseMonthKey(month);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function CoveragePanel({ generated }: { generated: GeneratedNationalAuditPeriod }) {
  const months = enumerateMonthKeys(generated.startMonth, generated.endMonth);
  const missingSet = new Set(
    generated.coverage.missingPairs.map((pair) => `${pair.zoneName}::${pair.month}`),
  );
  const zones = Array.from(new Set([
    ...generated.coverage.missingPairs.map((pair) => pair.zoneName),
    "North-Central",
    "North-East",
    "North-West",
    "South-East",
    "South-South",
    "South-West",
  ]));
  const missingCount = generated.coverage.missingPairs.length;

  return (
    <div className="rounded-md border bg-white">
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Coverage</p>
          <p className="text-xs text-gray-500">
            {generated.coverage.presentZoneMonths}/{generated.coverage.expectedZoneMonths} zone-months available
          </p>
        </div>
        <span className={missingCount ? "text-xs font-medium text-amber-700" : "text-xs font-medium text-emerald-700"}>
          {missingCount ? `${missingCount} missing` : "Complete"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium text-gray-600">Zone</th>
              {months.map((month) => (
                <th key={month} className="px-3 py-2 text-center font-medium text-gray-600">
                  {monthShortLabel(month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {zones.map((zoneName) => (
              <tr key={zoneName}>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-700">{zoneName}</td>
                {months.map((month) => {
                  const missing = missingSet.has(`${zoneName}::${month}`);
                  return (
                    <td key={month} className="px-3 py-2 text-center">
                      <span className={missing ? "text-amber-700" : "text-emerald-700"}>
                        {missing ? "Missing" : "Present"}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PeriodicNationalAuditPage() {
  const [audits, setAudits] = useState<SavedNationalAuditPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [year, setYear] = useState(new Date().getFullYear());
  const [rangeMode, setRangeMode] = useState<RangeMode>("preset");
  const [selectedPreset, setSelectedPreset] = useState("q1");
  const [customStartMonth, setCustomStartMonth] = useState(monthKey(new Date().getFullYear(), 1));
  const [customEndMonth, setCustomEndMonth] = useState(monthKey(new Date().getFullYear(), 3));
  const [generated, setGenerated] = useState<GeneratedNationalAuditPeriod | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === UserRole.ADMIN;

  const fetchAudits = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.reports.nationalAuditPeriod.list({ limit: "50" });
      setAudits(result.data);
      setTotal(result.pagination.total);
    } catch {
      // The shared API client handles auth redirects for protected failures.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAudits();
  }, [fetchAudits]);

  const activeRange = useMemo(() => {
    if (rangeMode === "custom") {
      return {
        startMonth: customStartMonth,
        endMonth: customEndMonth,
        periodType: "custom" as NationalAuditPeriodType,
      };
    }

    const preset = PRESETS.find((item) => item.key === selectedPreset) ?? PRESETS[0];
    return {
      startMonth: monthKey(year, preset.start),
      endMonth: monthKey(year, preset.end),
      periodType: preset.periodType,
    };
  }, [customEndMonth, customStartMonth, rangeMode, selectedPreset, year]);

  const canGenerate =
    MONTH_KEY_PATTERN.test(activeRange.startMonth) &&
    MONTH_KEY_PATTERN.test(activeRange.endMonth) &&
    activeRange.startMonth <= activeRange.endMonth;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenerated(null);
    setError("");
    try {
      const data = await api.reports.nationalAuditPeriod.generate(activeRange);
      setGenerated(data);
    } catch (err: unknown) {
      setError(errorMessage(err, "Generation failed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generated) return;
    setSaving(true);
    setError("");
    try {
      await api.reports.nationalAuditPeriod.save(generated);
      await fetchAudits();
    } catch (err: unknown) {
      setError(errorMessage(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this periodic national audit? This action cannot be undone.")) return;
    try {
      await api.reports.nationalAuditPeriod.delete(id);
      fetchAudits();
    } catch (err: unknown) {
      alert(`Failed to delete: ${errorMessage(err, "Delete failed")}`);
    }
  };

  return (
    <>
      <Header title="Periodic National Audit" subtitle="Multi-month national federal oversight reports" />

      <div className="space-y-4 p-6">
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="h-4 w-4" />
                Generate Period
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[160px_1fr]">
                <div className="flex flex-col gap-1">
                  <label htmlFor="audit-year" className="text-sm font-medium text-gray-700">
                    Year
                  </label>
                  <input
                    id="audit-year"
                    type="number"
                    min="2020"
                    max="2100"
                    value={year}
                    onChange={(event) => {
                      setYear(Number(event.target.value));
                      setGenerated(null);
                    }}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={rangeMode === "preset" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangeMode("preset");
                        setGenerated(null);
                      }}
                    >
                      Presets
                    </Button>
                    <Button
                      type="button"
                      variant={rangeMode === "custom" ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setRangeMode("custom");
                        setGenerated(null);
                      }}
                    >
                      Custom Range
                    </Button>
                  </div>

                  {rangeMode === "preset" ? (
                    <div className="flex flex-wrap gap-2">
                      {PRESETS.map((preset) => (
                        <Button
                          key={preset.key}
                          type="button"
                          variant={selectedPreset === preset.key ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => {
                            setSelectedPreset(preset.key);
                            setGenerated(null);
                          }}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <label htmlFor="custom-start-month" className="text-sm font-medium text-gray-700">
                          Start Month
                        </label>
                        <input
                          id="custom-start-month"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}-(0[1-9]|1[0-2])"
                          placeholder="2026-01"
                          value={customStartMonth}
                          onChange={(event) => {
                            setCustomStartMonth(event.target.value);
                            setGenerated(null);
                          }}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label htmlFor="custom-end-month" className="text-sm font-medium text-gray-700">
                          End Month
                        </label>
                        <input
                          id="custom-end-month"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{4}-(0[1-9]|1[0-2])"
                          placeholder="2026-03"
                          value={customEndMonth}
                          onChange={(event) => {
                            setCustomEndMonth(event.target.value);
                            setGenerated(null);
                          }}
                          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-600">
                  Selected: <span className="font-medium text-gray-900">{monthShortLabel(activeRange.startMonth)} to {monthShortLabel(activeRange.endMonth)}</span>
                </p>
                <Button onClick={handleGenerate} disabled={!canGenerate || generating}>
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate
                    </>
                  )}
                </Button>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </CardContent>
          </Card>
        )}

        {generated && (
          <div className="space-y-4">
            <CoveragePanel generated={generated} />
            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base">{generated.periodLabel}</CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    {generated.coverage.presentZoneMonths}/{generated.coverage.expectedZoneMonths} zone-months available
                  </p>
                </div>
                {isAdmin && (
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Audit
                      </>
                    )}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <NationalAuditPeriodPreview data={generated.auditData} />
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardContent className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-gray-600">
              {total} audit{total === 1 ? "" : "s"} found.
            </div>
          </CardContent>
        </Card>

        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Period</th>
                <th className="px-4 py-3 font-medium text-gray-600">Coverage</th>
                <th className="px-4 py-3 font-medium text-gray-600">Generated By</th>
                <th className="hidden px-4 py-3 font-medium text-gray-600 sm:table-cell">Created</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading audits...</td>
                </tr>
              ) : !audits.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <ClipboardList className="h-8 w-8 text-gray-300" />
                      <p>No periodic national audits saved yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                audits.map((audit) => (
                  <tr key={audit._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">
                      <span className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                        {audit.periodLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {audit.coverage.presentZoneMonths}/{audit.coverage.expectedZoneMonths}
                      {audit.coverage.missingPairs.length > 0 && (
                        <span className="ml-2 text-xs text-amber-700">{audit.coverage.missingPairs.length} missing</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{audit.generatedBy?.name || "Unknown"}</td>
                    <td className="hidden px-4 py-3 text-gray-600 sm:table-cell">
                      {safeFormatISO(audit.createdAt, "dd MMM yyyy")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/admin/national-audit-period/${audit._id}`}>
                          <Button variant="ghost" size="icon" aria-label="View Audit">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Delete Audit"
                            onClick={() => handleDelete(audit._id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
