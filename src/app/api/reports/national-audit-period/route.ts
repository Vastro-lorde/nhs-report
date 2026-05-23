/* ──────────────────────────────────────────
   GET  /api/reports/national-audit-period       (list)
   POST /api/reports/national-audit-period       (upsert)
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { UserRole } from "@/lib/constants";
import { SavedNationalAuditPeriod } from "@/models/SavedNationalAuditPeriod";
import type {
  INationalAuditPeriodReport,
  IPeriodicCoverage,
  NationalAuditPeriodType,
} from "@/types/national-audit";

interface SavePeriodBody {
  startMonth: string;
  endMonth: string;
  periodType: NationalAuditPeriodType;
  periodLabel: string;
  auditData: INationalAuditPeriodReport;
  coverage: IPeriodicCoverage;
}

const ALLOWED_READ_ROLES: string[] = [UserRole.ADMIN, UserRole.TEAM_RESEARCH_LEAD, UserRole.ME_OFFICER];
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const PERIOD_TYPES = ["quarter", "half-year", "year", "custom"];

function validateSaveBody(body: SavePeriodBody | null) {
  if (!body) return "Request body is required.";
  if (!body.startMonth || !body.endMonth || !body.periodType || !body.periodLabel || !body.auditData || !body.coverage) {
    return "startMonth, endMonth, periodType, periodLabel, auditData, and coverage are required.";
  }
  if (!MONTH_KEY_PATTERN.test(body.startMonth) || !MONTH_KEY_PATTERN.test(body.endMonth)) {
    return "startMonth and endMonth must use YYYY-MM format.";
  }
  if (body.startMonth > body.endMonth) {
    return "startMonth must be earlier than or equal to endMonth.";
  }
  if (!PERIOD_TYPES.includes(body.periodType)) {
    return "periodType must be one of quarter, half-year, year, or custom.";
  }
  if (!Array.isArray(body.coverage.missingPairs) || !Array.isArray(body.coverage.sourceAuditIds)) {
    return "coverage must include missingPairs and sourceAuditIds arrays.";
  }
  if (
    !body.auditData.title ||
    !Array.isArray(body.auditData.geopoliticalZoneExecutiveBriefs) ||
    !body.auditData.nationalLeadershipBoard ||
    !body.auditData.nationalOperationalInsights ||
    !body.auditData.teamLeadStrategicRecommendation
  ) {
    return "auditData must match the national-audit-period Federal Oversight template.";
  }
  return null;
}

/**
 * @openapi
 * /api/reports/national-audit-period:
 *   get:
 *     tags: [Reports, National Audit]
 *     summary: List saved multi-month national audits
 *     description: >
 *       Returns paginated saved periodic national audits generated from the official Federal Oversight
 *       template. Access is limited to Admin, M&E Officer, and Team Research Lead roles. The response
 *       includes the generatedBy user reference, stored coverage metadata, and template-shaped auditData.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           example: 20
 *         description: Number of records per page.
 *     responses:
 *       200:
 *         description: Paginated periodic national audits.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SavedNationalAuditPeriod'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *             example:
 *               data:
 *                 - _id: "6650e1d6f2a0f1c65de52a91"
 *                   startMonth: "2026-01"
 *                   endMonth: "2026-03"
 *                   periodType: "quarter"
 *                   periodLabel: "Q1 2026 - January to March"
 *                   generatedBy:
 *                     _id: "664fe94d3f0cc6e112d9a102"
 *                     name: "Admin User"
 *                     email: "admin@example.com"
 *                   coverage:
 *                     expectedZoneMonths: 18
 *                     presentZoneMonths: 18
 *                     missingPairs: []
 *                     sourceAuditIds: ["6650df9af2a0f1c65de52a82"]
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 1
 *                 totalPages: 1
 *       401:
 *         description: Missing or invalid authentication.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: User role cannot read national audits.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Forbidden"
 *       500:
 *         description: Unexpected server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Internal server error"
 *   post:
 *     tags: [Reports, National Audit]
 *     summary: Save a multi-month national audit
 *     description: >
 *       Upserts a generated periodic national audit for the provided startMonth/endMonth range.
 *       Only admins can save. Re-saving the same range updates the official template auditData,
 *       coverage, period metadata, and generatedBy rather than creating a duplicate.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSavedNationalAuditPeriodRequest'
 *           example:
 *             startMonth: "2026-01"
 *             endMonth: "2026-03"
 *             periodType: "quarter"
 *             periodLabel: "Q1 2026 - January to March"
 *             coverage:
 *               expectedZoneMonths: 18
 *               presentZoneMonths: 17
 *               missingPairs:
 *                 - zoneName: "North-East"
 *                   month: "2026-02"
 *               sourceAuditIds: ["6650df9af2a0f1c65de52a82"]
 *             auditData:
 *               title: "National Health Fellows Mentorship Program: Federal Oversight Report"
 *               reportingPeriod: "Q1 2026 - January to March"
 *               totalLGAsMonitored: 774
 *               totalStatesAndFct: 37
 *               nationalFellowAttendance: "84.6%"
 *               nationalMentorEngagement: "72.2%"
 *               nationalLeadershipBoard:
 *                 topLGAs:
 *                   - nationalRank: 1
 *                     lgaName: "Oredo"
 *                     state: "Edo"
 *                     zone: "SS"
 *                     performance: "100.0% attendance / 8 submitted reports"
 *                 bottomLGAs:
 *                   - nationalRank: 1
 *                     lgaName: "Aba North"
 *                     state: "Abia"
 *                     zone: "SE"
 *                     primaryRisk: "No report submitted"
 *     responses:
 *       201:
 *         description: Saved periodic national audit.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SavedNationalAuditPeriod'
 *             example:
 *               _id: "6650e1d6f2a0f1c65de52a91"
 *               startMonth: "2026-01"
 *               endMonth: "2026-03"
 *               periodType: "quarter"
 *               periodLabel: "Q1 2026 - January to March"
 *       400:
 *         description: Validation error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "startMonth, endMonth, periodType, periodLabel, auditData, and coverage are required."
 *       401:
 *         description: Missing or invalid authentication.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Unauthorized"
 *       403:
 *         description: User is not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Only admins can save national audit reports."
 *       409:
 *         description: Duplicate range conflict from the unique range index.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "A national audit for this period already exists."
 *       500:
 *         description: Unexpected server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Internal server error"
 */
