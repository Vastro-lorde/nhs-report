/* ──────────────────────────────────────────
   Admin: Start next cohort (wizard)
   1. Details  2. Staff  3. Fellows  4. Review
   Creates the next cohort in *setup* with the people carried over; the admin
   then fine-tunes it with the usual pages and activates it from /admin/cohorts.
   ────────────────────────────────────────── */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { switchCohortView } from "@/components/layout/CohortBar";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { api, type CohortRoster, type CohortRosterStaff, type NewCohortPlan } from "@/lib/api-client";
import { COHORT_ROLE_LABELS, COHORT_STAFF_ROLES, type CohortStaffRole } from "@/lib/cohort";
import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";

type StaffChoice = CohortStaffRole | "leave";
type FellowChoice = "leave" | "fellow" | "mentor";

const STEPS = ["Details", "Staff", "Fellows", "Review"] as const;
const FELLOW_PAGE_SIZE = 50;

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={[
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
              i < step ? "bg-orange-700 text-white" : i === step ? "bg-orange-100 text-orange-800 ring-2 ring-orange-700" : "bg-gray-200 text-gray-600",
            ].join(" ")}
          >
            {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={i === step ? "font-semibold text-gray-900" : "text-gray-500"}>{label}</span>
          {i < STEPS.length - 1 && <span className="text-gray-300">—</span>}
        </li>
      ))}
    </ol>
  );
}

function choiceLabel(current: CohortStaffRole, choice: StaffChoice) {
  if (choice === "leave") return "Not continuing";
  if (choice === current) return `Continue as ${COHORT_ROLE_LABELS[current]}`;
  return `Move to ${COHORT_ROLE_LABELS[choice]}`;
}

