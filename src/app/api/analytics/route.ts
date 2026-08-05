/* ──────────────────────────────────────────
   API: /api/analytics — aggregated analytics data
   Fellows & mentors distribution by state, gender;
   Fellow qualifications grouped by subject area.
   Zone-scoped for coordinators and desk officers.
   Supports date range filtering via ?from=YYYY-MM-DD&to=YYYY-MM-DD
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Fellow, Mentor, Coordinator, DeskOfficer } from "@/models";
import { UserRole, resolveFellowState, resolveMentorStates, normalizeLocation } from "@/lib/constants";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError } from "@/lib/api-helpers";
import mongoose from "mongoose";

/** Map of keyword patterns → canonical qualification group */
const QUALIFICATION_GROUPS: Record<string, string[]> = {
  "Mathematics": ["math", "maths", "mathematics"],
  "Nursing": ["nursing", "nurse"],
  "Medicine": ["medicine", "medical", "mbbs", "mb;bs"],
  "Pharmacy": ["pharmacy", "pharmacist", "pharm"],
  "Biology": ["biology", "biological"],
  "Chemistry": ["chemistry", "chemical"],
  "Physics": ["physics"],
  "Biochemistry": ["biochemistry", "biochem"],
  "Microbiology": ["microbiology", "microbio"],
  "Computer Science": ["computer", "computing", "software", "information technology", "i.t"],
  "Engineering": ["engineering", "engineer"],
  "Public Health": ["public health"],
  "Anatomy": ["anatomy"],
  "Physiology": ["physiology"],
  "Medical Laboratory": ["medical lab", "med lab", "laboratory science", "laboratory technology"],
  "Health Education": ["health education", "health ed"],
  "Education": ["education", "b.ed", "bed", "nce"],
  "Agriculture": ["agriculture", "agric", "agricultural"],
  "Economics": ["economics", "econs"],
  "Accounting": ["accounting", "accountancy"],
  "Business": ["business", "management"],
  "Law": ["law", "llb"],
  "Sociology": ["sociology"],
  "Political Science": ["political science", "political"],
  "Environmental Science": ["environmental"],
  "Nutrition": ["nutrition", "dietetics", "food science"],
  "Dental": ["dental", "dentistry"],
  "Optometry": ["optometry", "optom"],
  "Radiography": ["radiography", "radiographer"],
  "Physiotherapy": ["physiotherapy"],
};

