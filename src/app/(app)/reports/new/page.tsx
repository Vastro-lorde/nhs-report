/* ──────────────────────────────────────────
   Report submission form
   Captures per-mentee session details
   matching the NHF weekly report format
   ────────────────────────────────────────── */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type CreateReportInput, type MentorshipSessionInput } from "@/lib/api-client";
import { OUTREACH_TYPES, CHALLENGE_TYPES } from "@/lib/constants";
import { Plus, Trash2, Upload, Loader2 } from "lucide-react";
import { DebugSeeder } from "@/components/ui/DebugSeeder";
import { faker } from "@faker-js/faker";
import { useEffect } from "react";

const EMPTY_SESSION: MentorshipSessionInput = {
  menteeName: "",
  menteeLGA: "",
  sessionDate: "",
  startTime: "",
  endTime: "",
  duration: "",
  topicDiscussed: "",
  challenges: [""],
  solutions: [""],
  actionPlan: [""],
};

export default function NewReportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  // Assigned Fellows
  const [assignedFellows, setAssignedFellows] = useState<{ id: string; name: string; lga: string }[]>([]);
  const [loadingFellows, setLoadingFellows] = useState(true);

  // Mentor's assigned LGAs
  const [mentorLGAs, setMentorLGAs] = useState<string[]>([]);

  // Fetch fellows + mentor profile on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [fellowsRes, profileRes] = await Promise.all([
          fetch("/api/fellows?limit=500"),
          fetch("/api/profile"),
        ]);
        const fellowsJson = await fellowsRes.json();
        if (fellowsJson.data) {
          setAssignedFellows(fellowsJson.data.map((f: any) => ({
            id: f._id,
            name: f.name,
            lga: f.lga
          })));
        }
        const profileJson = await profileRes.json();
        if (profileJson.roleDetails?.lgas) {
          setMentorLGAs(profileJson.roleDetails.lgas as string[]);
        }
      } catch (err) {
        console.error("Failed to load form data", err);
      } finally {
        setLoadingFellows(false);
      }
    }
    fetchData();
  }, []);

  // ─── Form state ──────────────────────
  const [weekEnding, setWeekEnding] = useState("");
  const [weekNumber, setWeekNumber] = useState("");
  const [coverNote, setCoverNote] = useState("");

  // Fellows list
  const [fellows, setFellows] = useState<{ name: string; lga: string }[]>([
    { name: "", lga: "" },
  ]);

  // Sessions
  const [sessions, setSessions] = useState<MentorshipSessionInput[]>([
    { ...EMPTY_SESSION, challenges: [""], solutions: [""], actionPlan: [""] },
  ]);

  // Outreach & challenges (aggregate)
  const [outreachActivities, setOutreachActivities] = useState<string[]>([]);
  const [outreachDescription, setOutreachDescription] = useState("");
  const [challenges, setChallenges] = useState<string[]>([]);
  const [challengeDescription, setChallengeDescription] = useState("");
  const [keyWins, setKeyWins] = useState("");
  const [urgentAlert, setUrgentAlert] = useState(false);
  const [urgentDetails, setUrgentDetails] = useState("");
  const [supportNeeded, setSupportNeeded] = useState("");
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);

  // ─── Fellow helpers ──────────────────
  const updateFellow = (idx: number, field: "name" | "lga", value: string) => {
    setFellows((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };
  const addFellow = () => setFellows((prev) => [...prev, { name: "", lga: "" }]);
  const removeFellow = (idx: number) =>
    setFellows((prev) => prev.filter((_, i) => i !== idx));

  // ─── Duration helper ─────────────────
  const computeDuration = (startTime: string, endTime: string): string => {
    if (!startTime || !endTime) return "";
    const startParts = startTime.split(":");
    const endParts = endTime.split(":");
    if (startParts.length < 2 || endParts.length < 2) return "";
    const sh = Number(startParts[0]);
    const sm = Number(startParts[1]);
    const eh = Number(endParts[0]);
    const em = Number(endParts[1]);
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return "";
    const diffMin = (eh * 60 + em) - (sh * 60 + sm);
    if (diffMin <= 0) return "";
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    if (hours > 0 && mins > 0) return `${hours} hour${hours > 1 ? "s" : ""} ${mins} minute${mins > 1 ? "s" : ""}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
    return `${mins} minute${mins > 1 ? "s" : ""}`;
  };

  // ─── Session helpers ────────────────
  const updateSession = (
    idx: number,
    field: keyof MentorshipSessionInput,
    value: unknown
  ) => {
    setSessions((prev) =>
      prev.map((s, i) => {
        if (i === idx) {
          const updated = { ...s, [field]: value };
          // Auto-fill LGA if menteeName changes and matches a fellow
          if (field === "menteeName") {
            const matchedFellow = assignedFellows.find(f => f.name === value);
            if (matchedFellow) {
              updated.menteeLGA = matchedFellow.lga;
            }
          }
          // Auto-fill duration when start or end time changes
          if (field === "startTime" || field === "endTime") {
            const start = field === "startTime" ? (value as string) : s.startTime;
            const end = field === "endTime" ? (value as string) : s.endTime;
            updated.duration = computeDuration(start, end);
          }
          return updated;
        }
        return s;
      })
    );
  };

  const addSession = () =>
    setSessions((prev) => [
      ...prev,
      { ...EMPTY_SESSION, challenges: [""], solutions: [""], actionPlan: [""] },
    ]);

  const removeSession = (idx: number) =>
    setSessions((prev) => prev.filter((_, i) => i !== idx));

  // Bullet-point list helpers for session sub-arrays
  const updateBullet = (
    sessionIdx: number,
    field: "challenges" | "solutions" | "actionPlan",
    bulletIdx: number,
    value: string
  ) => {
    setSessions((prev) =>
      prev.map((s, si) => {
        if (si !== sessionIdx) return s;
        const arr = [...s[field]];
        arr[bulletIdx] = value;
        return { ...s, [field]: arr };
      })
    );
  };

  const addBullet = (
    sessionIdx: number,
    field: "challenges" | "solutions" | "actionPlan"
  ) => {
    setSessions((prev) =>
      prev.map((s, si) =>
        si === sessionIdx ? { ...s, [field]: [...s[field], ""] } : s
      )
    );
  };

  const removeBullet = (
    sessionIdx: number,
    field: "challenges" | "solutions" | "actionPlan",
    bulletIdx: number
  ) => {
    setSessions((prev) =>
      prev.map((s, si) => {
        if (si !== sessionIdx) return s;
        return { ...s, [field]: s[field].filter((_, bi) => bi !== bulletIdx) };
      })
    );
  };

  // ─── File upload ────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIdx(evidenceUrls.length);
    try {
      const result = await api.upload.file(file);
      setEvidenceUrls((prev) => [...prev, result.url]);
    } catch (err) {
      setError(`Upload failed: ${(err as Error).message}`);
    } finally {
      setUploadingIdx(null);
      e.target.value = "";
    }
  };

  // ─── Submit ─────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Clean sessions — remove empty bullet items
    const cleanSessions = sessions
      .filter((s) => s.menteeName.trim())
      .map((s) => ({
        ...s,
        challenges: s.challenges.filter((c) => c.trim()),
        solutions: s.solutions.filter((c) => c.trim()),
        actionPlan: s.actionPlan.filter((c) => c.trim()),
      }));

    const payload: CreateReportInput = {
      weekEnding,
      weekNumber: weekNumber ? Number(weekNumber) : undefined,
      coverNote: coverNote || undefined,
      fellows: fellows.filter((f) => f.name.trim()),
      sessions: cleanSessions,
      sessionsCount: cleanSessions.length,
      menteesCheckedIn: new Set(cleanSessions.map((s) => s.menteeName.toLowerCase().trim())).size,
      outreachActivities,
      outreachDescription: outreachDescription || undefined,
      keyWins: keyWins || undefined,
      challenges,
      challengeDescription: challengeDescription || undefined,
      urgentAlert,
      urgentDetails: urgentDetails || undefined,
      supportNeeded: supportNeeded || undefined,
      evidenceUrls,
    };

    try {
      await api.reports.create(payload);
      router.push("/reports");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Header title="Submit Weekly Report" subtitle="Enter your mentorship session details" />

      <form onSubmit={handleSubmit} className="p-6 max-w-4xl space-y-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ── Week Info ────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Report Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                id="weekEnding"
                label="Week Ending Date *"
                type="date"
                value={weekEnding}
                onChange={(e) => setWeekEnding(e.target.value)}
                required
              />
              <Input
                id="weekNumber"
                label="Week Number"
                type="number"
                placeholder="e.g. 35"
                value={weekNumber}
                onChange={(e) => setWeekNumber(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Fellows List ────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Fellows Under Supervision</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {fellows.map((f, i) => (
                <div key={i} className="flex items-end gap-3">
                  <div className="flex-1">
                    {loadingFellows ? (
                      <div className="flex items-center text-sm text-gray-500 h-10"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading fellows...</div>
                    ) : (
                      <Select
                        label={i === 0 ? "Name" : undefined}
                        value={f.name}
                        onChange={(e) => {
                          updateFellow(i, "name", e.target.value);
                          const matchedFellow = assignedFellows.find(af => af.name === e.target.value);
                          if (matchedFellow) updateFellow(i, "lga", matchedFellow.lga);
                        }}
                        options={[
                          { label: "Select Fellow", value: "" },
                          ...assignedFellows.map(af => ({ label: af.name, value: af.name }))
                        ]}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <Select
                      label={i === 0 ? "LGA" : undefined}
                      value={f.lga}
                      onChange={(e) => updateFellow(i, "lga", e.target.value)}
                      options={[
                        { label: "Select LGA", value: "" },
                        ...mentorLGAs.map((l) => ({ label: l, value: l })),
                      ]}
                    />
                  </div>
                  {fellows.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFellow(i)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addFellow}>
                <Plus className="h-4 w-4 mr-1" /> Add Fellow
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Mentorship Sessions ────── */}
        {sessions.map((session, si) => (
          <Card key={si}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Session {si + 1}: {session.menteeName || "New Session"}</CardTitle>
                {sessions.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSession(si)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500 mr-1" /> Remove
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Identity */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {loadingFellows ? (
                    <div className="flex items-center text-sm text-gray-500 h-10"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading fellows...</div>
                  ) : (
                    <Select
                      label="Name of Mentee/Fellow *"
                      value={session.menteeName}
                      onChange={(e) => updateSession(si, "menteeName", e.target.value)}
                      required
                      options={[
                        { label: "Select Fellow", value: "" },
                        ...assignedFellows.map(af => ({ label: af.name, value: af.name }))
                      ]}
                    />
                  )}
                  <Select
                    label="Mentee LGA"
                    value={session.menteeLGA}
                    onChange={(e) => updateSession(si, "menteeLGA", e.target.value)}
                    options={[
                      { label: "Select LGA", value: "" },
                      ...mentorLGAs.map((l) => ({ label: l, value: l })),
                    ]}
                  />
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Input
                    label="Session Date *"
                    type="date"
                    value={session.sessionDate}
                    onChange={(e) => updateSession(si, "sessionDate", e.target.value)}
                    required
                  />
                  <Input
                    label="Start Time *"
                    type="time"
                    value={session.startTime}
                    onChange={(e) => updateSession(si, "startTime", e.target.value)}
                    required
                  />
                  <Input
                    label="End Time *"
                    type="time"
                    value={session.endTime}
                    onChange={(e) => updateSession(si, "endTime", e.target.value)}
                    required
                  />
                  <Input
                    label="Duration"
                    placeholder="Auto-calculated"
                    value={session.duration}
                    readOnly
                  />
                </div>

                {/* Topic Discussed */}
                <Textarea
                  label="Topic Discussed *"
                  placeholder="Describe the main topics discussed in this session…"
                  value={session.topicDiscussed}
                  onChange={(e) => updateSession(si, "topicDiscussed", e.target.value)}
                  required
                />

                {/* Challenges */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Challenges Identified</p>
                  {session.challenges.map((c, ci) => (
                    <div key={ci} className="flex items-start gap-2 mb-2">
                      <span className="text-gray-400 text-sm mt-2">-</span>
                      <Textarea
                        placeholder="Challenge…"
                        value={c}
                        onChange={(e) => updateBullet(si, "challenges", ci, e.target.value)}
                        className="flex-1 min-h-[60px]"
                      />
                      {session.challenges.length > 1 && (
                        <button type="button" onClick={() => removeBullet(si, "challenges", ci)} className="text-red-400 hover:text-red-600 mt-2">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addBullet(si, "challenges")}>
                    <Plus className="h-3 w-3 mr-1" /> Add challenge
                  </Button>
                </div>

                {/* Solutions */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Solutions Proffered</p>
                  {session.solutions.map((s, sui) => (
                    <div key={sui} className="flex items-start gap-2 mb-2">
                      <span className="text-gray-400 text-sm mt-2">-</span>
                      <Textarea
                        placeholder="Solution…"
                        value={s}
                        onChange={(e) => updateBullet(si, "solutions", sui, e.target.value)}
                        className="flex-1 min-h-[60px]"
                      />
                      {session.solutions.length > 1 && (
                        <button type="button" onClick={() => removeBullet(si, "solutions", sui)} className="text-red-400 hover:text-red-600 mt-2">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addBullet(si, "solutions")}>
                    <Plus className="h-3 w-3 mr-1" /> Add solution
                  </Button>
                </div>

                {/* Action Plan */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Action Plan</p>
                  {session.actionPlan.map((a, ai) => (
                    <div key={ai} className="flex items-start gap-2 mb-2">
                      <span className="text-gray-400 text-sm mt-2">-</span>
                      <Textarea
                        placeholder="Action item…"
                        value={a}
                        onChange={(e) => updateBullet(si, "actionPlan", ai, e.target.value)}
                        className="flex-1 min-h-[60px]"
                      />
                      {session.actionPlan.length > 1 && (
                        <button type="button" onClick={() => removeBullet(si, "actionPlan", ai)} className="text-red-400 hover:text-red-600 mt-2">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <Button type="button" variant="ghost" size="sm" onClick={() => addBullet(si, "actionPlan")}>
                    <Plus className="h-3 w-3 mr-1" /> Add action item
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        <Button type="button" variant="outline" onClick={addSession} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> Add Another Session
        </Button>

        {/* ── Cover Note (optional) ──── */}
        <Card>
          <CardHeader>
            <CardTitle>Cover Note (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Optional introductory paragraph for the compiled report…"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              className="min-h-[100px]"
            />
          </CardContent>
        </Card>

        {/* ── Outreach & Challenges (Aggregate) ── */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Outreach checkboxes */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Outreach Activities Done
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {OUTREACH_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={outreachActivities.includes(type)}
                        onChange={(e) => {
                          setOutreachActivities((prev) =>
                            e.target.checked
                              ? [...prev, type]
                              : prev.filter((t) => t !== type)
                          );
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      {type}
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Additional outreach description…"
                  value={outreachDescription}
                  onChange={(e) => setOutreachDescription(e.target.value)}
                  className="mt-2"
                />
              </div>

              {/* Challenges checkboxes */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Top Challenges This Week
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {CHALLENGE_TYPES.map((type) => (
                    <label key={type} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={challenges.includes(type)}
                        onChange={(e) => {
                          setChallenges((prev) =>
                            e.target.checked
                              ? [...prev, type]
                              : prev.filter((t) => t !== type)
                          );
                        }}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      {type}
                    </label>
                  ))}
                </div>
                <Textarea
                  placeholder="Additional challenge description…"
                  value={challengeDescription}
                  onChange={(e) => setChallengeDescription(e.target.value)}
                  className="mt-2"
                />
              </div>

              <Textarea
                label="Key Wins This Week"
                placeholder="Notable achievements or positive outcomes…"
                value={keyWins}
                onChange={(e) => setKeyWins(e.target.value)}
              />

              <Textarea
                label="Support Needed from Coordinator"
                placeholder="Any support or resources you need…"
                value={supportNeeded}
                onChange={(e) => setSupportNeeded(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Urgent Alert ────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Urgent Alert</CardTitle>
          </CardHeader>
          <CardContent>
            <label className="flex items-center gap-2 text-sm mb-3">
              <input
                type="checkbox"
                checked={urgentAlert}
                onChange={(e) => setUrgentAlert(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="font-medium">
                Flag an outbreak alert or urgent community issue
              </span>
            </label>
            {urgentAlert && (
              <Textarea
                label="Urgent Details *"
                placeholder="Describe the urgent issue…"
                value={urgentDetails}
                onChange={(e) => setUrgentDetails(e.target.value)}
                required
              />
            )}
          </CardContent>
        </Card>

        {/* ── Evidence Upload ─────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Evidence / Attachments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {evidenceUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-orange-600">✓</span>
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-md">
                    {url.split("/").pop()}
                  </a>
                  <button
                    type="button"
                    onClick={() => setEvidenceUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploadingIdx !== null}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadingIdx !== null}
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).closest("label")?.querySelector("input");
                    input?.click();
                  }}
                >
                  <Upload className="h-4 w-4 mr-1" />
                  {uploadingIdx !== null ? "Uploading…" : "Upload File"}
                </Button>
                <span className="text-xs text-gray-400">
                  JPEG, PNG, WebP, PDF — max 10MB
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ── Submit ──────────────────── */}
        <div className="flex justify-end gap-3 pb-8">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Submitting…" : "Submit Report"}
          </Button>
        </div>
      </form>

      <DebugSeeder
        label="Prefill Entire Report (Fake Data)"
        onFill={() => {
          setWeekEnding(faker.date.recent().toISOString().split("T")[0]);
          setWeekNumber(String(faker.number.int({ min: 1, max: 52 })));
          setCoverNote(faker.lorem.paragraph());

          const fellowCount = faker.number.int({ min: 1, max: 3 });
          const newFellows = Array.from({ length: fellowCount }).map(() => ({
            name: faker.person.fullName(),
            lga: faker.location.county(),
          }));
          setFellows(newFellows);

          const newSessions = newFellows.map((f) => ({
            menteeName: f.name,
            menteeLGA: f.lga,
            sessionDate: faker.date.recent().toISOString().split("T")[0],
            startTime: "09:00",
            endTime: "10:30",
            duration: "1 hour 30 minutes",
            topicDiscussed: faker.company.catchPhrase(),
            challenges: [faker.hacker.phrase()],
            solutions: [faker.company.catchPhrase()],
            actionPlan: [faker.lorem.sentence()],
          }));
          setSessions(newSessions);

          setOutreachActivities(faker.helpers.arrayElements(OUTREACH_TYPES, { min: 1, max: 3 }));
          setOutreachDescription(faker.lorem.sentences(2));

          setChallenges(faker.helpers.arrayElements(CHALLENGE_TYPES, { min: 1, max: 2 }));
          setChallengeDescription(faker.lorem.sentences(2));

          setKeyWins(faker.lorem.paragraph());
          setSupportNeeded(faker.lorem.sentence());

          const isUrgent = faker.datatype.boolean();
          setUrgentAlert(isUrgent);
          if (isUrgent) {
            setUrgentDetails(faker.lorem.paragraph());
          }
        }}
      />
    </>
  );
}
