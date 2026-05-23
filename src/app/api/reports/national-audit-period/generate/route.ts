/* ──────────────────────────────────────────
   POST /api/reports/national-audit-period/generate
   Generates the official periodic National Federal
   Oversight Report from national source data via Gemini.
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import {
  GEOPOLITICAL_ZONES,
  STATE_LGA_DATA,
  TOTAL_NIGERIAN_LGAS,
  TOTAL_STATE_ENTITIES,
  UserRole,
  getStateForLGA,
  getZoneForState,
} from "@/lib/constants";
import { generatePeriodicNationalAudit } from "@/lib/gemini";
import { Mentor } from "@/models/Mentor";
import { MentorMonthlyReport } from "@/models/MentorMonthlyReport";
import { SavedZonalAudit } from "@/models/SavedZonalAudit";
import type {
  INationalAuditPeriodBottomLGA,
  INationalAuditPeriodReport,
  INationalAuditPeriodTopLGA,
  IPeriodicCoverage,
  NationalAuditPeriodType,
} from "@/types/national-audit";
import type { IBottomLeaderboardEntry, ILeaderboardEntry, IZonalAuditReport } from "@/types/zonal-audit";

interface GeneratePeriodBody {
  startMonth: string;
  endMonth: string;
  periodType?: NationalAuditPeriodType;
}

interface SourceZonalAudit {
  _id: unknown;
  zoneName: string;
  month: string;
  auditData: IZonalAuditReport;
}

interface SourceMentor {
  _id: unknown;
  states?: string[];
  lgas?: string[];
}

interface SourceMonthlyReport {
  mentor: unknown;
  fellow: unknown;
  month: string;
  fellowName?: string;
  fellowLGA?: string;
  sessionsHeld?: number;
  sessionsAttended?: number;
  sessionsAbsent?: number;
  summaryImpact?: string;
  challenges?: string[];
  recommendations?: string[];
  achievements?: string;
}

interface LgaStats {
  lgaName: string;
  state: string;
  zoneName: string;
  zoneCode: string;
  reportCount: number;
  sessionsHeld: number;
  sessionsAttended: number;
  sessionsAbsent: number;
  fellowNames: Set<string>;
  mentorIds: Set<string>;
  challenges: string[];
  recommendations: string[];
  achievements: string[];
  impactNotes: string[];
}

interface StateSource {
  stateName: string;
  zoneName: string;
  zoneCode: string;
  lgaCount: number;
  reportCount: number;
  lgasWithReports: number;
  fellowCount: number;
  mentorCount: number;
  attendance: string;
  sourceBriefs: string[];
}

interface ZoneSource {
  zoneName: string;
  zoneCode: string;
  stateCount: number;
  states: StateSource[];
}

interface ComputedLeadershipBoard {
  topLGAs: INationalAuditPeriodTopLGA[];
  bottomLGAs: INationalAuditPeriodBottomLGA[];
}

const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const ZONE_NAMES = Object.keys(GEOPOLITICAL_ZONES);
const MAX_MONTH_SPAN = 12;
const REPORT_TITLE = "National Health Fellows Mentorship Program: Federal Oversight Report";
const ZONE_CODES: Record<string, string> = {
  "North-Central": "NC",
  "North-East": "NE",
  "North-West": "NW",
  "South-East": "SE",
  "South-South": "SS",
  "South-West": "SW",
};
const STATE_NAME_BY_KEY = new Map(STATE_LGA_DATA.map((entry) => [stateKey(entry.state), entry.state]));

function stateKey(state: string): string {
  return state.trim().toUpperCase();
}

function lgaKey(state: string, lgaName: string): string {
  return `${stateKey(state)}::${lgaName.trim().toUpperCase()}`;
}

function idString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function displayStateName(state: string): string {
  return STATE_NAME_BY_KEY.get(stateKey(state)) ?? state;
}

function normalizeZoneName(zoneName: string): string {
  return ZONE_NAMES.find((name) => name.toLowerCase() === zoneName.toLowerCase()) ?? zoneName;
}

function zoneCodeFor(zoneName: string): string {
  return ZONE_CODES[normalizeZoneName(zoneName)] ?? zoneName;
}

function percent(numerator: number, denominator: number): string {
  if (!denominator) return "N/A";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function parseMonthKey(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return { year, monthNumber };
}

function monthDisplay(month: string): string {
  const { year, monthNumber } = parseMonthKey(month);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

function enumerateMonthKeys(startMonth: string, endMonth: string): string[] {
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  const months: string[] = [];
  let cursorYear = start.year;
  let cursorMonth = start.monthNumber;

  while (cursorYear < end.year || (cursorYear === end.year && cursorMonth <= end.monthNumber)) {
    months.push(`${cursorYear}-${String(cursorMonth).padStart(2, "0")}`);
    cursorMonth += 1;
    if (cursorMonth > 12) {
      cursorMonth = 1;
      cursorYear += 1;
    }
  }

  return months;
}

function buildPeriodLabel(
  startMonth: string,
  endMonth: string,
  periodType: NationalAuditPeriodType,
): string {
  const months = enumerateMonthKeys(startMonth, endMonth);
  const start = parseMonthKey(startMonth);
  const end = parseMonthKey(endMonth);
  const sameYear = start.year === end.year;

  if (sameYear && periodType === "quarter" && months.length === 3) {
    const quarter = Math.floor((start.monthNumber - 1) / 3) + 1;
    return `Q${quarter} ${start.year} - ${MONTH_NAMES[start.monthNumber - 1]} to ${MONTH_NAMES[end.monthNumber - 1]}`;
  }

  if (sameYear && periodType === "half-year" && months.length === 6) {
    const half = start.monthNumber === 1 ? "H1" : "H2";
    return `${half} ${start.year} - ${MONTH_NAMES[start.monthNumber - 1]} to ${MONTH_NAMES[end.monthNumber - 1]}`;
  }

  if (sameYear && periodType === "year" && months.length === 12) {
    return `${start.year} - ${MONTH_NAMES[start.monthNumber - 1]} to ${MONTH_NAMES[end.monthNumber - 1]}`;
  }

  return `${monthDisplay(startMonth)} - ${monthDisplay(endMonth)}`;
}

function validateGenerateBody(body: GeneratePeriodBody | null) {
  if (!body?.startMonth || !body?.endMonth) {
    return "startMonth and endMonth are required.";
  }

  if (!MONTH_KEY_PATTERN.test(body.startMonth) || !MONTH_KEY_PATTERN.test(body.endMonth)) {
    return "startMonth and endMonth must use YYYY-MM format.";
  }

  if (body.startMonth > body.endMonth) {
    return "startMonth must be earlier than or equal to endMonth.";
  }

  const months = enumerateMonthKeys(body.startMonth, body.endMonth);
  if (months.length > MAX_MONTH_SPAN) {
    return `National audit periods cannot exceed ${MAX_MONTH_SPAN} months.`;
  }

  if (
    body.periodType &&
    !["quarter", "half-year", "year", "custom"].includes(body.periodType)
  ) {
    return "periodType must be one of quarter, half-year, year, or custom.";
  }

  return null;
}

function buildCoverage(audits: SourceZonalAudit[], months: string[]): IPeriodicCoverage {
  const presentZoneMonths = new Set(
    audits.map((audit) => `${normalizeZoneName(audit.zoneName)}::${audit.month}`),
  );
  const missingPairs = ZONE_NAMES.flatMap((zoneName) =>
    months
      .filter((month) => !presentZoneMonths.has(`${zoneName}::${month}`))
      .map((month) => ({ zoneName, month })),
  );

  return {
    expectedZoneMonths: ZONE_NAMES.length * months.length,
    presentZoneMonths: ZONE_NAMES.length * months.length - missingPairs.length,
    missingPairs,
    sourceAuditIds: audits.map((audit) => String(audit._id)),
  };
}

function emptyLgaStats(): Map<string, LgaStats> {
  const stats = new Map<string, LgaStats>();

  for (const stateEntry of STATE_LGA_DATA) {
    const zoneName = getZoneForState(stateEntry.state) ?? "Unknown Zone";
    for (const lga of stateEntry.lgas) {
      stats.set(lgaKey(stateEntry.state, lga.name), {
        lgaName: lga.name,
        state: stateEntry.state,
        zoneName,
        zoneCode: zoneCodeFor(zoneName),
        reportCount: 0,
        sessionsHeld: 0,
        sessionsAttended: 0,
        sessionsAbsent: 0,
        fellowNames: new Set(),
        mentorIds: new Set(),
        challenges: [],
        recommendations: [],
        achievements: [],
        impactNotes: [],
      });
    }
  }

  return stats;
}

function buildStateSourceSkeleton(): Map<string, StateSource> {
  const sources = new Map<string, StateSource>();

  for (const stateEntry of STATE_LGA_DATA) {
    const zoneName = getZoneForState(stateEntry.state) ?? "Unknown Zone";
    sources.set(stateKey(stateEntry.state), {
      stateName: stateEntry.state,
      zoneName,
      zoneCode: zoneCodeFor(zoneName),
      lgaCount: stateEntry.lgas.length,
      reportCount: 0,
      lgasWithReports: 0,
      fellowCount: 0,
      mentorCount: 0,
      attendance: "N/A",
      sourceBriefs: [],
    });
  }

  return sources;
}

function stateForReport(report: SourceMonthlyReport, mentorInfo?: SourceMentor): string {
  const stateFromLga = report.fellowLGA ? getStateForLGA(report.fellowLGA) : null;
  return displayStateName(stateFromLga ?? mentorInfo?.states?.[0] ?? "Unknown");
}

function scoreLga(stat: LgaStats): number {
  const attendanceRate = stat.sessionsHeld ? stat.sessionsAttended / stat.sessionsHeld : 0;
  const volumeScore = Math.min(stat.reportCount, 8) / 8;
  const fellowScore = Math.min(stat.fellowNames.size, 10) / 10;
  return attendanceRate * 70 + volumeScore * 20 + fellowScore * 10;
}

function compareByName(a: LgaStats, b: LgaStats): number {
  return a.state.localeCompare(b.state) || a.lgaName.localeCompare(b.lgaName);
}

function lgaPerformanceLabel(stat: LgaStats): string {
  const attendance = percent(stat.sessionsAttended, stat.sessionsHeld);
  const reportLabel = `${stat.reportCount} submitted report${stat.reportCount === 1 ? "" : "s"}`;
  return `${attendance} attendance / ${reportLabel}`;
}

function lgaRiskLabel(stat: LgaStats): string {
  if (stat.reportCount === 0) return "No report submitted";
  if (stat.sessionsHeld === 0) return "No attendance data recorded";

  const attendanceRate = stat.sessionsAttended / stat.sessionsHeld;
  if (attendanceRate < 0.5) return `Critical attendance drop (${percent(stat.sessionsAttended, stat.sessionsHeld)})`;
  if (stat.challenges.length > stat.reportCount) return "High recurring operational challenge load";
  if (stat.reportCount === 1) return "Low reporting volume";
  return `Attendance below national priority threshold (${percent(stat.sessionsAttended, stat.sessionsHeld)})`;
}

function buildFallbackBoardFromZonalAudits(audits: SourceZonalAudit[]): ComputedLeadershipBoard {
  const topCandidates: Array<ILeaderboardEntry & { zoneName: string }> = [];
  const bottomCandidates: Array<IBottomLeaderboardEntry & { zoneName: string }> = [];

  for (const audit of audits) {
    const zoneName = normalizeZoneName(audit.zoneName);
    for (const entry of audit.auditData.zonalLeadershipBoard?.topLGAs ?? []) {
      topCandidates.push({ ...entry, zoneName });
    }
    for (const entry of audit.auditData.zonalLeadershipBoard?.bottomLGAs ?? []) {
      bottomCandidates.push({ ...entry, zoneName });
    }
  }

  return {
    topLGAs: topCandidates.slice(0, 5).map((entry, index) => ({
      nationalRank: index + 1,
      lgaName: entry.lgaName,
      state: displayStateName(entry.state),
      zone: zoneCodeFor(entry.zoneName),
      performance: entry.kpi,
    })),
    bottomLGAs: bottomCandidates.slice(0, 5).map((entry, index) => ({
      nationalRank: index + 1,
      lgaName: entry.lgaName,
      state: displayStateName(entry.state),
      zone: zoneCodeFor(entry.zoneName),
      primaryRisk: entry.areaForImprovement,
    })),
  };
}

function fillLeadershipBoard(board: ComputedLeadershipBoard, lgaStats: LgaStats[]): ComputedLeadershipBoard {
  const fillers = [...lgaStats].sort(compareByName);
  let fillerIndex = 0;

  while (board.topLGAs.length < 5 && fillerIndex < fillers.length) {
    const stat = fillers[fillerIndex];
    fillerIndex += 1;
    if (board.topLGAs.some((entry) => entry.lgaName === stat.lgaName && entry.state === stat.state)) continue;
    board.topLGAs.push({
      nationalRank: board.topLGAs.length + 1,
      lgaName: stat.lgaName,
      state: stat.state,
      zone: stat.zoneCode,
      performance: stat.reportCount ? lgaPerformanceLabel(stat) : "No submitted report data available",
    });
  }

  fillerIndex = 0;
  while (board.bottomLGAs.length < 5 && fillerIndex < fillers.length) {
    const stat = fillers[fillerIndex];
    fillerIndex += 1;
    if (board.bottomLGAs.some((entry) => entry.lgaName === stat.lgaName && entry.state === stat.state)) continue;
    board.bottomLGAs.push({
      nationalRank: board.bottomLGAs.length + 1,
      lgaName: stat.lgaName,
      state: stat.state,
      zone: stat.zoneCode,
      primaryRisk: lgaRiskLabel(stat),
    });
  }

  return board;
}

function buildComputedLeadershipBoard(
  lgaStats: Map<string, LgaStats>,
  audits: SourceZonalAudit[],
): ComputedLeadershipBoard {
  const allStats = Array.from(lgaStats.values());
  const activeStats = allStats.filter((stat) => stat.reportCount > 0);

  if (!activeStats.length) {
    return fillLeadershipBoard(buildFallbackBoardFromZonalAudits(audits), allStats);
  }

  const topLGAs = [...activeStats]
    .sort((a, b) => scoreLga(b) - scoreLga(a) || b.reportCount - a.reportCount || compareByName(a, b))
    .slice(0, 5)
    .map((stat, index) => ({
      nationalRank: index + 1,
      lgaName: stat.lgaName,
      state: stat.state,
      zone: stat.zoneCode,
      performance: lgaPerformanceLabel(stat),
    }));

  const bottomLGAs = [...allStats]
    .sort((a, b) => {
      const aAttendance = a.sessionsHeld ? a.sessionsAttended / a.sessionsHeld : 0;
      const bAttendance = b.sessionsHeld ? b.sessionsAttended / b.sessionsHeld : 0;
      return a.reportCount - b.reportCount || aAttendance - bAttendance || scoreLga(a) - scoreLga(b) || compareByName(a, b);
    })
    .slice(0, 5)
    .map((stat, index) => ({
      nationalRank: index + 1,
      lgaName: stat.lgaName,
      state: stat.state,
      zone: stat.zoneCode,
      primaryRisk: lgaRiskLabel(stat),
    }));

  return { topLGAs, bottomLGAs };
}

function addSourceBriefsFromZonalAudits(
  stateSources: Map<string, StateSource>,
  audits: SourceZonalAudit[],
) {
  for (const audit of audits) {
    for (const brief of audit.auditData.stateExecutiveBriefs ?? []) {
      const source = stateSources.get(stateKey(brief.stateName));
      if (source) {
        source.sourceBriefs.push(`${audit.month}: ${brief.brief}`);
      }
    }
  }
}

function buildSourcePayload(
  audits: SourceZonalAudit[],
  monthlyReports: SourceMonthlyReport[],
  mentors: SourceMentor[],
  months: string[],
  periodLabel: string,
  coverage: IPeriodicCoverage,
) {
  const mentorMap = new Map(mentors.map((mentor) => [idString(mentor._id), mentor]));
  const lgaStats = emptyLgaStats();
  const stateSources = buildStateSourceSkeleton();
  const engagedMentorMonths = new Set<string>();
  let totalSessionsHeld = 0;
  let totalSessionsAttended = 0;

  for (const report of monthlyReports) {
    const mentorId = idString(report.mentor);
    const mentorInfo = mentorMap.get(mentorId);
    const state = stateForReport(report, mentorInfo);
    const lgaName = report.fellowLGA?.trim() || "Unknown LGA";
    const stats = lgaStats.get(lgaKey(state, lgaName));
    if (!stats) continue;

    const sessionsHeld = report.sessionsHeld ?? 0;
    const sessionsAttended = report.sessionsAttended ?? 0;
    const sessionsAbsent = report.sessionsAbsent ?? Math.max(0, sessionsHeld - sessionsAttended);

    stats.reportCount += 1;
    stats.sessionsHeld += sessionsHeld;
    stats.sessionsAttended += sessionsAttended;
    stats.sessionsAbsent += sessionsAbsent;
    if (report.fellowName) stats.fellowNames.add(report.fellowName);
    if (mentorId) stats.mentorIds.add(mentorId);
    stats.challenges.push(...(report.challenges ?? []));
    stats.recommendations.push(...(report.recommendations ?? []));
    if (report.achievements) stats.achievements.push(report.achievements);
    if (report.summaryImpact) stats.impactNotes.push(report.summaryImpact);

    totalSessionsHeld += sessionsHeld;
    totalSessionsAttended += sessionsAttended;
    if (mentorId && report.month) engagedMentorMonths.add(`${mentorId}::${report.month}`);
  }

  const stateLgasWithReports = new Map<string, Set<string>>();
  const stateFellows = new Map<string, Set<string>>();
  const stateMentors = new Map<string, Set<string>>();
  const stateSessions = new Map<string, { held: number; attended: number }>();

  for (const stat of lgaStats.values()) {
    const key = stateKey(stat.state);
    if (!stateLgasWithReports.has(key)) stateLgasWithReports.set(key, new Set());
    if (!stateFellows.has(key)) stateFellows.set(key, new Set());
    if (!stateMentors.has(key)) stateMentors.set(key, new Set());
    if (!stateSessions.has(key)) stateSessions.set(key, { held: 0, attended: 0 });

    if (stat.reportCount > 0) stateLgasWithReports.get(key)!.add(stat.lgaName);
    for (const fellowName of stat.fellowNames) stateFellows.get(key)!.add(fellowName);
    for (const mentorId of stat.mentorIds) stateMentors.get(key)!.add(mentorId);
    const sessions = stateSessions.get(key)!;
    sessions.held += stat.sessionsHeld;
    sessions.attended += stat.sessionsAttended;
  }

  addSourceBriefsFromZonalAudits(stateSources, audits);

  for (const [key, source] of stateSources) {
    const sessions = stateSessions.get(key) ?? { held: 0, attended: 0 };
    source.lgasWithReports = stateLgasWithReports.get(key)?.size ?? 0;
    source.fellowCount = stateFellows.get(key)?.size ?? 0;
    source.mentorCount = stateMentors.get(key)?.size ?? 0;
    source.reportCount = Array.from(lgaStats.values())
      .filter((stat) => stateKey(stat.state) === key)
      .reduce((count, stat) => count + stat.reportCount, 0);
    source.attendance = percent(sessions.attended, sessions.held);
  }

  const leadershipBoard = buildComputedLeadershipBoard(lgaStats, audits);
  const zones: ZoneSource[] = ZONE_NAMES.map((zoneName) => {
    const stateNames = GEOPOLITICAL_ZONES[zoneName].map(displayStateName);
    return {
      zoneName,
      zoneCode: zoneCodeFor(zoneName),
      stateCount: stateNames.length,
      states: stateNames
        .map((stateName) => stateSources.get(stateKey(stateName)))
        .filter((source): source is StateSource => Boolean(source)),
    };
  });

  const lgasWithSubmittedReports = Array.from(lgaStats.values()).filter((stat) => stat.reportCount > 0).length;
  const expectedMentorMonths = mentors.length * months.length;

  return {
    payload: {
      template: {
        title: REPORT_TITLE,
        developerInstruction:
          "Iterate all 36 States plus FCT, group summaries into the six geopolitical zones, treat FCT as the 37th State entity in North-Central, and compare all 774 LGAs for the Top 5 and Bottom 5 national board.",
      },
      reportingPeriod: periodLabel,
      monthRange: { startMonth: months[0], endMonth: months[months.length - 1], months },
      coverage,
      nationalMetrics: {
        totalLGAsMonitored: TOTAL_NIGERIAN_LGAS,
        totalStatesAndFct: TOTAL_STATE_ENTITIES,
        nationalFellowAttendance: percent(totalSessionsAttended, totalSessionsHeld),
        nationalMentorEngagement: percent(engagedMentorMonths.size, expectedMentorMonths),
        sourceZonalAuditCount: audits.length,
        submittedMonthlyReportCount: monthlyReports.length,
        lgasWithSubmittedReports,
      },
      computedNationalLeadershipBoard: leadershipBoard,
      geopoliticalZones: zones,
      sourceZonalAudits: audits.map((audit) => ({
        sourceAuditId: String(audit._id),
        zoneName: normalizeZoneName(audit.zoneName),
        month: audit.month,
        reportingPeriod: audit.auditData.reportingPeriod,
        operationalInsights: audit.auditData.operationalInsights,
        strategicRecommendations: audit.auditData.strategicRecommendations,
      })),
    },
    zones,
    leadershipBoard,
    metrics: {
      totalLGAsMonitored: TOTAL_NIGERIAN_LGAS,
      totalStatesAndFct: TOTAL_STATE_ENTITIES,
      nationalFellowAttendance: percent(totalSessionsAttended, totalSessionsHeld),
      nationalMentorEngagement: percent(engagedMentorMonths.size, expectedMentorMonths),
    },
  };
}

function fallbackStateBrief(source: StateSource): string {
  if (source.sourceBriefs.length > 0) {
    return source.sourceBriefs.join("\n\n");
  }

  if (source.reportCount > 0) {
    return `${source.stateName} recorded ${source.reportCount} submitted mentor monthly report(s) across ${source.lgasWithReports} LGA(s), with ${source.fellowCount} fellow(s), ${source.mentorCount} mentor(s), and ${source.attendance} fellow attendance during the reporting period.`;
  }

  return `No submitted source data was available for ${source.stateName} during this reporting period.`;
}

function normalizeGeneratedReport(
  report: INationalAuditPeriodReport,
  periodLabel: string,
  metrics: {
    totalLGAsMonitored: number;
    totalStatesAndFct: number;
    nationalFellowAttendance: string;
    nationalMentorEngagement: string;
  },
  zones: ZoneSource[],
  leadershipBoard: ComputedLeadershipBoard,
): INationalAuditPeriodReport {
  return {
    ...report,
    title: REPORT_TITLE,
    reportingPeriod: periodLabel,
    totalLGAsMonitored: metrics.totalLGAsMonitored,
    totalStatesAndFct: metrics.totalStatesAndFct,
    nationalFellowAttendance: metrics.nationalFellowAttendance,
    nationalMentorEngagement: metrics.nationalMentorEngagement,
    geopoliticalZoneExecutiveBriefs: zones.map((zone) => {
      const generatedZone = (report.geopoliticalZoneExecutiveBriefs ?? []).find(
        (item) => normalizeZoneName(item.zoneName) === zone.zoneName || item.zoneCode === zone.zoneCode,
      );
      const generatedStateBriefs = new Map(
        generatedZone?.stateExecutiveBriefs.map((brief) => [stateKey(brief.stateName), brief.brief]) ?? [],
      );

      return {
        zoneName: zone.zoneName,
        zoneCode: zone.zoneCode,
        stateCount: zone.stateCount,
        stateExecutiveBriefs: zone.states.map((state) => ({
          stateName: state.stateName,
          brief: generatedStateBriefs.get(stateKey(state.stateName)) || fallbackStateBrief(state),
        })),
      };
    }),
    nationalLeadershipBoard: leadershipBoard,
  };
}

/**
 * @openapi
 * /api/reports/national-audit-period/generate:
 *   post:
 *     tags: [Reports, National Audit]
 *     summary: Generate the periodic Federal Oversight report
 *     description: >
 *       Generates a non-persisted national-audit-period preview using Gemini and the official
 *       Federal Oversight template. The endpoint derives the selected range from startMonth/endMonth,
 *       aggregates saved zonal audits plus submitted MentorMonthlyReport data, computes national
 *       fellow attendance, mentor engagement, all 37 state entities including FCT, and a Top 5/Bottom 5
 *       board by comparing the local 774-LGA catalogue. The authenticated admin must have AI access.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateNationalAuditPeriodRequest'
 *           example:
 *             startMonth: "2026-01"
 *             endMonth: "2026-03"
 *             periodType: "quarter"
 *     responses:
 *       200:
 *         description: Generated periodic Federal Oversight report preview with source coverage metadata.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/GeneratedNationalAuditPeriodResponse'
 *             example:
 *               data:
 *                 startMonth: "2026-01"
 *                 endMonth: "2026-03"
 *                 periodType: "quarter"
 *                 periodLabel: "Q1 2026 - January to March"
 *                 coverage:
 *                   expectedZoneMonths: 18
 *                   presentZoneMonths: 17
 *                   missingPairs:
 *                     - zoneName: "North-East"
 *                       month: "2026-02"
 *                   sourceAuditIds: ["6650e1d6f2a0f1c65de52a91"]
 *                 auditData:
 *                   title: "National Health Fellows Mentorship Program: Federal Oversight Report"
 *                   reportingPeriod: "Q1 2026 - January to March"
 *                   totalLGAsMonitored: 774
 *                   totalStatesAndFct: 37
 *                   nationalFellowAttendance: "84.6%"
 *                   nationalMentorEngagement: "72.2%"
 *                   nationalLeadershipBoard:
 *                     topLGAs:
 *                       - nationalRank: 1
 *                         lgaName: "Oredo"
 *                         state: "Edo"
 *                         zone: "SS"
 *                         performance: "100.0% attendance / 8 submitted reports"
 *                     bottomLGAs:
 *                       - nationalRank: 1
 *                         lgaName: "Aba North"
 *                         state: "Abia"
 *                         zone: "SE"
 *                         primaryRisk: "No report submitted"
 *       400:
 *         description: Validation error or no source data found for the selected period.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "startMonth and endMonth must use YYYY-MM format."
 *       401:
 *         description: Missing or invalid authentication.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: User is not an admin or does not have AI access.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Only admins can generate national audit reports."
 *       503:
 *         description: AI service quota, availability, or authentication failure.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "The AI model is currently experiencing high demand. Please try again in a few minutes."
 *       500:
 *         description: Unexpected server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Internal server error"
 */
