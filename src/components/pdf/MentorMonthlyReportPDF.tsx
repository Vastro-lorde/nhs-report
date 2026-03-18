/* ──────────────────────────────────────────
   PDF Template: Mentor Monthly Report
   Per-fellow progress report for NHF mentors
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
import type { MentorMonthlyReport } from "@/lib/api-client";
import { APP_NAME } from "@/lib/constants";

Font.register({
  family: "Helvetica",
  fonts: [
    { src: "Helvetica" },
    { src: "Helvetica-Bold", fontWeight: "bold" },
  ],
});

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 11,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 50,
    color: "#1a1a1a",
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
    color: "#555",
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: "#cccccc",
    marginVertical: 12,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 14,
    color: "#c2410c",
    textTransform: "uppercase",
  },
  fieldRow: {
    flexDirection: "row",
    marginBottom: 5,
    lineHeight: 1.4,
  },
  fieldLabel: {
    fontWeight: "bold",
    width: 170,
  },
  fieldValue: {
    flex: 1,
  },
  bodyText: {
    lineHeight: 1.6,
    marginBottom: 6,
    color: "#333",
  },
  bulletItem: {
    paddingLeft: 14,
    marginBottom: 3,
    lineHeight: 1.5,
  },
  noData: {
    color: "#999",
    fontStyle: "italic",
  },
  ratingBox: {
    marginTop: 4,
    padding: 6,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#ddd",
    alignSelf: "flex-start",
  },
  ratingText: {
    fontWeight: "bold",
    fontSize: 12,
  },
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

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={s.fieldRow}>
      <Text style={s.fieldLabel}>{label}:</Text>
      <Text style={s.fieldValue}>{value != null && value !== "" ? String(value) : "—"}</Text>
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  const filtered = (items ?? []).filter(i => i.trim());
  if (!filtered.length) return <Text style={s.noData}>None recorded.</Text>;
  return (
    <View>
      {filtered.map((item, i) => (
        <Text key={i} style={s.bulletItem}>{"- "}{item}</Text>
      ))}
    </View>
  );
}

function SummaryField({ label, value }: { label: string; value?: string }) {
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontWeight: "bold", marginBottom: 2 }}>{label}:</Text>
      {value?.trim() ? (
        <Text style={s.bodyText}>{value}</Text>
      ) : (
        <Text style={s.noData}>—</Text>
      )}
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

interface MentorMonthlyReportPDFProps {
  report: MentorMonthlyReport;
  mentorName?: string;
  monthLabel: string; // e.g. "March 2026"
}

export function MentorMonthlyReportPDF({ report, mentorName, monthLabel }: MentorMonthlyReportPDFProps) {
  const attendancePct =
    report.sessionsHeld > 0
      ? Math.round((report.sessionsAttended / report.sessionsHeld) * 100)
      : 0;

  return (
    <Document>
      <Page style={s.page}>
        <PageFooter />

        {/* Header */}
        <Text style={s.title}>Fellow Monthly Progress Report</Text>
        <Text style={s.subtitle}>{APP_NAME}</Text>
        <Text style={s.subtitle}>Reporting Period: {monthLabel}</Text>
        <View style={s.hr} />

        {/* Section 1 – Mentee Details */}
        <Text style={s.sectionHeader}>Section 1 – Mentee Details</Text>
        <Field label="Full Name" value={report.fellowName} />
        <Field label="LGA" value={report.fellowLGA} />
        <Field label="Qualification" value={report.fellowQualification} />
        {mentorName && <Field label="Mentor" value={mentorName} />}

        {/* Section 2 – Attendance */}
        <Text style={s.sectionHeader}>Section 2 – Attendance</Text>
        <Field label="Sessions Held" value={report.sessionsHeld} />
        <Field label="Sessions Attended" value={`${report.sessionsAttended} (${attendancePct}%)`} />
        <Field label="Sessions Absent" value={report.sessionsAbsent} />

        {/* Section 3 – Monthly Summary */}
        <Text style={s.sectionHeader}>Section 3 – Monthly Summary</Text>
        <SummaryField label="Learning / Courses Completed" value={report.summaryLearning} />
        <SummaryField label="PHC Visits / Community Engagements" value={report.summaryPhcVisits} />
        <SummaryField label="Activities & Outcomes" value={report.summaryActivities} />
        <SummaryField label="Fellow's Growth & Development" value={report.summaryGrowth} />
        <SummaryField label="Impact of Mentoring" value={report.summaryImpact} />

        {/* Section 4 – Key Challenges */}
        <Text style={s.sectionHeader}>Section 4 – Key Challenges</Text>
        <BulletList items={report.challenges} />

        {/* Section 5 – Recommendations */}
        <Text style={s.sectionHeader}>Section 5 – Mentor's Recommendations</Text>
        <BulletList items={report.recommendations} />

        {/* Section 6 – Progress Rating */}
        <Text style={s.sectionHeader}>Section 6 – Progress Rating</Text>
        {report.progressRating ? (
          <View style={s.ratingBox}>
            <Text style={s.ratingText}>{report.progressRating}</Text>
          </View>
        ) : (
          <Text style={s.noData}>Not rated.</Text>
        )}

        {/* Section 7 – Key Achievements */}
        <Text style={s.sectionHeader}>Section 7 – Key Achievements</Text>
        {report.achievements?.trim() ? (
          <Text style={s.bodyText}>{report.achievements}</Text>
        ) : (
          <Text style={s.noData}>None recorded.</Text>
        )}
      </Page>
    </Document>
  );
}
