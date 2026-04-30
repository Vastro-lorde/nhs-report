/* ──────────────────────────────────────────
   Per-Fellow Monthly Report – Edit Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { api, type MentorMonthlyReport } from "@/lib/api-client";
import { Loader2, Plus, Trash2 } from "lucide-react";

const PROGRESS_RATINGS = ["Excellent", "Good", "Fair", "Needs Improvement"] as const;

export default function EditMentorMonthlyReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // ─── Loading state ────────────────────────
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ─── Readonly fields ──────────────────────
  const [month, setMonth] = useState("");
  const [fellowName, setFellowName] = useState("");
  const [fellowLGA, setFellowLGA] = useState("");
  const [fellowQualification, setFellowQualification] = useState("");

  // ─── Editable fields ─────────────────────
  const [sessionsHeld, setSessionsHeld] = useState(0);
  const [sessionsAttended, setSessionsAttended] = useState(0);
  const [sessionsAbsent, setSessionsAbsent] = useState(0);

  const [summaryLearning, setSummaryLearning] = useState("");
  const [summaryPhcVisits, setSummaryPhcVisits] = useState("");
  const [summaryActivities, setSummaryActivities] = useState("");
  const [summaryGrowth, setSummaryGrowth] = useState("");
  const [summaryImpact, setSummaryImpact] = useState("");

  const [challenges, setChallenges] = useState<string[]>([""]);
  const [recommendations, setRecommendations] = useState<string[]>([""]);
  const [progressRating, setProgressRating] = useState<string>("");
  const [achievements, setAchievements] = useState("");

  // ─── Submit state ─────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ─── Load existing report ─────────────────
  useEffect(() => {
    async function load() {
      try {
        const report: MentorMonthlyReport = await api.reports.fellowMonthly.get(id);

        setMonth(report.month);
        setFellowName(report.fellowName);
        setFellowLGA(report.fellowLGA);
        setFellowQualification(report.fellowQualification ?? "");

        setSessionsHeld(report.sessionsHeld);
        setSessionsAttended(report.sessionsAttended);
        setSessionsAbsent(report.sessionsAbsent);

        setSummaryLearning(report.summaryLearning ?? "");
        setSummaryPhcVisits(report.summaryPhcVisits ?? "");
        setSummaryActivities(report.summaryActivities ?? "");
        setSummaryGrowth(report.summaryGrowth ?? "");
        setSummaryImpact(report.summaryImpact ?? "");

        setChallenges(report.challenges.length > 0 ? report.challenges : [""]);
        setRecommendations(report.recommendations.length > 0 ? report.recommendations : [""]);
        setProgressRating(report.progressRating ?? "");
        setAchievements(report.achievements ?? "");
      } catch (err: any) {
        setLoadError(err.message ?? "Failed to load report.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ─── Recalculate absent ───────────────────
  useEffect(() => {
    setSessionsAbsent(Math.max(0, sessionsHeld - sessionsAttended));
  }, [sessionsHeld, sessionsAttended]);

  // ─── Bullet list helpers ──────────────────
  function updateList(
    list: string[],
    setList: (v: string[]) => void,
    idx: number,
    value: string
  ) {
    const next = [...list];
    next[idx] = value;
    setList(next);
  }

  function addItem(list: string[], setList: (v: string[]) => void) {
    setList([...list, ""]);
  }

  function removeItem(list: string[], setList: (v: string[]) => void, idx: number) {
    if (list.length === 1) return;
    setList(list.filter((_, i) => i !== idx));
  }

  // ─── Submit ───────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const filteredChallenges = challenges.filter(c => c.trim());
    const filteredRecommendations = recommendations.filter(r => r.trim());

    if (!month) {
      setError("Reporting month is required.");
      return;
    }

    setSubmitting(true);
    try {
      await api.reports.fellowMonthly.update(id, {
        month,
        sessionsHeld,
        sessionsAttended,
        sessionsAbsent,
        summaryLearning,
        summaryPhcVisits,
        summaryActivities,
        summaryGrowth,
        summaryImpact,
        challenges: filteredChallenges,
        recommendations: filteredRecommendations,
        achievements,
        progressRating,
      });
      router.push(`/reports/fellow-monthly/${id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to update report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Edit Fellow Monthly Report" />
        <div className="p-6 flex items-center justify-center text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
        </div>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <Header title="Edit Fellow Monthly Report" />
        <div className="p-6 text-red-600">{loadError}</div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Edit Fellow Monthly Report"
        subtitle={`${fellowName} · ${month}`}
      />

      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Reporting Period (readonly) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Reporting Period</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reporting Month
              </label>
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fellow</label>
              <Input value={fellowName} readOnly className="bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 1: Mentee Details (readonly) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 1 – Mentee Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <Input value={fellowName} readOnly className="bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
              <Input value={fellowLGA} readOnly className="bg-gray-50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
              <Input value={fellowQualification} readOnly className="bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Attendance ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 2 – Attendance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessions Booked</label>
              <Input
                type="number"
                min={0}
                value={sessionsHeld}
                onChange={e => setSessionsHeld(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessions Attended</label>
              <Input
                type="number"
                min={0}
                max={sessionsHeld}
                value={sessionsAttended}
                onChange={e => setSessionsAttended(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessions Absent</label>
              <Input type="number" min={0} value={sessionsAbsent} readOnly className="bg-gray-50" />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 3: Monthly Summary ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 3 – Monthly Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Learning / Courses Completed
              </label>
              <Textarea
                rows={3}
                value={summaryLearning}
                onChange={e => setSummaryLearning(e.target.value)}
                placeholder="Describe any learning activities or courses completed this month…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PHC Visits / Community Engagements
              </label>
              <Textarea
                rows={3}
                value={summaryPhcVisits}
                onChange={e => setSummaryPhcVisits(e.target.value)}
                placeholder="Summarise PHC visits or community engagements undertaken…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Activities &amp; Outcomes
              </label>
              <Textarea
                rows={3}
                value={summaryActivities}
                onChange={e => setSummaryActivities(e.target.value)}
                placeholder="List key activities carried out and their outcomes…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fellow&apos;s Growth &amp; Development
              </label>
              <Textarea
                rows={3}
                value={summaryGrowth}
                onChange={e => setSummaryGrowth(e.target.value)}
                placeholder="Describe observable growth or improvements in the fellow this month…"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Impact of Mentoring
              </label>
              <Textarea
                rows={3}
                value={summaryImpact}
                onChange={e => setSummaryImpact(e.target.value)}
                placeholder="Describe the impact of your mentoring engagement this month…"
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 4: Key Challenges ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 4 – Key Challenges</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {challenges.map((c, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-2.5 text-gray-400 text-xs w-5 shrink-0">{i + 1}.</span>
                <Input
                  value={c}
                  onChange={e => updateList(challenges, setChallenges, i, e.target.value)}
                  placeholder="Describe a challenge encountered…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(challenges, setChallenges, i)}
                  disabled={challenges.length === 1}
                  aria-label="Remove"
                  className="shrink-0 mt-0.5"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addItem(challenges, setChallenges)}
              className="mt-1 text-orange-600"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Challenge
            </Button>
          </CardContent>
        </Card>

        {/* ── Section 5: Recommendations ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 5 – Mentor&apos;s Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recommendations.map((r, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="mt-2.5 text-gray-400 text-xs w-5 shrink-0">{i + 1}.</span>
                <Input
                  value={r}
                  onChange={e => updateList(recommendations, setRecommendations, i, e.target.value)}
                  placeholder="Enter a recommendation…"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(recommendations, setRecommendations, i)}
                  disabled={recommendations.length === 1}
                  aria-label="Remove"
                  className="shrink-0 mt-0.5"
                >
                  <Trash2 className="h-4 w-4 text-red-400" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => addItem(recommendations, setRecommendations)}
              className="mt-1 text-orange-600"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Recommendation
            </Button>
          </CardContent>
        </Card>

        {/* ── Section 6: Progress Rating ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 6 – Progress Rating (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {PROGRESS_RATINGS.map(rating => (
                <label key={rating} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="progressRating"
                    value={rating}
                    checked={progressRating === rating}
                    onChange={() => setProgressRating(rating)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-gray-700">{rating}</span>
                </label>
              ))}
              {progressRating && (
                <button
                  type="button"
                  onClick={() => setProgressRating("")}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 7: Key Achievements ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 7 – Key Achievements (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={3}
              value={achievements}
              onChange={e => setAchievements(e.target.value)}
              placeholder="List 1–2 measurable key achievements for this fellow this month…"
            />
          </CardContent>
        </Card>

        {/* ── Submit ── */}
        <div className="flex justify-end gap-3 pb-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/reports/fellow-monthly/${id}`)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
