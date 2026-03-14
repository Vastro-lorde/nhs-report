/* ──────────────────────────────────────────
   API: /api/team-research-leads/[id] — single Team Research Lead ops
   ────────────────────────────────────────── */
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, TeamResearchLead } from "@/models";
import { UserRole } from "@/lib/constants";
import { requireRole } from "@/lib/auth-guard";
import { jsonOk, jsonError, parseBody } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity-logger";

type Params = { params: Promise<{ id: string }> };

// GET /api/team-research-leads/:id
export async function GET(_request: NextRequest, { params }: Params) {
    const { error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();

    const user = await User.findById(id).select("-password").lean();
    if (!user) return jsonError("Team Research Lead not found", 404);

    const teamResearchLeadDoc = await TeamResearchLead.findOne({ authId: user._id }).lean();
    const merged = {
        ...user,
        teamResearchLeadId: teamResearchLeadDoc?._id,
    };

    return jsonOk(merged);
}

// PATCH /api/team-research-leads/:id
export async function PATCH(request: NextRequest, { params }: Params) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    const body = await parseBody<Record<string, unknown>>(request);
    if (!body) return jsonError("Invalid body");

    // Prevent password/role update via this endpoint
    delete body.password;
    delete body.role;

    const { ...userUpdates } = body;

    await connectDB();

    const updatedUser = await User.findByIdAndUpdate(id, userUpdates, { new: true })
        .select("-password")
        .lean();

    if (!updatedUser) return jsonError("Team Research Lead not found", 404);

    // Ensure Team Research Lead document exists
    const teamResearchLeadDoc = await TeamResearchLead.findOne({ authId: id }).lean();

    const merged = {
        ...updatedUser,
        teamResearchLeadId: teamResearchLeadDoc?._id,
    };

    void logActivity({ session, action: "UPDATE_TEAM_RESEARCH_LEAD", targetType: "TeamResearchLead", targetId: id, targetName: updatedUser.name });
    return jsonOk(merged);
}

// DELETE /api/team-research-leads/:id — soft-delete (deactivate)
export async function DELETE(_request: NextRequest, { params }: Params) {
    const { session, error } = await requireRole(UserRole.ADMIN);
    if (error) return error;

    const { id } = await params;
    await connectDB();
    const teamResearchLead = await User.findByIdAndUpdate(id, { active: false }, { new: true })
        .select("-password")
        .lean();

    if (!teamResearchLead) return jsonError("Team Research Lead not found", 404);

    void logActivity({ session, action: "DEACTIVATE_TEAM_RESEARCH_LEAD", targetType: "TeamResearchLead", targetId: id, targetName: teamResearchLead.name });
    return jsonOk({ message: "Team Research Lead deactivated", teamResearchLead });
}