export const GET = withExceptionLog(
  "GET /api/reports/national-audit-period",
  async (request: NextRequest) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (!ALLOWED_READ_ROLES.includes(session!.user.role)) {
      return jsonError("Forbidden", 403);
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      SavedNationalAuditPeriod.find({})
        .populate("generatedBy", "name email")
        .sort({ endMonth: -1, startMonth: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SavedNationalAuditPeriod.countDocuments({}),
    ]);

    return jsonOk({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  },
);

export const POST = withExceptionLog(
  "POST /api/reports/national-audit-period",
  async (request: NextRequest) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (session!.user.role !== UserRole.ADMIN) {
      return jsonError("Only admins can save national audit reports.", 403);
    }

    const body = await parseBody<SavePeriodBody>(request);
    const validationError = validateSaveBody(body);
    if (validationError) return jsonError(validationError, 400);

    await connectDB();

    const saved = await SavedNationalAuditPeriod.findOneAndUpdate(
      { startMonth: body!.startMonth, endMonth: body!.endMonth },
      {
        generatedBy: session!.user.id,
        startMonth: body!.startMonth,
        endMonth: body!.endMonth,
        periodType: body!.periodType,
        periodLabel: body!.periodLabel,
        auditData: body!.auditData,
        coverage: body!.coverage,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).populate("generatedBy", "name email");

    void logActivity({
      session: session!,
      action: "SAVE_NATIONAL_AUDIT_PERIOD",
      targetType: "SavedNationalAuditPeriod",
      targetId: saved._id.toString(),
      targetName: `National Audit - ${body!.periodLabel}`,
      meta: {
        startMonth: body!.startMonth,
        endMonth: body!.endMonth,
        periodType: body!.periodType,
        missingZoneMonthCount: body!.coverage.missingPairs.length,
      },
    });

    return jsonOk(saved, 201);
  },
);
