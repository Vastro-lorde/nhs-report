/* ──────────────────────────────────────────
   Type: INationalAuditReport
   Structured data for AI-generated national
   federal oversight audit reports.
   Shared between Gemini responseSchema,
   API responses, and frontend rendering.
   ────────────────────────────────────────── */

import type {
  IStateExecutiveBrief,
  ILeaderboardEntry,
  IBottomLeaderboardEntry,
} from "./zonal-audit";

export type NationalAuditPeriodType = "quarter" | "half-year" | "year" | "custom";

export interface INationalAuditMissingCoveragePair {
  zoneName: string;
  month: string;
}

export interface IPeriodicCoverage {
  expectedZoneMonths: number;
  presentZoneMonths: number;
  missingPairs: INationalAuditMissingCoveragePair[];
  sourceAuditIds: string[];
}

export interface INationalAuditPeriodStateBrief {
  stateName: string;
  brief: string;
}

export interface INationalAuditPeriodZoneBrief {
  zoneName: string;
  zoneCode: string;
  stateCount: number;
  stateExecutiveBriefs: INationalAuditPeriodStateBrief[];
}

export interface INationalAuditPeriodTopLGA {
  nationalRank: number;
  lgaName: string;
  state: string;
  zone: string;
  performance: string;
}

export interface INationalAuditPeriodBottomLGA {
  nationalRank: number;
  lgaName: string;
  state: string;
  zone: string;
  primaryRisk: string;
}

export interface INationalAuditPeriodLeadershipBoard {
  topLGAs: INationalAuditPeriodTopLGA[];
  bottomLGAs: INationalAuditPeriodBottomLGA[];
}

export interface INationalAuditPeriodOperationalInsights {
  progressOfTheNation: string;
  nationalChallenges: string[];
  nationalSolutionsProffered: string;
}

export interface INationalAuditPeriodStrategicRecommendation {
  nationalDirective: string;
  teamLeadFinalWord: string;
}

export interface INationalAuditPeriodReport {
  title: string;
  reportingPeriod: string;
  totalLGAsMonitored: number;
  totalStatesAndFct: number;
  nationalFellowAttendance: string;
  nationalMentorEngagement: string;
  geopoliticalZoneExecutiveBriefs: INationalAuditPeriodZoneBrief[];
  nationalLeadershipBoard: INationalAuditPeriodLeadershipBoard;
  nationalOperationalInsights: INationalAuditPeriodOperationalInsights;
  teamLeadStrategicRecommendation: INationalAuditPeriodStrategicRecommendation;
}

/** Summary for one geopolitical zone within the national report */
export interface IZoneBrief {
  zoneName: string;
  zoneActiveFellows: number;
  zoneTotalLGAs: number;
  zoneTotalMentors: number;
  stateExecutiveBriefs: IStateExecutiveBrief[];
}

/** Top and bottom performing LGAs at national level */
export interface INationalLeadershipBoard {
  topLGAs: ILeaderboardEntry[];
  bottomLGAs: IBottomLeaderboardEntry[];
}

/** National-level operational insights */
export interface INationalOperationalInsights {
  overallProgress: string;
  challengesIdentified: string[];
  solutionsProffered: string;
}

/** Strategic recommendations from the team lead */
export interface INationalStrategicRecommendations {
  strategicDirective: string;
  commendation: string;
}

/** Root type for the entire National Federal Oversight Report */
export interface INationalAuditReport {
  reportingPeriod: string;
  totalStates: number;
  totalLGAs: number;
  totalActiveFellows: number;
  totalMentors: number;

  geopoliticalZoneBriefs: IZoneBrief[];

  nationalLeadershipBoard: INationalLeadershipBoard;

  nationalOperationalInsights: INationalOperationalInsights;

  strategicRecommendations: INationalStrategicRecommendations;
}
