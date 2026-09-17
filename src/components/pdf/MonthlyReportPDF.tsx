/* ──────────────────────────────────────────
   PDF Template: Monthly Mentorship Report
   Aggregates multiple weekly reports
   ────────────────────────────────────────── */
"use client";

import {
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    Font,
} from "@react-pdf/renderer";
import type { Report, MentorshipSessionInput as Session } from "@/lib/api-client";
import { APP_NAME, TEAM_LEAD_NAME } from "@/lib/constants";
import { weekRangeLabelFromWeekKey } from "@/lib/date-helpers";
import { sessionTopicLabel } from "@/lib/report-season";
import type { IZonalAuditReport } from "@/types/zonal-audit";

/* ── Register a clean font (Helvetica built-in) ─── */
Font.register({
    family: "Helvetica",
    fonts: [
        { src: "Helvetica" },
        { src: "Helvetica-Bold", fontWeight: "bold" },
    ],
});

/* ── Styles ──────────────────────────────────────── */
const s = StyleSheet.create({
    page: {
        fontFamily: "Helvetica",
        fontSize: 11,
        paddingTop: 40,
        paddingBottom: 50,
        paddingHorizontal: 50,
        color: "#1a1a1a",
    },
    // Cover page
    coverTitle: {
        fontSize: 16,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 4,
        textTransform: "uppercase",
    },
    coverDate: {
        fontSize: 11,
        textAlign: "center",
        marginBottom: 20,
        color: "#555",
    },
    hr: {
        borderBottomWidth: 1,
        borderBottomColor: "#cccccc",
        marginVertical: 12,
    },
    toBlock: {
        marginBottom: 14,
        lineHeight: 1.5,
    },
    label: {
        fontWeight: "bold",
        marginBottom: 2,
    },
    bodyText: {
        lineHeight: 1.6,
        marginBottom: 8,
    },
    fellowItem: {
        lineHeight: 1.5,
        paddingLeft: 12,
    },
    signOff: {
        marginTop: 20,
        lineHeight: 1.5,
    },

    // Session pages
    sessionHeader: {
        fontSize: 14,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 16,
        color: "#c2410c",
    },
    sessionWeek: {
        fontSize: 12,
        fontWeight: "bold",
        marginBottom: 10,
    },
    fieldRow: {
        flexDirection: "row",
        marginBottom: 4,
        lineHeight: 1.4,
    },
    fieldLabel: {
        fontWeight: "bold",
        width: 160,
    },
    fieldValue: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: "bold",
        marginTop: 12,
        marginBottom: 4,
        color: "#c2410c",
    },
    bulletItem: {
        paddingLeft: 14,
        marginBottom: 3,
        lineHeight: 1.5,
    },
    mentorName: {
        marginTop: 16,
        fontWeight: "bold",
    },

    // Footer
    footer: {
        position: "absolute",
        bottom: 30,
        left: 50,
        right: 50,
        textAlign: "center",
        fontSize: 8,
        color: "#999",
    },
});

/* ── Helper components ───────────────────────────── */
function Field({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.fieldRow}>
            <Text style={s.fieldLabel}>{label}:</Text>
            <Text style={s.fieldValue}>{value}</Text>
        </View>
    );
}

function BulletList({ items }: { items: string[] }) {
    if (!items || items.length === 0) return null;
    return (
        <View>
            {items.map((item, i) => (
                <Text key={i} style={s.bulletItem}>
                    {"- "}{item}
                </Text>
            ))}
        </View>
    );
}