export default function NewCohortWizardPage() {
  const router = useRouter();
  const [roster, setRoster] = useState<CohortRoster | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState(0);

  // Step 1
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  // Step 2
  const [staffChoice, setStaffChoice] = useState<Record<string, StaffChoice>>({});
  const [mentorCoordinator, setMentorCoordinator] = useState<Record<string, string>>({});
  const [staffSearch, setStaffSearch] = useState("");
  // Step 3
  const [fellowsContinue, setFellowsContinue] = useState<"" | "none" | "some">("");
  const [fellowChoice, setFellowChoice] = useState<Record<string, FellowChoice>>({});
  const [fellowMentor, setFellowMentor] = useState<Record<string, string>>({});
  const [fellowSearch, setFellowSearch] = useState("");
  const [fellowPage, setFellowPage] = useState(0);
  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [serverProblems, setServerProblems] = useState<string[]>([]);

  useEffect(() => {
    api.cohorts
      .roster()
      .then((r) => {
        setRoster(r);
        setName(`Cohort ${r.nextNumber}`);
        // Staff carry over in their current role by default.
        setStaffChoice(Object.fromEntries(r.staff.map((s) => [s.userId, s.role])));
        setMentorCoordinator(
          Object.fromEntries(r.staff.filter((s) => s.role === "mentor").map((s) => [s.userId, s.coordinatorUserId ?? ""])),
        );
        setFellowChoice(Object.fromEntries(r.fellows.map((f) => [f.fellowId, "leave" as FellowChoice])));
        setFellowMentor(Object.fromEntries(r.fellows.map((f) => [f.fellowId, f.mentorUserId ?? ""])));
      })
      .catch((err) => setLoadError((err as Error).message));
  }, []);

  const staffById = useMemo(() => new Map((roster?.staff ?? []).map((s) => [s.userId, s])), [roster]);
  const fellowByUser = useMemo(
    () => new Map((roster?.fellows ?? []).filter((f) => f.userId).map((f) => [f.userId!, f])),
    [roster],
  );
  const nameOf = (userId: string) => staffById.get(userId)?.name ?? fellowByUser.get(userId)?.name ?? "Unknown";

  /* ── Who is in the new cohort, and as what ── */
  const newCoordinators = useMemo(
    () =>
      (roster?.staff ?? [])
        .filter((s) => staffChoice[s.userId] === "coordinator")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [roster, staffChoice],
  );
  const newMentors = useMemo(() => {
    const fromStaff = (roster?.staff ?? []).filter((s) => staffChoice[s.userId] === "mentor").map((s) => ({ userId: s.userId, name: s.name }));
    const fromFellows = (roster?.fellows ?? [])
      .filter((f) => f.userId && fellowChoice[f.fellowId] === "mentor")
      .map((f) => ({ userId: f.userId!, name: f.name }));
    return [...fromStaff, ...fromFellows].sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, staffChoice, fellowChoice]);
  const coordinatorIds = useMemo(() => new Set(newCoordinators.map((c) => c.userId)), [newCoordinators]);
  const mentorIds = useMemo(() => new Set(newMentors.map((m) => m.userId)), [newMentors]);

  /* ── Plan + validation (mirrors the server) ── */
  const plan: NewCohortPlan = useMemo(() => {
    const staff: NewCohortPlan["staff"] = [];
    for (const s of roster?.staff ?? []) {
      const choice = staffChoice[s.userId];
      if (!choice || choice === "leave") continue;
      staff.push({
        userId: s.userId,
        role: choice,
        ...(choice === "mentor" ? { coordinatorUserId: mentorCoordinator[s.userId] || undefined } : {}),
      });
    }
    const fellows: NewCohortPlan["fellows"] = [];
    if (fellowsContinue === "some") {
      for (const f of roster?.fellows ?? []) {
        const choice = fellowChoice[f.fellowId];
        if (choice === "fellow") fellows.push({ fellowId: f.fellowId, mentorUserId: fellowMentor[f.fellowId] });
        if (choice === "mentor" && f.userId) {
          staff.push({ userId: f.userId, role: "mentor", coordinatorUserId: mentorCoordinator[f.userId] || undefined });
        }
      }
    }
    return { name: name.trim(), notes: notes.trim(), staff, fellows };
  }, [roster, staffChoice, mentorCoordinator, fellowsContinue, fellowChoice, fellowMentor, name, notes]);

  const staffProblems = useMemo(
    () =>
      plan.staff
        .filter((e) => e.role === "mentor" && (!e.coordinatorUserId || !coordinatorIds.has(e.coordinatorUserId)))
        .map((e) => `Choose a coordinator for ${nameOf(e.userId)} (their current coordinator isn't continuing as a coordinator).`),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, coordinatorIds],
  );
  const fellowProblems = useMemo(() => {
    const problems: string[] = [];
    if (fellowsContinue === "") problems.push("Choose whether any fellows continue into the new cohort.");
    for (const e of plan.fellows) {
      if (!e.mentorUserId || !mentorIds.has(e.mentorUserId)) {
        const f = roster?.fellows.find((x) => x.fellowId === e.fellowId);
        problems.push(`Choose a mentor for fellow ${f?.name ?? e.fellowId} (their current mentor isn't continuing as a mentor).`);
      }
    }
    return problems;
  }, [plan, mentorIds, fellowsContinue, roster]);

  /* ── Derived lists for the review ── */
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of plan.staff) c[e.role] = (c[e.role] ?? 0) + 1;
    c.fellow = plan.fellows.length;
    return c;
  }, [plan]);
  const roleChanges = useMemo(
    () =>
      plan.staff
        .map((e) => {
          const prev = staffById.get(e.userId)?.role ?? "fellow";
          return prev !== e.role ? { name: nameOf(e.userId), from: prev, to: e.role } : null;
        })
        .filter(Boolean) as { name: string; from: string; to: CohortStaffRole }[],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, staffById],
  );
  const leaving = useMemo(() => (roster?.staff ?? []).filter((s) => staffChoice[s.userId] === "leave"), [roster, staffChoice]);

  if (loadError) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="Start next cohort" />
        <main className="p-6 max-w-3xl mx-auto w-full">
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{loadError}</div>
        </main>
      </div>
    );
  }
  if (!roster) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <Header title="Start next cohort" />
        <main className="p-6 text-sm text-gray-500">Loading {"the current cohort's"} people…</main>
      </div>
    );
  }

  const current = roster.cohort.name;

  /* ── Step 2 helpers ── */
  const staffQuery = staffSearch.trim().toLowerCase();
  const visibleStaff = roster.staff.filter(
    (s) => !staffQuery || s.name.toLowerCase().includes(staffQuery) || s.email.toLowerCase().includes(staffQuery),
  );
  const groups = COHORT_STAFF_ROLES.map((role) => ({ role, people: visibleStaff.filter((s) => s.role === role) })).filter(
    (g) => g.people.length,
  );
  const setGroup = (people: CohortRosterStaff[], value: "keep" | "leave") =>
    setStaffChoice((prev) => {
      const next = { ...prev };
      for (const p of people) next[p.userId] = value === "keep" ? p.role : "leave";
      return next;
    });

  /* ── Step 3 helpers ── */
  const fellowQuery = fellowSearch.trim().toLowerCase();
  const visibleFellows = roster.fellows.filter(
    (f) =>
      !fellowQuery ||
      f.name.toLowerCase().includes(fellowQuery) ||
      (f.email ?? "").toLowerCase().includes(fellowQuery) ||
      f.lga.toLowerCase().includes(fellowQuery) ||
      (f.mentorUserId ? nameOf(f.mentorUserId).toLowerCase().includes(fellowQuery) : false),
  );
  const pageCount = Math.max(1, Math.ceil(visibleFellows.length / FELLOW_PAGE_SIZE));
  const page = Math.min(fellowPage, pageCount - 1);
  const pagedFellows = visibleFellows.slice(page * FELLOW_PAGE_SIZE, (page + 1) * FELLOW_PAGE_SIZE);
  const setAllFellows = (value: FellowChoice) =>
    setFellowChoice((prev) => {
      const next = { ...prev };
      for (const f of visibleFellows) next[f.fellowId] = value;
      return next;
    });

  const canNext = step === 0 ? name.trim().length > 0 : step === 1 ? staffProblems.length === 0 : step === 2 ? fellowProblems.length === 0 : true;

  const submit = async () => {
    setSubmitting(true);
    setSubmitError("");
    setServerProblems([]);
    try {
      const created = await api.cohorts.create(plan);
      // Take the admin straight into the new cohort to finish setting it up.
      await switchCohortView(created._id, "/admin/cohorts");
    } catch (err) {
      setSubmitError((err as Error).message);
      setServerProblems((err as { problems?: string[] }).problems ?? []);
      setSubmitting(false);
    }
  };

  const selectCls =
    "h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-600";

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <Header title="Start next cohort" subtitle={`Carry people over from ${current}`} />
      <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5">
        <StepIndicator step={step} />

        {/* ── Step 1: Details ── */}
        {step === 0 && (
          <Card>
            <CardContent className="p-6 space-y-4 max-w-xl">
              <Input id="cohort-name" label="Cohort name" value={name} onChange={(e) => setName(e.target.value)} />
              <Textarea
                id="cohort-notes"
                label="Notes (optional)"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. intake dates, funding round…"
              />
              <div className="text-sm text-gray-600 bg-gray-50 border rounded-md p-3 space-y-1">
                <p>
                  Next you&apos;ll decide who carries over from <strong>{current}</strong> ({roster.staff.length} staff,{" "}
                  {roster.fellows.length} fellows) and in which role. Nothing changes for {current} — its people and
                  reports stay exactly as they are.
                </p>
                <p>
                  The new cohort is created in <em>setup</em>: only admins can see it, and you can add new people and
                  adjust assignments with the usual pages before activating it.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Step 2: Staff ── */}
        {step === 1 && (
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-end gap-3 justify-between">
                <p className="text-sm text-gray-600 max-w-2xl">
                  Everyone continues in their current role unless you change it. Pick <em>Not continuing</em> for
                  people who are leaving, or move someone to a new role (e.g. promote a mentor to coordinator).
                  States and LGAs carry over and can be edited after creation.
                </p>
                <div className="w-full md:w-64">
                  <Input placeholder="Search name or email…" value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} />
                </div>
              </div>

              {groups.map(({ role, people }) => (
                <div key={role} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {COHORT_ROLE_LABELS[role]}s <span className="font-normal text-gray-500">({people.length})</span>
                    </p>
                    <div className="flex gap-3 text-xs">
                      <button type="button" className="text-orange-700 hover:underline" onClick={() => setGroup(people, "keep")}>
                        All continue
                      </button>
                      <button type="button" className="text-gray-600 hover:underline" onClick={() => setGroup(people, "leave")}>
                        None continue
                      </button>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y">
                        {people.map((s) => {
                          const choice = staffChoice[s.userId] ?? s.role;
                          const coord = mentorCoordinator[s.userId] ?? "";
                          const coordMissing = choice === "mentor" && (!coord || !coordinatorIds.has(coord));
                          return (
                            <tr key={s.userId} className={choice === "leave" ? "bg-gray-50 text-gray-400" : ""}>
                              <td className="px-4 py-2 min-w-48">
                                <p className="font-medium">
                                  {s.name} {!s.active && <Badge variant="secondary">Inactive</Badge>}
                                </p>
                                <p className="text-xs text-gray-500">{s.email}</p>
                              </td>
                              <td className="px-4 py-2 text-xs text-gray-500 hidden md:table-cell min-w-40">
                                {s.states.length ? s.states.join(", ") : "—"}
                                {s.role === "mentor" && (
                                  <>
                                    <br />
                                    {s.fellowCount ?? 0} fellows · coord: {s.coordinatorUserId ? nameOf(s.coordinatorUserId) : "—"}
                                  </>
                                )}
                              </td>
                              <td className="px-4 py-2 w-56">
                                <select
                                  aria-label={`Next cohort role for ${s.name}`}
                                  className={selectCls}
                                  value={choice}
                                  onChange={(e) => setStaffChoice((p) => ({ ...p, [s.userId]: e.target.value as StaffChoice }))}
                                >
                                  {[s.role, ...COHORT_STAFF_ROLES.filter((r) => r !== s.role), "leave" as const].map((c) => (
                                    <option key={c} value={c}>
                                      {choiceLabel(s.role, c)}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-2 w-60">
                                {choice === "mentor" && (
                                  <select
                                    aria-label={`Coordinator for ${s.name}`}
                                    className={[selectCls, coordMissing ? "border-red-400 ring-1 ring-red-300" : ""].join(" ")}
                                    value={coordinatorIds.has(coord) ? coord : ""}
                                    onChange={(e) => setMentorCoordinator((p) => ({ ...p, [s.userId]: e.target.value }))}
                                  >
                                    <option value="">Choose coordinator…</option>
                                    {newCoordinators.map((c) => (
                                      <option key={c.userId} value={c.userId}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              {!groups.length && <p className="text-sm text-gray-500">No staff match your search.</p>}
            </CardContent>
          </Card>
        )}

        {/* ── Step 3: Fellows ── */}
        {step === 2 && (
          <Card>
            <CardContent className="p-4 md:p-6 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-gray-900 mb-1">
                  Do any of {current}&apos;s {roster.fellows.length} fellows continue into {name || "the new cohort"}?
                </legend>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="radio" name="fellows" className="mt-0.5" checked={fellowsContinue === "none"} onChange={() => setFellowsContinue("none")} />
                  <span>
                    <strong>No</strong> — this is a new intake; new fellows will be added after the cohort is created.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="radio" name="fellows" className="mt-0.5" checked={fellowsContinue === "some"} onChange={() => setFellowsContinue("some")} />
                  <span>
                    <strong>Yes</strong> — choose which fellows carry over and who mentors them.
                  </span>
                </label>
              </fieldset>

              {fellowsContinue === "some" && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                    <div className="flex gap-3 text-xs">
                      <button type="button" className="text-orange-700 hover:underline" onClick={() => setAllFellows("fellow")}>
                        All {fellowQuery ? "matching " : ""}continue
                      </button>
                      <button type="button" className="text-gray-600 hover:underline" onClick={() => setAllFellows("leave")}>
                        None {fellowQuery ? "matching " : ""}continue
                      </button>
                      <span className="text-gray-500">{plan.fellows.length} continuing</span>
                    </div>
                    <div className="w-full md:w-72">
                      <Input
                        placeholder="Search fellow, LGA or mentor…"
                        value={fellowSearch}
                        onChange={(e) => {
                          setFellowSearch(e.target.value);
                          setFellowPage(0);
                        }}
                      />
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y">
                        {pagedFellows.map((f) => {
                          const choice = fellowChoice[f.fellowId] ?? "leave";
                          const mentor = fellowMentor[f.fellowId] ?? "";
                          const mentorMissing = choice === "fellow" && (!mentor || !mentorIds.has(mentor));
                          const coord = f.userId ? mentorCoordinator[f.userId] ?? "" : "";
                          return (
                            <tr key={f.fellowId} className={choice === "leave" ? "bg-gray-50 text-gray-400" : ""}>
                              <td className="px-4 py-2 min-w-48">
                                <p className="font-medium">{f.name}</p>
                                <p className="text-xs text-gray-500">
                                  {f.lga} · mentor: {f.mentorUserId ? nameOf(f.mentorUserId) : "—"}
                                </p>
                              </td>
                              <td className="px-4 py-2 w-52">
                                <select
                                  aria-label={`Next cohort for ${f.name}`}
                                  className={selectCls}
                                  value={choice}
                                  onChange={(e) => setFellowChoice((p) => ({ ...p, [f.fellowId]: e.target.value as FellowChoice }))}
                                >
                                  <option value="leave">Not continuing</option>
                                  <option value="fellow">Continue as Fellow</option>
                                  {f.userId && <option value="mentor">Promote to Mentor</option>}
                                </select>
                              </td>
                              <td className="px-4 py-2 w-60">
                                {choice === "fellow" && (
                                  <select
                                    aria-label={`Mentor for ${f.name}`}
                                    className={[selectCls, mentorMissing ? "border-red-400 ring-1 ring-red-300" : ""].join(" ")}
                                    value={mentorIds.has(mentor) ? mentor : ""}
                                    onChange={(e) => setFellowMentor((p) => ({ ...p, [f.fellowId]: e.target.value }))}
                                  >
                                    <option value="">Choose mentor…</option>
                                    {newMentors.map((m) => (
                                      <option key={m.userId} value={m.userId}>
                                        {m.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                                {choice === "mentor" && f.userId && (
                                  <select
                                    aria-label={`Coordinator for ${f.name}`}
                                    className={[selectCls, !coordinatorIds.has(coord) ? "border-red-400 ring-1 ring-red-300" : ""].join(" ")}
                                    value={coordinatorIds.has(coord) ? coord : ""}
                                    onChange={(e) => setMentorCoordinator((p) => ({ ...p, [f.userId!]: e.target.value }))}
                                  >
                                    <option value="">Choose coordinator…</option>
                                    {newCoordinators.map((c) => (
                                      <option key={c.userId} value={c.userId}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {pageCount > 1 && (
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>
                        Page {page + 1} of {pageCount} · {visibleFellows.length} fellows
                      </span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setFellowPage(page - 1)}>
                          Previous
                        </Button>
                        <Button size="sm" variant="outline" disabled={page >= pageCount - 1} onClick={() => setFellowPage(page + 1)}>
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Step 4: Review ── */}
        {step === 3 && (
          <Card>
            <CardContent className="p-4 md:p-6 space-y-5">
              <div>
                <p className="text-base font-semibold text-gray-900">{plan.name}</p>
                {plan.notes && <p className="text-sm text-gray-500">{plan.notes}</p>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {(["coordinator", "mentor", "fellow", "zonal_desk_officer", "me_officer", "team_research_lead"] as const).map((r) => (
                  <div key={r} className="rounded-lg border bg-white p-3">
                    <p className="text-2xl font-semibold text-gray-900 tabular-nums">{counts[r] ?? 0}</p>
                    <p className="text-xs text-gray-500">{COHORT_ROLE_LABELS[r]}s carried over</p>
                  </div>
                ))}
              </div>

              {roleChanges.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Role changes ({roleChanges.length})</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {roleChanges.map((c) => (
                      <li key={c.name + c.to}>
                        {c.name}: {COHORT_ROLE_LABELS[c.from as CohortStaffRole] ?? c.from} → <strong>{COHORT_ROLE_LABELS[c.to]}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {leaving.length > 0 && (
                <details>
                  <summary className="text-sm font-semibold text-gray-800 cursor-pointer">
                    Not continuing: {leaving.length} staff
                    {fellowsContinue === "none" ? `, all ${roster.fellows.length} fellows` : `, ${roster.fellows.length - plan.fellows.length} fellows`}
                  </summary>
                  <ul className="mt-1 text-sm text-gray-600 columns-1 sm:columns-2">
                    {leaving.map((s) => (
                      <li key={s.userId}>
                        {s.name} <span className="text-gray-400">({COHORT_ROLE_LABELS[s.role]})</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              {(counts.coordinator ?? 0) === 0 || (counts.mentor ?? 0) === 0 ? (
                <div className="flex gap-2 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  No {(counts.coordinator ?? 0) === 0 ? "coordinators" : "mentors"} are carried over. That&apos;s fine if new
                  ones are joining — add them while the cohort is in setup. It needs at least one coordinator and one mentor
                  before it can be activated.
                </div>
              ) : null}

              <div className="text-sm text-gray-600 bg-gray-50 border rounded-md p-3">
                Creating the cohort doesn&apos;t change anything for {current}. You&apos;ll be taken into {plan.name} to add new
                people and adjust assignments, then activate it from the Cohorts page when ready.
              </div>

              {submitError && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                  <p>{submitError}</p>
                  {serverProblems.length > 1 && (
                    <ul className="list-disc pl-5 mt-1">
                      {serverProblems.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Problems blocking the current step */}
        {((step === 1 && staffProblems.length > 0) || (step === 2 && fellowProblems.length > 0)) && (
          <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
            <p className="font-medium">Before continuing:</p>
            <ul className="list-disc pl-5">
              {(step === 1 ? staffProblems : fellowProblems).slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {(step === 1 ? staffProblems : fellowProblems).length > 8 && (
                <li>…and {(step === 1 ? staffProblems : fellowProblems).length - 8} more</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => (step === 0 ? router.push("/admin/cohorts") : setStep(step - 1))} disabled={submitting}>
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext}>
              Next <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>
              {submitting ? "Creating…" : `Create ${plan.name || "cohort"}`}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
