/* ──────────────────────────────────────────
   GET    /api/reports/national-audit-period/:id
   DELETE /api/reports/national-audit-period/:id
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guard";
import { jsonOk, jsonError, withExceptionLog } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";
import { UserRole } from "@/lib/constants";
import { SavedNationalAuditPeriod } from "@/models/SavedNationalAuditPeriod";

const ALLOWED_READ_ROLES: string[] = [UserRole.ADMIN, UserRole.TEAM_RESEARCH_LEAD, UserRole.ME_OFFICER];

/**
 * @openapi
 * /api/reports/national-audit-period/{id}:
 *   get:
 *     tags: [Reports, National Audit]
 *     summary: Get a saved multi-month national audit
 *     description: >
 *       Returns one saved periodic national audit by MongoDB ObjectId. Access is limited to Admin,
 *       M&E Officer, and Team Research Lead roles. The response includes the official Federal Oversight
 *       template auditData, generatedBy user reference, and coverage metadata captured at generation time.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 24
 *           maxLength: 24
 *           example: "6650e1d6f2a0f1c65de52a91"
 *         description: MongoDB ObjectId of the saved periodic national audit.
 *     responses:
 *       200:
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
 *               coverage:
 *                 expectedZoneMonths: 18
 *                 presentZoneMonths: 17
 *                 missingPairs:
 *                   - zoneName: "North-East"
 *                     month: "2026-02"
 *                 sourceAuditIds: ["6650df9af2a0f1c65de52a82"]
 *               auditData:
 *                 title: "National Health Fellows Mentorship Program: Federal Oversight Report"
 *                 reportingPeriod: "Q1 2026 - January to March"
 *                 totalLGAsMonitored: 774
 *                 totalStatesAndFct: 37
 *                 nationalFellowAttendance: "84.6%"
 *                 nationalMentorEngagement: "72.2%"
 *       400:
 *         description: Invalid ObjectId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Invalid national audit period id."
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
 *       404:
 *         description: Periodic national audit not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "National audit period not found."
 *       500:
 *         description: Unexpected server error.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Internal server error"
 *   delete:
 *     tags: [Reports, National Audit]
 *     summary: Delete a saved multi-month national audit
 *     description: >
 *       Deletes one saved periodic national audit by MongoDB ObjectId. Only admins can delete.
 *       This removes the saved generated report only; it does not delete source SavedZonalAudit or
 *       MentorMonthlyReport records used during generation.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 24
 *           maxLength: 24
 *           example: "6650e1d6f2a0f1c65de52a91"
 *         description: MongoDB ObjectId of the saved periodic national audit.
 *     responses:
 *       200:
 *         description: Periodic national audit deleted.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiSuccessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Deleted successfully."
 *             example:
 *               message: "Deleted successfully."
 *       400:
 *         description: Invalid ObjectId.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "Invalid national audit period id."
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
 *               error: "Only admins can delete national audit reports."
 *       404:
 *         description: Periodic national audit not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiErrorResponse'
 *             example:
 *               error: "National audit period not found."
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
  "GET /api/reports/national-audit-period/[id]",
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (!ALLOWED_READ_ROLES.includes(session!.user.role)) {
      return jsonError("Forbidden", 403);
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonError("Invalid national audit period id.", 400);
    }

    await connectDB();

    const audit = await SavedNationalAuditPeriod.findById(id)
      .populate("generatedBy", "name email")
      .lean();

    if (!audit) {
      return jsonError("National audit period not found.", 404);
    }

    return jsonOk(audit);
  },
);

export const DELETE = withExceptionLog(
  "DELETE /api/reports/national-audit-period/[id]",
  async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { session, error } = await requireAuth();
    if (error) return error;

    if (session!.user.role !== UserRole.ADMIN) {
      return jsonError("Only admins can delete national audit reports.", 403);
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return jsonError("Invalid national audit period id.", 400);
    }

    await connectDB();

    const deleted = await SavedNationalAuditPeriod.findByIdAndDelete(id);
    if (!deleted) {
      return jsonError("National audit period not found.", 404);
    }

    void logActivity({
      session: session!,
      action: "DELETE_NATIONAL_AUDIT_PERIOD",
      targetType: "SavedNationalAuditPeriod",
      targetId: id,
      targetName: `National Audit - ${deleted.periodLabel}`,
      meta: {
        startMonth: deleted.startMonth,
        endMonth: deleted.endMonth,
        periodType: deleted.periodType,
      },
    });

    return jsonOk({ message: "Deleted successfully." });
  },
);
