/* ──────────────────────────────────────────
   Gemini AI client for audit report generation
   ────────────────────────────────────────── */
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { env } from "@/lib/env";
import { TEAM_LEAD_NAME } from "@/lib/constants";
import type { IZonalAuditReport } from "@/types/zonal-audit";
import type { INationalAuditPeriodReport, INationalAuditReport } from "@/types/national-audit";

let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const key = env.GEMINI_API_KEY();
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    _client = new GoogleGenerativeAI(key);
  }
  return _client;
}

/**
 * Gemini JSON‐mode response schema matching IZonalAuditReport.
 * This constrains the model to return the exact structure.
 */
const zonalAuditResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    zoneName:        { type: SchemaType.STRING, description: "Geopolitical zone name, e.g. 'South-South'" },
    reportingPeriod: { type: SchemaType.STRING, description: "Month and year, e.g. 'April, 2026'" },
    totalLGAs:       { type: SchemaType.INTEGER, description: "Total number of LGAs covered" },
    activeFellows:   { type: SchemaType.INTEGER, description: "Total number of active fellows" },

    stateExecutiveBriefs: {
      type: SchemaType.ARRAY,
      description: "One executive brief per state",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          stateName: { type: SchemaType.STRING },
          brief:     { type: SchemaType.STRING, description: "Narrative paragraph summarising the state's performance" },
        },
        required: ["stateName", "brief"],
      },
    },

    zonalLeadershipBoard: {
      type: SchemaType.OBJECT,
      description: "Top and bottom performing LGAs",
      properties: {
        topLGAs: {
          type: SchemaType.ARRAY,
          description: "Top 5 performing LGAs across all states",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              rank:    { type: SchemaType.INTEGER },
              lgaName: { type: SchemaType.STRING },
              state:   { type: SchemaType.STRING },
              kpi:     { type: SchemaType.STRING, description: "Key metric, e.g. '99% Attendance'" },
            },
            required: ["rank", "lgaName", "state", "kpi"],
          },
        },
        bottomLGAs: {
          type: SchemaType.ARRAY,
          description: "Bottom 5 LGAs needing improvement",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              rank:                { type: SchemaType.INTEGER },
              lgaName:             { type: SchemaType.STRING },
              state:               { type: SchemaType.STRING },
              areaForImprovement:  { type: SchemaType.STRING, description: "Specific area needing work" },
            },
            required: ["rank", "lgaName", "state", "areaForImprovement"],
          },
        },
      },
      required: ["topLGAs", "bottomLGAs"],
    },

    operationalInsights: {
      type: SchemaType.OBJECT,
      properties: {
        progressOfZone:       { type: SchemaType.STRING, description: "Overall progress narrative" },
        challengesIdentified: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "List of key challenges",
        },
        solutionsProffered:   { type: SchemaType.STRING, description: "Proposed solutions narrative" },
      },
      required: ["progressOfZone", "challengesIdentified", "solutionsProffered"],
    },

    strategicRecommendations: {
      type: SchemaType.OBJECT,
      properties: {
        coordinatorDirective:  { type: SchemaType.STRING, description: "Actionable recommendation from the Zonal Coordinator to mentors on redistributing resources and support" },
        teamLeadCommendation:  { type: SchemaType.STRING, description: "Commendation paragraph from the Zonal Coordinator acknowledging Fellows and Mentors" },
      },
      required: ["coordinatorDirective", "teamLeadCommendation"],
    },
  },
  required: [
    "zoneName", "reportingPeriod", "totalLGAs", "activeFellows",
    "stateExecutiveBriefs", "zonalLeadershipBoard",
    "operationalInsights", "strategicRecommendations",
  ],
};

/**
 * Build the system prompt for the zonal audit generation.
 */
