/* ──────────────────────────────────────────
   Gemini AI client for zonal audit reports
   ────────────────────────────────────────── */
import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";
import { env } from "@/lib/env";
import { TEAM_LEAD_NAME } from "@/lib/constants";
import type { IZonalAuditReport } from "@/types/zonal-audit";

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
        coordinatorDirective:  { type: SchemaType.STRING, description: "Directive paragraph for the coordinator" },
        teamLeadCommendation:  { type: SchemaType.STRING, description: "Commendation paragraph from the team lead" },
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
function buildSystemPrompt(zoneName: string, reportingPeriod: string): string {
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
- Coordinator Directive: Clear, actionable directives for the zonal coordinator
- Team Lead Commendation: A commendation paragraph from ${TEAM_LEAD_NAME} (the Team Research Lead) acknowledging the zone's work

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
): Promise<IZonalAuditReport> {
  const client = getClient();

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: zonalAuditResponseSchema,
    },
    systemInstruction: buildSystemPrompt(zoneName, period),
  });

  const userPrompt = `Here is the aggregated data from all Mentor Monthly Reports for the ${zoneName} zone, ${period}:

${JSON.stringify(reportData, null, 2)}

Generate the complete Zonal Monthly Performance Audit report based on this data.`;

  const result = await model.generateContent(userPrompt);
  const text = result.response.text();
  const parsed: IZonalAuditReport = JSON.parse(text);

  return parsed;
}
