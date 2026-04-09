import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { SavedZonalAudit } from "@/models/SavedZonalAudit";
import { Coordinator } from "@/models/Coordinator";
import { DeskOfficer } from "@/models/DeskOfficer";
import { UserRole, getZoneForState, getStatesInZone } from "@/lib/constants";
import { logActivity } from "@/lib/activity-logger";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = {};

        if (session.user.role === UserRole.COORDINATOR) {
            if (!session.user.aiAccessEnabled) {
                return NextResponse.json({ error: "AI access is required to view zonal audits." }, { status: 403 });
            }
            const coordDoc = await Coordinator.findOne({ authId: session.user.id });
            if (!coordDoc) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            filter.coordinator = coordDoc._id;
        }

        if (session.user.role === UserRole.ZONAL_DESK_OFFICER) {
            const deskDoc = await DeskOfficer.findOne({ authId: session.user.id });
            if (!deskDoc || !deskDoc.states?.length) {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
            // Find audits whose zone covers any of the desk officer's states
            const zones = [...new Set(deskDoc.states.map(getZoneForState).filter(Boolean))];
            if (zones.length) {
                filter.zoneName = { $in: zones };
            } else {
                return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
            }
        }

        if (session.user.role === UserRole.MENTOR) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Admin, ME Officer, Team Research Lead — see all

        const [data, total] = await Promise.all([
            SavedZonalAudit.find(filter)
                .populate({
                    path: "coordinator",
                    populate: { path: "authId", select: "name email" },
                })
                .sort({ month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            SavedZonalAudit.countDocuments(filter),
        ]);

        const normalizedData = data.map((audit: any) => {
            const normalized: any = { ...audit };
            if (audit.coordinator?.authId) {
                normalized.coordinator = {
                    _id: audit.coordinator._id,
                    name: audit.coordinator.authId.name,
                    email: audit.coordinator.authId.email,
                    state: audit.coordinator.states?.[0] ?? "",
                };
            }
            return normalized;
        });

        return NextResponse.json({
            data: normalizedData,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role !== UserRole.COORDINATOR) {
            return NextResponse.json({ error: "Only Coordinators can save zonal audits." }, { status: 403 });
        }

        if (!session.user.aiAccessEnabled) {
            return NextResponse.json({ error: "AI access is required to save zonal audits." }, { status: 403 });
        }

        await connectDB();
        const body = await request.json();
        const { month, auditData } = body;

        if (!month || !auditData) {
            return NextResponse.json({ error: "month and auditData are required." }, { status: 400 });
        }

        const coordDoc = await Coordinator.findOne({ authId: session.user.id });
        if (!coordDoc) {
            return NextResponse.json({ error: "Coordinator profile not found." }, { status: 403 });
        }

        const zoneName = auditData.zoneName || getZoneForState(coordDoc.states?.[0]) || "Unknown Zone";

        // Upsert: update if already saved for this coordinator + month, otherwise create
        const saved = await SavedZonalAudit.findOneAndUpdate(
            { coordinator: coordDoc._id, month },
            { zoneName, auditData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        void logActivity({
            session,
            action: "SAVE_ZONAL_AUDIT",
            targetType: "SavedZonalAudit",
            targetId: saved._id.toString(),
            targetName: `${zoneName} – ${month}`,
        });

        return NextResponse.json(saved, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
