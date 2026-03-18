/* ──────────────────────────────────────────
   Per-Fellow Monthly Report Form
   Template: 7 sections matching NHF format
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { api, type Fellow, type MentorMonthlyReportPrefill } from "@/lib/api-client";
import { Loader2, Plus, Trash2 } from "lucide-react";

const PROGRESS_RATINGS = ["Excellent", "Good", "Fair", "Needs Improvement"] as const;

export default function NewMentorMonthlyReportPage() {
  const router = useRouter();

  // ─── Data loading states ──────────────────
  const [fellows, setFellows] = useState<Fellow[]>([]);
  const [loadingFellows, setLoadingFellows] = useState(true);
  const [prefilling, setPrefilling] = useState(false);

  // ─── Form state ───────────────────────────
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedFellowId, setSelectedFellowId] = useState("");
  const [prefillData, setPrefillData] = useState<MentorMonthlyReportPrefill | null>(null);

  // Section 1 – Fellow details (auto-filled, readonly)
  const [fellowName, setFellowName] = useState("");
  const [fellowLGA, setFellowLGA] = useState("");
  const [fellowQualification, setFellowQualification] = useState("");

  // Section 2 – Attendance
  const [sessionsHeld, setSessionsHeld] = useState(0);
  const [sessionsAttended, setSessionsAttended] = useState(0);
  const [sessionsAbsent, setSessionsAbsent] = useState(0);

  // Section 3 – Monthly summary
  const [summaryLearning, setSummaryLearning] = useState("");
  const [summaryPhcVisits, setSummaryPhcVisits] = useState("");
  const [summaryActivities, setSummaryActivities] = useState("");
  const [summaryGrowth, setSummaryGrowth] = useState("");
  const [summaryImpact, setSummaryImpact] = useState("");

  // Section 4 – Key challenges (bullet list)
  const [challenges, setChallenges] = useState<string[]>([""]);

  // Section 5 – Recommendations (bullet list)
  const [recommendations, setRecommendations] = useState<string[]>([""]);

  // Section 6 – Progress rating
  const [progressRating, setProgressRating] = useState<string>("");

  // Section 7 – Key achievements
  const [achievements, setAchievements] = useState("");

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ─── Load mentor's fellows on mount ──────
  useEffect(() => {
    async function load() {
      try {
        const res = await api.fellows.list({ limit: "500" });
        setFellows(res.data);
      } catch {
        // silently fail
      } finally {
        setLoadingFellows(false);
      }
    }
    load();
  }, []);

  // ─── Prefill when fellow + month are set ─
  useEffect(() => {
    if (!selectedFellowId || !month) return;

    const fellow = fellows.find(f => f._id === selectedFellowId);
    if (fellow) {
      setFellowName(fellow.name);
      setFellowLGA(fellow.lga);
      setFellowQualification(fellow.qualification ?? "");
    }

    async function prefill() {
      setPrefilling(true);
      try {
        const data = await api.reports.fellowMonthly.prefill(selectedFellowId, month);
        setPrefillData(data);
        setSessionsHeld(data.sessionsHeld);
        setSessionsAttended(data.sessionsAttended);
        setSessionsAbsent(data.sessionsAbsent);
        if (data.challenges.length > 0) {
          setChallenges(data.challenges.length ? data.challenges : [""]);
        }
      } catch {
        // prefill failed – leave fields editable
        setPrefillData(null);
      } finally {
        setPrefilling(false);
      }
    }
    prefill();
  }, [selectedFellowId, month, fellows]);

  // ─── Recalculate absent when held/attended change ──
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

    if (!selectedFellowId) {
      setError("Please select a fellow.");
      return;
    }
    if (!month) {
      setError("Please select a reporting month.");
      return;
    }

    const filteredChallenges = challenges.filter(c => c.trim());
    const filteredRecommendations = recommendations.filter(r => r.trim());

    setSubmitting(true);
    try {
      const report = await api.reports.fellowMonthly.create({
        fellow: selectedFellowId,
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
        weeklyReportIds: prefillData?.weeklyReportIds ?? [],
      });
      router.push(`/reports/fellow-monthly/${report._id}`);
    } catch (err: any) {
      setError(err.message ?? "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Header
        title="New Fellow Monthly Report"
        subtitle="Submit a per-fellow monthly progress report"
      />

      <form onSubmit={handleSubmit} className="p-6 space-y-6 max-w-4xl mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Section 0: Reporting Period ── */}
        <Card>
          <CardHeader>
            <CardTitle>Reporting Period</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reporting Month <span className="text-red-500">*</span>
              </label>
              <Input
                type="month"
                value={month}
                onChange={e => setMonth(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Fellow <span className="text-red-500">*</span>
              </label>
              {loadingFellows ? (
                <div className="flex items-center gap-2 text-gray-500 text-sm h-10">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading fellows…
                </div>
              ) : (
                <Select
                  value={selectedFellowId}
                  onChange={e => setSelectedFellowId(e.target.value)}
                  required
                  placeholder="— select fellow —"
                  options={fellows.map(f => ({
                    value: f._id,
                    label: `${f.name} (${f.lga})`,
                  }))}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 1: Mentee Details ── */}
        <Card>
          <CardHeader>
            <CardTitle>Section 1 – Mentee Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <Input value={fellowName} readOnly className="bg-gray-50" placeholder="Auto-filled" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">LGA</label>
              <Input value={fellowLGA} readOnly className="bg-gray-50" placeholder="Auto-filled" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
              <Input value={fellowQualification} readOnly className="bg-gray-50" placeholder="Auto-filled" />
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Attendance ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Section 2 – Attendance
              {prefilling && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sessions Held</label>
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
              <Input
                type="number"
                min={0}
                value={sessionsAbsent}
                readOnly
                className="bg-gray-50"
              />
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
            <CardTitle className="flex items-center gap-2">
              Section 4 – Key Challenges
              {prefilling && <Loader2 className="h-4 w-4 animate-spin text-orange-500" />}
            </CardTitle>
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
            onClick={() => router.push("/reports/fellow-monthly")}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting…
              </>
            ) : (
              "Submit Report"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