function PageFooter() {
    return (
        <Text
            style={s.footer}
            render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}  |  ${APP_NAME}`
            }
            fixed
        />
    );
}

/* ── Format date for display ─────────────────────── */
function fmtDate(d: string | Date): string {
    const date = new Date(d);
    return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function removeDuplicates<T>(arr: T[], keyFn: (item: T) => string): T[] {
    const seen = new Set<string>();
    return arr.filter((item) => {
        const k = keyFn(item);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

/* ── Main PDF Document ───────────────────────────── */
interface MonthlyReportPDFProps {
    reports: Report[];
    monthLabel: string; // e.g. "February 2026"
    zonalAuditData?: IZonalAuditReport | null;
}

export function MonthlyReportPDF({ reports, monthLabel, zonalAuditData }: MonthlyReportPDFProps) {
    if ((!reports || reports.length === 0) && !zonalAuditData) {
        return (
            <Document>
                <Page style={s.page}>
                    <Text>No reports selected.</Text>
                </Page>
            </Document>
        )
    }

    const hasReports = reports && reports.length > 0;

    // Aggregate info (only when reports exist)
    const mentorName = hasReports
        ? (reports[0]?.mentorName ??
           reports[0]?.mentor?.name ??
           ((reports[0]?.mentor as any)?.authId?.name as string | undefined) ??
           "Mentor")
        : "Mentor";

    const allFellows = hasReports ? reports.flatMap(r => r.fellows || []) : [];
    const uniqueFellows = removeDuplicates(allFellows, (f) => f.name.toLowerCase().trim());

    // Each session keeps its own report's season so a month that straddles the
    // regular → capstone switch labels every session correctly.
    const allSessions: { session: Session, weekKey: string, season?: Report["season"] }[] = hasReports
        ? reports.flatMap(r =>
              (r.sessions || []).map(s => ({ session: s, weekKey: r.weekKey, season: r.season }))
          ).sort((a, b) => new Date(a.session.sessionDate).getTime() - new Date(b.session.sessionDate).getTime())
        : [];

    return (
        <Document
            title={`Monthly Mentorship Report - ${monthLabel}`}
            author={mentorName}
        >
            {/* ── Cover Page ──────────────────── */}
            {hasReports && (
            <Page size="A4" style={s.page}>
                <Text style={s.coverTitle}>
                    Monthly Mentorship Sessions Report
                </Text>
                <Text style={s.coverDate}>{monthLabel}</Text>

                <View style={s.hr} />

                <View style={s.toBlock}>
                    <Text style={s.label}>To:</Text>
                    <Text>The Team Lead</Text>
                    <Text>CWC Research</Text>
                    <Text>NHF Mentorship Program</Text>
                </View>

                <Text style={s.bodyText}>Dear Team Lead,</Text>

                <Text style={s.bodyText}>
                    I am pleased to submit the compiled monthly mentorship report for the fellows
                    under my supervision for {monthLabel}. Below is the aggregated list of fellows and the LGAs
                    they represent across the associated weekly reports:
                </Text>

                {/* Fellows list */}
                {uniqueFellows.length > 0 && (
                    <View style={{ marginBottom: 12 }}>
                        {uniqueFellows.map((f, i) => (
                            <Text key={i} style={s.fellowItem}>
                                {i + 1}. {f.name}{f.lga ? `, ${f.lga} LGA` : ""}
                            </Text>
                        ))}
                    </View>
                )}

                <Text style={s.bodyText}>
                    This monthly digest covers {reports.length} weekly report(s) and {allSessions.length} total mentorship session(s).
                    These fellows have demonstrated commitment to public health service
                    and meaningful community engagement across their respective LGAs.
                    Their submissions reflect ongoing progress, identified challenges,
                    solutions provided, and action plans aligned with the objectives of
                    the National Health Fellowship Program.
                </Text>

                <Text style={s.bodyText}>
                    Thank you for your continued support and leadership.
                </Text>

                <View style={s.signOff}>
                    <Text>Sincerely,</Text>
                    <Text style={{ fontWeight: "bold", marginTop: 6 }}>
                        {mentorName}
                    </Text>
                    <Text>Mentor, National Health Fellows Mentorship Program</Text>
                </View>

                <PageFooter />
            </Page>
            )}

            {/* ── Individual Session Pages ──── */}
            {hasReports && allSessions.map(({ session, weekKey, season }, idx) => (
                <Page key={idx} size="A4" style={s.page}>
                    <Text style={s.sessionHeader}>Mentorship Session Report</Text>
                    <Text style={s.sessionWeek}>
                        Mentorship Session from Week: {weekRangeLabelFromWeekKey(weekKey)}
                    </Text>

                    <View style={s.hr} />

                    <Field label="Name of Mentee/Fellow" value={session.menteeName} />
                    <Field label="Date" value={fmtDate(session.sessionDate)} />
                    <Field label="Time" value={`${session.startTime} - ${session.endTime}`} />
                    <Field label="Duration" value={session.duration} />

                    <View style={s.hr} />

                    <Text style={s.sectionTitle}>{sessionTopicLabel(season)}</Text>
                    <Text style={s.bodyText}>{session.topicDiscussed}</Text>

                    {session.challenges && session.challenges.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Challenges Identified</Text>
                            <BulletList items={session.challenges} />
                        </>
                    )}

                    {session.solutions && session.solutions.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Solutions Proffered</Text>
                            <BulletList items={session.solutions} />
                        </>
                    )}

                    {session.actionPlan && session.actionPlan.length > 0 && (
                        <>
                            <Text style={s.sectionTitle}>Action Plan</Text>
                            <BulletList items={session.actionPlan} />
                        </>
                    )}

                    <Text style={s.mentorName}>Name of Mentor: {mentorName}</Text>

                    <PageFooter />
                </Page>
            ))}

            {/* ── Zonal Audit Pages (AI-generated) ── */}
            {zonalAuditData && (
                <>
                    {/* Title Page */}
                    <Page size="A4" style={s.page}>
                        <Text style={s.coverTitle}>
                            Zonal Performance Audit Report
                        </Text>
                        <Text style={s.coverDate}>
                            {zonalAuditData.zoneName} — {zonalAuditData.reportingPeriod}
                        </Text>

                        <View style={s.hr} />

                        <View style={s.toBlock}>
                            <Text style={s.label}>To:</Text>
                            <Text>{TEAM_LEAD_NAME}</Text>
                            <Text>Team Research Lead</Text>
                            <Text>NHF Mentorship Program</Text>
                        </View>

                        <Text style={s.bodyText}>
                            This AI-generated zonal performance audit covers {zonalAuditData.totalLGAs} LGA(s)
                            and {zonalAuditData.activeFellows} active fellow(s) for the reporting period.
                        </Text>

                        <View style={s.hr} />

                        {/* Section 1: State Executive Briefs */}
                        <Text style={s.sectionTitle}>Section 1: State Executive Briefs</Text>
                        {zonalAuditData.stateExecutiveBriefs?.map((seb, i) => (
                            <View key={i} style={{ marginBottom: 10 }}>
                                <Text style={{ fontWeight: "bold", marginBottom: 2 }}>{seb.stateName}</Text>
                                <Text style={s.bodyText}>{seb.brief}</Text>
                            </View>
                        ))}

                        <PageFooter />
                    </Page>

                    {/* Leadership Board Page */}
                    <Page size="A4" style={s.page}>
                        <Text style={s.sessionHeader}>Section 2: Zonal Leadership Board</Text>

                        <Text style={s.sectionTitle}>Top Performing LGAs</Text>
                        {zonalAuditData.zonalLeadershipBoard?.topLGAs?.map((entry, i) => (
                            <View key={i} style={s.fieldRow}>
                                <Text style={{ width: 30 }}>#{entry.rank}</Text>
                                <Text style={{ flex: 1 }}>{entry.lgaName} ({entry.state})</Text>
                                <Text style={{ width: 80, textAlign: "right" }}>{entry.kpi}</Text>
                            </View>
                        ))}

                        <View style={s.hr} />

                        <Text style={s.sectionTitle}>Bottom LGAs (Areas for Improvement)</Text>
                        {zonalAuditData.zonalLeadershipBoard?.bottomLGAs?.map((entry, i) => (
                            <View key={i} style={s.fieldRow}>
                                <Text style={{ width: 30 }}>#{entry.rank}</Text>
                                <Text style={{ flex: 1 }}>{entry.lgaName} ({entry.state})</Text>
                                <Text style={{ width: 140, textAlign: "right", fontSize: 9 }}>{entry.areaForImprovement}</Text>
                            </View>
                        ))}

                        <PageFooter />
                    </Page>

                    {/* Operational Insights & Recommendations Page */}
                    <Page size="A4" style={s.page}>
                        <Text style={s.sessionHeader}>Section 3: Operational Insights &amp; Problem Solving</Text>

                        <Text style={s.sectionTitle}>Progress of Zone</Text>
                        <Text style={s.bodyText}>{zonalAuditData.operationalInsights?.progressOfZone}</Text>

                        {zonalAuditData.operationalInsights?.challengesIdentified?.length > 0 && (
                            <>
                                <Text style={s.sectionTitle}>Challenges Identified</Text>
                                <BulletList items={zonalAuditData.operationalInsights.challengesIdentified} />
                            </>
                        )}

                        {zonalAuditData.operationalInsights?.solutionsProffered && (
                            <>
                                <Text style={s.sectionTitle}>Solutions Proffered</Text>
                                <Text style={s.bodyText}>{zonalAuditData.operationalInsights.solutionsProffered}</Text>
                            </>
                        )}

                        <View style={s.hr} />

                        <Text style={s.sessionHeader}>Section 4: Strategic Recommendations</Text>

                        <Text style={s.sectionTitle}>Zonal Coordinator&apos;s Recommendation</Text>
                        <Text style={s.bodyText}>{zonalAuditData.strategicRecommendations?.coordinatorDirective}</Text>

                        <Text style={s.sectionTitle}>Zonal Coordinator&apos;s Commendation</Text>
                        <Text style={s.bodyText}>{zonalAuditData.strategicRecommendations?.teamLeadCommendation}</Text>

                        <PageFooter />
                    </Page>
                </>
            )}
        </Document>
    );
}
