import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { SavedZonalAudit } from "@/models/SavedZonalAudit";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { UserRole, getZoneForState } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const audit = await SavedZonalAudit.findById(id)
            .populate({
                path: "coordinator",
                populate: { path: "authId", select: "name email" },
            })
            .lean();

        if (!audit) {
            return NextResponse.json({ error: "Zonal audit not found" }, { status: 404 });
        }

        const role = session.user.role;

        // Role-based access
        if (role === UserRole.MENTOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (role === UserRole.COORDINATOR) {
            if (!session.user.aiAccessEnabled) {
                return NextResponse.json({ error: "AI access is required to view zonal audits." }, { status: 403 });
            }
            const coordDoc = await Coordinator.findOne({ authId: session.user.id });
            if (!coordDoc || audit.coordinator?._id?.toString() !== coordDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        if (role === UserRole.ZONAL_DESK_OFFICER) {
            const deskDoc = await DeskOfficer.findOne({ authId: session.user.id });
            if (!deskDoc) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
            const deskZones = [...new Set(deskDoc.states.map(getZoneForState).filter(Boolean))];
            if (!deskZones.includes(audit.zoneName)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        // Admin, ME Officer, Team Research Lead — unrestricted

        // Normalize coordinator for client
        const normalized: any = { ...audit };
        if ((audit as any).coordinator?.authId) {
            const c = (audit as any).coordinator;
            normalized.coordinator = {
                _id: c._id,
                name: c.authId?.name,
                email: c.authId?.email,
                state: c.states?.[0] ?? "",
            };
        }

        return NextResponse.json(normalized);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role;
        if (role !== UserRole.ADMIN && role !== UserRole.COORDINATOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await connectDB();
        const audit = await SavedZonalAudit.findById(id).lean();
        if (!audit) {
            return NextResponse.json({ error: "Zonal audit not found" }, { status: 404 });
        }

        if (role === UserRole.COORDINATOR) {
            const coordDoc = await Coordinator.findOne({ authId: session.user.id });
            if (!coordDoc || audit.coordinator?.toString() !== coordDoc._id.toString()) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }
        }

        await SavedZonalAudit.findByIdAndDelete(id);

        void logActivity({
            session,
            action: "DELETE_ZONAL_AUDIT",
            targetType: "SavedZonalAudit",
            targetId: id,
            targetName: `${audit.zoneName} – ${audit.month}`,
        });

        return NextResponse.json({ message: "Zonal audit deleted" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
