/* ──────────────────────────────────────────
   PDF Template: Weekly Mentorship Report
   Matches the NHF sample report format
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
import type { Report } from "@/lib/api-client";

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
    color: "#15803d",
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
    color: "#15803d",
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
        `Page ${pageNumber} of ${totalPages}  |  NHS Mentor Reporting System`
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

/* ── Main PDF Document ───────────────────────────── */
interface ReportPDFProps {
  report: Report;
}

export function WeeklyReportPDF({ report }: ReportPDFProps) {
  const mentorName = report.mentor?.name ?? "Mentor";
  const weekNum = report.weekNumber ?? report.weekKey;

  return (
    <Document
      title={`Week ${weekNum} Mentorship Sessions Report`}
      author={mentorName}
    >
      {/* ── Cover Page ──────────────────── */}
      <Page size="A4" style={s.page}>
        <Text style={s.coverTitle}>
          Week {weekNum} Mentorship Sessions Report
        </Text>
        <Text style={s.coverDate}>{fmtDate(report.weekEnding)}</Text>

        <View style={s.hr} />

        <View style={s.toBlock}>
          <Text style={s.label}>To:</Text>
          <Text>The Team Lead</Text>
          <Text>CWC Research</Text>
          <Text>NHF Mentorship Program</Text>
        </View>

        <Text style={s.bodyText}>Dear Team Lead,</Text>

        <Text style={s.bodyText}>
          I am pleased to submit the compiled mentorship reports for the fellows
          under my supervision. Below is the list of all fellows and the LGAs
          they represent:
        </Text>

        {/* Fellows list */}
        {report.fellows?.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            {report.fellows.map((f, i) => (
              <Text key={i} style={s.fellowItem}>
                {i + 1}. {f.name}{f.lga ? `, ${f.lga} LGA` : ""}
              </Text>
            ))}
          </View>
        )}

        {report.coverNote ? (
          <Text style={s.bodyText}>{report.coverNote}</Text>
        ) : (
          <Text style={s.bodyText}>
            These fellows have demonstrated commitment to public health service
            and meaningful community engagement across their respective LGAs.
            Their submissions reflect ongoing progress, identified challenges,
            solutions provided, and action plans aligned with the objectives of
            the National Health Fellowship Program.
          </Text>
        )}

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

      {/* ── Individual Session Pages ──── */}
      {report.sessions?.map((session, idx) => (
        <Page key={idx} size="A4" style={s.page}>
          <Text style={s.sessionHeader}>Mentorship Session Report</Text>
          <Text style={s.sessionWeek}>
            Mentorship Session Report for Week: {weekNum}
          </Text>

          <View style={s.hr} />

          <Field label="Name of Mentee/Fellow" value={session.menteeName} />
          <Field label="Date" value={fmtDate(session.sessionDate)} />
          <Field label="Time" value={`${session.startTime} - ${session.endTime}`} />
          <Field label="Duration" value={session.duration} />

          <View style={s.hr} />

          <Text style={s.sectionTitle}>Topic Discussed</Text>
          <Text style={s.bodyText}>{session.topicDiscussed}</Text>

          {session.challenges?.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Challenges Identified</Text>
              <BulletList items={session.challenges} />
            </>
          )}

          {session.solutions?.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Solutions Proffered</Text>
              <BulletList items={session.solutions} />
            </>
          )}

          {session.actionPlan?.length > 0 && (
            <>
              <Text style={s.sectionTitle}>Action Plan</Text>
              <BulletList items={session.actionPlan} />
            </>
          )}

          <Text style={s.mentorName}>Name of Mentor: {mentorName}</Text>

          <PageFooter />
        </Page>
      ))}
    </Document>
  );
}