function buildSystemPrompt(zoneName: string, reportingPeriod: string, coordinatorName: string): string {
  return `You are an expert NHS (National Health Service) Zonal Performance Auditor for Nigeria's ${zoneName} zone.

Your task is to generate a comprehensive "Zonal Monthly Performance Audit" for ${reportingPeriod} using ONLY the data provided. Do NOT fabricate or infer data that is not present.

The report follows the "Zonal Master Template" with exactly 4 sections:

**Section 1 – State-by-State Executive Brief**
For each state, write a concise but informative narrative paragraph covering:
- Number of fellows and mentors active
- Attendance rates (sessions attended vs. held)
- Key achievements and impact highlights
- Notable challenges

**Section 2 – Zonal Leadership Board**
- Top 5 LGAs: Rank by overall performance (attendance, engagement, impact). Include a KPI summary.
- Bottom 5 LGAs: Rank by areas needing improvement. Be specific about what needs work.

**Section 3 – Operational Insights & Problem Solving**
- Progress of Zone: Overall narrative of how the zone is performing
- Challenges Identified: Aggregate the most common challenges across all reports
- Solutions Proffered: Practical, actionable solutions

**Section 4 – Strategic Recommendations**
- Zonal Coordinator's Recommendation: Clear, actionable advice from the Zonal Coordinator to mentors on redistributing resources, guidance, and support for the Bottom 5 LGAs
- Zonal Coordinator's Commendation: A concluding professional remark from ${coordinatorName} (the Zonal Coordinator) acknowledging Fellows and Mentors and setting the tone for the upcoming month

Use professional, formal language appropriate for an official NHS report. Be data-driven — reference specific numbers where available.`;
}

/**
 * Generate a structured zonal audit report using Gemini.
 *
 * @param reportData - Aggregated mentor monthly report data organised by state/LGA
 * @param zoneName   - Geopolitical zone name
 * @param period     - Reporting period string (e.g. "April, 2026")
 * @returns Structured IZonalAuditReport
 */
export async function generateZonalAudit(
  reportData: object,
  zoneName: string,
  period: string,
  coordinatorName: string,
): Promise<IZonalAuditReport> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: zonalAuditResponseSchema,
    },
    systemInstruction: buildSystemPrompt(zoneName, period, coordinatorName),
  });

  const userPrompt = `Here is the aggregated data from all Mentor Monthly Reports for the ${zoneName} zone, ${period}:

${JSON.stringify(reportData, null, 2)}

Generate the complete Zonal Monthly Performance Audit report based on this data.`;

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  const parsed: IZonalAuditReport = JSON.parse(text);

  return parsed;
}

/* ──────────────────────────────────────────
   National Federal Oversight Audit
   ────────────────────────────────────────── */

/**
 * Gemini JSON-mode response schema matching INationalAuditReport.
 */
const nationalAuditResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    reportingPeriod: { type: SchemaType.STRING, description: "Month and year, e.g. 'April, 2026'" },
    totalStates:     { type: SchemaType.INTEGER, description: "Total states covered (max 37 incl. FCT)" },
    totalLGAs:       { type: SchemaType.INTEGER, description: "Total LGAs across all zones" },
    totalActiveFellows: { type: SchemaType.INTEGER, description: "Total active fellows nationally" },
    totalMentors:    { type: SchemaType.INTEGER, description: "Total mentors nationally" },

    geopoliticalZoneBriefs: {
      type: SchemaType.ARRAY,
      description: "One brief per geopolitical zone",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          zoneName:          { type: SchemaType.STRING, description: "Zone name, e.g. 'South-South'" },
          zoneActiveFellows: { type: SchemaType.INTEGER },
          zoneTotalLGAs:     { type: SchemaType.INTEGER },
          zoneTotalMentors:  { type: SchemaType.INTEGER },
          stateExecutiveBriefs: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                stateName: { type: SchemaType.STRING },
                brief:     { type: SchemaType.STRING },
              },
              required: ["stateName", "brief"],
            },
          },
        },
        required: ["zoneName", "zoneActiveFellows", "zoneTotalLGAs", "zoneTotalMentors", "stateExecutiveBriefs"],
      },
    },

    nationalLeadershipBoard: {
      type: SchemaType.OBJECT,
      description: "Top and bottom performing LGAs nationally",
      properties: {
        topLGAs: {
          type: SchemaType.ARRAY,
          description: "Top 10 performing LGAs across the nation",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              rank:    { type: SchemaType.INTEGER },
              lgaName: { type: SchemaType.STRING },
              state:   { type: SchemaType.STRING },
              kpi:     { type: SchemaType.STRING },
            },
            required: ["rank", "lgaName", "state", "kpi"],
          },
        },
        bottomLGAs: {
          type: SchemaType.ARRAY,
          description: "Bottom 10 LGAs needing improvement nationally",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              rank:               { type: SchemaType.INTEGER },
              lgaName:            { type: SchemaType.STRING },
              state:              { type: SchemaType.STRING },
              areaForImprovement: { type: SchemaType.STRING },
            },
            required: ["rank", "lgaName", "state", "areaForImprovement"],
          },
        },
      },
      required: ["topLGAs", "bottomLGAs"],
    },

    nationalOperationalInsights: {
      type: SchemaType.OBJECT,
      properties: {
        overallProgress:      { type: SchemaType.STRING, description: "Overall national progress narrative" },
        challengesIdentified: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Common challenges across all zones",
        },
        solutionsProffered:   { type: SchemaType.STRING, description: "National-level proposed solutions" },
      },
      required: ["overallProgress", "challengesIdentified", "solutionsProffered"],
    },

    strategicRecommendations: {
      type: SchemaType.OBJECT,
      properties: {
        strategicDirective: { type: SchemaType.STRING, description: "National strategic directive" },
        commendation:       { type: SchemaType.STRING, description: "Commendation from the Team Lead" },
      },
      required: ["strategicDirective", "commendation"],
    },
  },
  required: [
    "reportingPeriod", "totalStates", "totalLGAs", "totalActiveFellows", "totalMentors",
    "geopoliticalZoneBriefs", "nationalLeadershipBoard",
    "nationalOperationalInsights", "strategicRecommendations",
  ],
};

const periodicNationalAuditResponseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: "Official report title" },
    reportingPeriod: { type: SchemaType.STRING, description: "Period label, e.g. Q1 2026 - January to March" },
    totalLGAsMonitored: { type: SchemaType.INTEGER, description: "National LGA catalogue count, normally 774" },
    totalStatesAndFct: { type: SchemaType.INTEGER, description: "State entity count including FCT, normally 37" },
    nationalFellowAttendance: { type: SchemaType.STRING, description: "National fellow attendance percentage or N/A when source data is unavailable" },
    nationalMentorEngagement: { type: SchemaType.STRING, description: "National mentor engagement percentage or N/A when source data is unavailable" },

    geopoliticalZoneExecutiveBriefs: {
      type: SchemaType.ARRAY,
      description: "One entry per geopolitical zone, with every state entity including FCT under North-Central",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          zoneName: { type: SchemaType.STRING, description: "Full geopolitical zone name" },
          zoneCode: { type: SchemaType.STRING, description: "Short zone code such as NC, NE, NW, SE, SS, or SW" },
          stateCount: { type: SchemaType.INTEGER, description: "Number of state entities in the zone" },
          stateExecutiveBriefs: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                stateName: { type: SchemaType.STRING },
                brief: { type: SchemaType.STRING, description: "Strategic state-level summary based only on supplied source data" },
              },
              required: ["stateName", "brief"],
            },
          },
        },
        required: ["zoneName", "zoneCode", "stateCount", "stateExecutiveBriefs"],
      },
    },

    nationalLeadershipBoard: {
      type: SchemaType.OBJECT,
      properties: {
        topLGAs: {
          type: SchemaType.ARRAY,
          description: "Absolute Top 5 LGAs nationally",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              nationalRank: { type: SchemaType.INTEGER },
              lgaName: { type: SchemaType.STRING },
              state: { type: SchemaType.STRING },
              zone: { type: SchemaType.STRING },
              performance: { type: SchemaType.STRING },
            },
            required: ["nationalRank", "lgaName", "state", "zone", "performance"],
          },
        },
        bottomLGAs: {
          type: SchemaType.ARRAY,
          description: "Absolute Bottom 5 LGAs nationally",
          items: {
            type: SchemaType.OBJECT,
            properties: {
              nationalRank: { type: SchemaType.INTEGER },
              lgaName: { type: SchemaType.STRING },
              state: { type: SchemaType.STRING },
              zone: { type: SchemaType.STRING },
              primaryRisk: { type: SchemaType.STRING },
            },
            required: ["nationalRank", "lgaName", "state", "zone", "primaryRisk"],
          },
        },
      },
      required: ["topLGAs", "bottomLGAs"],
    },

    nationalOperationalInsights: {
      type: SchemaType.OBJECT,
      properties: {
        progressOfTheNation: { type: SchemaType.STRING, description: "Strategic summary of national progress" },
        nationalChallenges: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: "Macro-level operational hurdles",
        },
        nationalSolutionsProffered: { type: SchemaType.STRING, description: "System-wide interventions" },
      },
      required: ["progressOfTheNation", "nationalChallenges", "nationalSolutionsProffered"],
    },

    teamLeadStrategicRecommendation: {
      type: SchemaType.OBJECT,
      properties: {
        nationalDirective: { type: SchemaType.STRING, description: "National directive for programme leadership" },
        teamLeadFinalWord: { type: SchemaType.STRING, description: "Final word from the Team Lead" },
      },
      required: ["nationalDirective", "teamLeadFinalWord"],
    },
  },
  required: [
    "title",
    "reportingPeriod",
    "totalLGAsMonitored",
    "totalStatesAndFct",
    "nationalFellowAttendance",
    "nationalMentorEngagement",
    "geopoliticalZoneExecutiveBriefs",
    "nationalLeadershipBoard",
    "nationalOperationalInsights",
    "teamLeadStrategicRecommendation",
  ],
};

/**
 * Build the system prompt for the national federal oversight audit.
 */
function buildNationalSystemPrompt(reportingPeriod: string): string {
  return `You are an expert NHS (National Health Service) National Performance Auditor for Nigeria's Federal Oversight Programme.

Your task is to generate a comprehensive "National Federal Oversight Report" for ${reportingPeriod} using ONLY the data provided. Do NOT fabricate or infer data that is not present.

The report follows the "National Master Template" with exactly 6 sections covering all 6 geopolitical zones (North-Central including FCT, North-East, North-West, South-East, South-South, South-West):

**Section 1 – Geopolitical Zone Briefs**
For each of the 6 zones, provide:
- Zone-level summary stats (active fellows, LGAs covered, mentors)
- State-by-state executive briefs: a concise but informative narrative paragraph per state covering fellows, mentors, attendance, achievements, and challenges

**Section 2 – National Leadership Board**
- Top 10 LGAs nationally: Rank by overall performance (attendance, engagement, impact). Include a KPI summary for each.
- Bottom 10 LGAs nationally: Rank by areas needing improvement. Be specific about what needs work.

**Section 3 – National Operational Insights & Problem Solving**
- Overall Progress: National-level narrative of how the programme is performing
- Challenges Identified: Aggregate the most common challenges across all zones
- Solutions Proffered: Practical, actionable national-level solutions

**Section 4 – Strategic Recommendations**
- Strategic Directive: Clear, actionable national directives for programme leadership
- Commendation: A commendation paragraph from ${TEAM_LEAD_NAME} (the Team Research Lead) acknowledging the overall programme's achievements

Use professional, formal language appropriate for an official NHS national report. Be data-driven — reference specific numbers where available. Provide balanced coverage across all zones.`;
}