function classifyQualification(raw: string): string {
  const lower = raw.toLowerCase().trim();
  for (const [group, keywords] of Object.entries(QUALIFICATION_GROUPS)) {
    if (keywords.some(kw => lower.includes(kw))) return group;
  }
  return "Other";
}

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireAuth();
    if (error) return error;
    const user = session!.user;

    await connectDB();

    // ── Date range filtering ──
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");

    const dateFilter: Record<string, unknown> = {};
    if (fromParam || toParam) {
      dateFilter.createdAt = {};
      if (fromParam) (dateFilter.createdAt as Record<string, unknown>).$gte = new Date(fromParam);
      if (toParam) {
        const toDate = new Date(toParam);
        toDate.setHours(23, 59, 59, 999);
        (dateFilter.createdAt as Record<string, unknown>).$lte = toDate;
      }
    }

    // ── Zone scoping ──
    let scopedMentorDocIds: mongoose.Types.ObjectId[] | undefined;

    if (user.role === UserRole.COORDINATOR) {
      const coordinator = await Coordinator.findOne({ authId: user.id }).lean();
      if (coordinator) {
        const mentors = await Mentor.find({ coordinator: coordinator._id }).lean();
        scopedMentorDocIds = mentors.map(m => m._id as mongoose.Types.ObjectId);
      } else {
        scopedMentorDocIds = [];
      }
    } else if (user.role === UserRole.ZONAL_DESK_OFFICER) {
      const deskOfficer = await DeskOfficer.findOne({ authId: user.id }).lean();
      if (deskOfficer && deskOfficer.states?.length) {
        const mentors = await Mentor.find({ states: { $in: deskOfficer.states } }).lean();
        scopedMentorDocIds = mentors.map(m => m._id as mongoose.Types.ObjectId);
      } else {
        scopedMentorDocIds = [];
      }
    }

    // ── Build filters ──
    const fellowFilter: Record<string, unknown> = { ...dateFilter };
    const mentorFilter: Record<string, unknown> = { ...dateFilter };

    if (scopedMentorDocIds) {
      fellowFilter.mentor = { $in: scopedMentorDocIds };
      mentorFilter._id = { $in: scopedMentorDocIds };
    }

    // Fetch fellows and mentors with scoping
    const fellows = await Fellow.find(fellowFilter)
      .populate({ path: "mentor", select: "states lgas" })
      .lean();

    const mentors = await Mentor.find(mentorFilter).lean();

    // ── Fellows by state ──
    // A fellow belongs to exactly one state — the one its own LGA sits in.
    // Mentors may cover several states, so their `states` list can only be used
    // to disambiguate shared LGA names, never to attribute the fellow itself
    // (doing that counted every fellow once per mentor state and inflated totals).
    const fellowsByState: Record<string, number> = {};
    const fellowsByGender: Record<string, number> = {};
    const fellowsByStateGender: Record<string, Record<string, number>> = {};
    const qualificationCounts: Record<string, number> = {};
    let fellowsWithUnresolvedState = 0;

    for (const f of fellows) {
      // Gender distribution
      const gender = (f.gender || "Unknown").toUpperCase();
      fellowsByGender[gender] = (fellowsByGender[gender] || 0) + 1;

      // State distribution (fellow's LGA first, mentor only as a tie-breaker)
      const mentor = f.mentor as unknown as { states?: string[]; lgas?: string[] } | null;
      const s = resolveFellowState(f.lga, resolveMentorStates(mentor));
      if (s) {
        fellowsByState[s] = (fellowsByState[s] || 0) + 1;
        if (!fellowsByStateGender[s]) fellowsByStateGender[s] = {};
        fellowsByStateGender[s][gender] = (fellowsByStateGender[s][gender] || 0) + 1;
      } else {
        fellowsWithUnresolvedState++;
      }

      // Qualification classification
      if (f.qualification) {
        const group = classifyQualification(f.qualification);
        qualificationCounts[group] = (qualificationCounts[group] || 0) + 1;
      }
    }

    // ── Mentors by state ──
    // A mentor genuinely appears in each state they cover, so the per-state
    // counts here intentionally sum to more than `totalMentors`.
    const mentorsByState: Record<string, number> = {};
    for (const m of mentors) {
      for (const state of resolveMentorStates(m)) {
        const s = normalizeLocation(state);
        if (s) mentorsByState[s] = (mentorsByState[s] || 0) + 1;
      }
    }

    // Format outputs
    const fellowStateData = Object.entries(fellowsByState)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    const fellowGenderData = Object.entries(fellowsByGender)
      .map(([gender, count]) => ({ gender, count }))
      .sort((a, b) => b.count - a.count);

    const fellowStateGenderData = Object.entries(fellowsByStateGender)
      .map(([state, genders]) => ({
        state,
        ...genders,
        total: Object.values(genders).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);

    const mentorStateData = Object.entries(mentorsByState)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count);

    const qualificationData = Object.entries(qualificationCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return jsonOk({
      totalFellows: fellows.length,
      totalMentors: mentors.length,
      fellowsByState: fellowStateData,
      fellowsByGender: fellowGenderData,
      fellowsByStateGender: fellowStateGenderData,
      mentorsByState: mentorStateData,
      qualifications: qualificationData,
      // Fellows whose LGA could not be matched to a state (and whose mentor
      // covers more than one), surfaced instead of being guessed into a bucket.
      fellowsWithUnresolvedState,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Analytics API Error:", message);
    return jsonError(`Analytics Server Error: ${message}`, 500);
  }
}