export const POST = withExceptionLog(
  "POST /api/reports/national-audit-period/generate",
  async (req: NextRequest) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (session!.user.role !== UserRole.ADMIN) {
      return jsonError("Only admins can generate national audit reports.", 403);
    }

    if (!session!.user.aiAccessEnabled) {
      return jsonError("AI access is not enabled for your account.", 403);
    }

    const body = await parseBody<GeneratePeriodBody>(req);
    const validationError = validateGenerateBody(body);
    if (validationError) return jsonError(validationError, 400);

    const startMonth = body!.startMonth;
    const endMonth = body!.endMonth;
    const periodType = body!.periodType ?? "custom";
    const months = enumerateMonthKeys(startMonth, endMonth);
    const periodLabel = buildPeriodLabel(startMonth, endMonth, periodType);

    await connectDB();

    const [sourceAuditsRaw, sourceMentorsRaw, sourceMonthlyReportsRaw] = await Promise.all([
      SavedZonalAudit.find({ month: { $in: months } }).select("zoneName month auditData").lean(),
      Mentor.find({}).select("states lgas").lean(),
      MentorMonthlyReport.find({ month: { $in: months }, status: "submitted" })
        .select(
          "mentor fellow month fellowName fellowLGA sessionsHeld sessionsAttended sessionsAbsent summaryImpact challenges recommendations achievements",
        )
        .lean(),
    ]);

    const sourceAudits = sourceAuditsRaw as unknown as SourceZonalAudit[];
    const sourceMentors = sourceMentorsRaw as unknown as SourceMentor[];
    const sourceMonthlyReports = sourceMonthlyReportsRaw as unknown as SourceMonthlyReport[];

    if (!sourceAudits.length && !sourceMonthlyReports.length) {
      return jsonError(
        `No saved zonal audits or submitted mentor monthly reports found between ${startMonth} and ${endMonth}.`,
        400,
      );
    }

    const coverage = buildCoverage(sourceAudits, months);
    const { payload, zones, leadershipBoard, metrics } = buildSourcePayload(
      sourceAudits,
      sourceMonthlyReports,
      sourceMentors,
      months,
      periodLabel,
      coverage,
    );

    let auditData: INationalAuditPeriodReport;
    try {
      const generated = await generatePeriodicNationalAudit(payload, periodLabel);
      auditData = normalizeGeneratedReport(generated, periodLabel, metrics, zones, leadershipBoard);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("429") || msg.includes("quota") || msg.includes("credits")) {
        return jsonError(
          "AI service quota exceeded. Please try again later or contact an administrator.",
          503,
        );
      }
      if (msg.includes("503") || msg.includes("Service Unavailable") || msg.includes("high demand")) {
        return jsonError(
          "The AI model is currently experiencing high demand. Please try again in a few minutes.",
          503,
        );
      }
      if (msg.includes("403") || msg.includes("API_KEY")) {
        return jsonError("AI service authentication failed. Please contact an administrator.", 503);
      }
      throw err;
    }

    void logActivity({
      session: session!,
      action: "generate_national_audit_period",
      targetType: "NationalAuditPeriod",
      targetName: `National Audit - ${periodLabel}`,
      meta: {
        startMonth,
        endMonth,
        periodType,
        sourceZonalAuditCount: sourceAudits.length,
        submittedMonthlyReportCount: sourceMonthlyReports.length,
        missingZoneMonthCount: coverage.missingPairs.length,
      },
    });

    return jsonOk({
      startMonth,
      endMonth,
      periodType,
      periodLabel,
      coverage,
      auditData,
    });
  },
);