/**
 * Generate a structured national federal oversight audit report using Gemini.
 *
 * @param reportData - Aggregated mentor monthly report data organised by zone/state/LGA
 * @param period     - Reporting period string (e.g. "April, 2026")
 * @returns Structured INationalAuditReport
 */
export async function generateNationalAudit(
  reportData: object,
  period: string,
): Promise<INationalAuditReport> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: nationalAuditResponseSchema,
    },
    systemInstruction: buildNationalSystemPrompt(period),
  });

  const userPrompt = `Here is the aggregated data from all Mentor Monthly Reports across all 6 geopolitical zones for ${period}:

${JSON.stringify(reportData, null, 2)}

Generate the complete National Federal Oversight Report based on this data.`;

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  const parsed: INationalAuditReport = JSON.parse(text);

  return parsed;
}

function buildPeriodicNationalSystemPrompt(reportingPeriod: string): string {
  return `You are an expert NHS (National Health Service) National Performance Auditor for Nigeria's Federal Oversight Programme.

Your task is to generate the official "National Health Fellows Mentorship Program: Federal Oversight Report" for ${reportingPeriod} using ONLY the source data provided. Do NOT fabricate or infer source data that is not present.

This periodic report may include saved Zonal Audit summaries and submitted Mentor Monthly Report aggregates. Synthesize across the selected months by identifying repeated strengths, recurring challenges, improving or declining LGAs, and zone-level themes. When the source contains missing zone-month coverage, keep the language appropriately cautious and do not imply full source coverage for missing periods.

The output MUST follow this official national-audit-period template structure:

Header:
- title
- reportingPeriod
- totalLGAsMonitored
- totalStatesAndFct
- nationalFellowAttendance
- nationalMentorEngagement

**Section 1 - Geopolitical Zone Executive Brief (State-by-State Grouping)**
- Return exactly six zone groups: North-Central, North-East, North-West, South-East, South-South, South-West.
- Iterate through all 36 States plus the FCT.
- Treat FCT as the 37th State entity within the North-Central block.
- Each state entity must have one concise executive brief. If no submitted source data exists for a state, state that plainly instead of inventing performance.

**Section 2 - The National Leadership Board (Top & Bottom 5)**
- Return exactly 5 top LGAs and exactly 5 bottom LGAs.
- Use the supplied computed nationalLeadershipBoard as the ranking source because it compares all 774 LGAs nationally.
- Preserve the supplied LGA names, states, zones, rank numbers, performance labels, and primary risk labels.

**Section 3 - National Operational Insights**
- Progress of the Nation: strategic summary of how all LGAs with source data are contributing to healthcare delivery, reporting reliability, and national health data systems.
- National Challenges: macro-level operational hurdles evidenced by the source data.
- National Solutions Proffered: system-wide interventions aligned with the challenges.

**Section 4 - Team Lead's Strategic Recommendation**
- National Directive: clear national directive for the next reporting cycle.
- Team Lead's Final Word: professional closing quotation or paragraph from ${TEAM_LEAD_NAME}, Team Lead.

Use professional, formal language appropriate for an official NHS national report. Be data-driven where the source data provides numbers. Do not include markdown fences or commentary outside the JSON object.`;
}

export async function generatePeriodicNationalAudit(
  reportData: object,
  period: string,
): Promise<INationalAuditPeriodReport> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-3-flash-preview",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: periodicNationalAuditResponseSchema,
    },
    systemInstruction: buildPeriodicNationalSystemPrompt(period),
  });

  const userPrompt = `Here is the aggregated source data and computed national board for the periodic Federal Oversight Report, ${period}:

${JSON.stringify(reportData, null, 2)}

Generate the complete national-audit-period report JSON using the official template.`;

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  const parsed: INationalAuditPeriodReport = JSON.parse(text);

  return parsed;
}
