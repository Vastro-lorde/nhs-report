/* ──────────────────────────────────────────
   Single Report Detail Page
   ────────────────────────────────────────── */
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { api, type Report, type ReportComment } from "@/lib/api-client";
import { format } from "date-fns";
import { ArrowLeft, FileDown, Pencil, Send, MessageSquare, Trash2, History } from "lucide-react";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/constants";
import { weekRangeLabelFromDate } from "@/lib/date-helpers";
import Link from "next/link";
import dynamic from "next/dynamic";

const PDFDownloadButton = dynamic(
  () => import("@/components/pdf/PDFDownloadButton").then((m) => m.PDFDownloadButton),
  { ssr: false, loading: () => <span className="text-xs text-gray-400">…</span> }
);

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState("");

  const canComment =
    session?.user &&
    (session.user.role === UserRole.COORDINATOR ||
      session.user.role === UserRole.MENTOR ||
      session.user.role === UserRole.ADMIN);

  const canDelete =
    session?.user &&
    (session.user.role === UserRole.ADMIN ||
      session.user.role === UserRole.COORDINATOR);

  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this weekly report? This action cannot be undone.")) return;
    try {
      await api.reports.delete(id);
      router.push("/reports");
    } catch (err: any) {
      alert(`Failed to delete: ${err.message}`);
    }
  };

  const loadComments = useCallback(
    (reportId: string) => {
      api.reports.comments.list(reportId).then(setComments).catch(() => {});
    },
    []
  );

  useEffect(() => {
    if (!id) return;
    api.reports
      .get(id)
      .then((r) => {
        setReport(r);
        loadComments(id);
      })
      .catch(() => router.push("/reports"))
      .finally(() => setLoading(false));
  }, [id, router, loadComments]);

  const handleAddComment = async () => {
    if (!id || !commentBody.trim()) return;
    setCommentLoading(true);
    setCommentError("");
    try {
      const added = await api.reports.comments.add(id, commentBody.trim());
      setComments((prev) => [...prev, added]);
      setCommentBody("");
    } catch {
      setCommentError("Failed to post comment. Please try again.");
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading…
      </div>
    );

  if (!report) return null;

  return (
    <>
      <Header
        title={`Report — ${weekRangeLabelFromDate(report.weekEnding)}`}
        subtitle={`${report.mentorName ?? "Mentor"} • ${report.state}`}
      />

      <div className="p-6 max-w-4xl space-y-6">
        {/* Actions bar */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <PDFDownloadButton report={report} size="sm">
            <FileDown className="h-4 w-4 mr-1" /> Download PDF
          </PDFDownloadButton>
          {/* Edit — for the owning mentor, their coordinator, or admin */}
          {session?.user &&
            (session.user.role === UserRole.MENTOR ||
              session.user.role === UserRole.COORDINATOR ||
              session.user.role === UserRole.ADMIN) && (
              <Link href={`/reports/${report._id}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              </Link>
            )}
          <Link href={`/reports/${report._id}/history`}>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-1" /> Report History
            </Button>
          </Link>
          {canDelete && (
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          )}
          <Badge>{report.status}</Badge>
        </div>

        {/* Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Report Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <dt className="text-gray-500">Week</dt>
                <dd className="font-medium">{weekRangeLabelFromDate(report.weekEnding)}</dd>
              </div>
              {report.weekNumber && (
                <div>
                  <dt className="text-gray-500">Week Number</dt>
                  <dd className="font-medium">{report.weekNumber}</dd>
                </div>
              )}
              <div>
                <dt className="text-gray-500">Sessions</dt>
                <dd className="font-medium">{report.sessionsCount}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Mentees</dt>
                <dd className="font-medium">{report.menteesCheckedIn}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Submitted</dt>
                <dd className="font-medium">
                  {format(new Date(report.createdAt), "MMM d, yyyy hh:mm a")}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Urgent Alert</dt>
                <dd className="font-medium">
                  {report.urgentAlert ? (
                    <Badge variant="destructive">Yes</Badge>
                  ) : (
                    "No"
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Cover Note */}
        {report.coverNote && (
          <Card>
            <CardHeader>
              <CardTitle>Cover Note</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{report.coverNote}</p>
            </CardContent>
          </Card>
        )}

        {/* Fellows */}
        {report.fellows && report.fellows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Fellows Under Supervision</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1 list-disc list-inside">
                {report.fellows.map((f, i) => (
                  <li key={i}>
                    {f.name}
                    {f.lga ? ` — ${f.lga}` : ""}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Sessions */}
        {report.sessions && report.sessions.length > 0 && (
          <>
            <h2 className="text-lg font-semibold mt-4">
              Mentorship Sessions ({report.sessions.length})
            </h2>
            {report.sessions.map((s, i) => (
              <Card key={i}>
                <CardHeader>
                  <CardTitle>
                    Session {i + 1}: {s.menteeName}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-4">
                    {s.menteeLGA && (
                      <div>
                        <dt className="text-gray-500">LGA</dt>
                        <dd className="font-medium">{s.menteeLGA}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-gray-500">Date</dt>
                      <dd className="font-medium">
                        {s.sessionDate
                          ? format(new Date(s.sessionDate), "MMM d, yyyy")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Time</dt>
                      <dd className="font-medium">
                        {s.startTime} – {s.endTime}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Duration</dt>
                      <dd className="font-medium">{s.duration}</dd>
                    </div>
                  </dl>

                  <div className="space-y-3 text-sm">
                    <div>
                      <h4 className="font-medium text-gray-700">Topic Discussed</h4>
                      <p className="mt-1 whitespace-pre-wrap">{s.topicDiscussed}</p>
                    </div>

                    {s.challenges?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700">Challenges</h4>
                        <ul className="list-disc list-inside mt-1">
                          {s.challenges.map((c, ci) => (
                            <li key={ci}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.solutions?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700">Solutions Proffered</h4>
                        <ul className="list-disc list-inside mt-1">
                          {s.solutions.map((s2, si) => (
                            <li key={si}>{s2}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {s.actionPlan?.length > 0 && (
                      <div>
                        <h4 className="font-medium text-gray-700">Action Plan</h4>
                        <ul className="list-disc list-inside mt-1">
                          {s.actionPlan.map((a, ai) => (
                            <li key={ai}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        )}

        {/* Summary fields */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {report.outreachActivities?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Outreach Activities</h4>
                  <div className="flex flex-wrap gap-2">
                    {report.outreachActivities.map((a) => (
                      <Badge key={a} variant="secondary">
                        {a}
                      </Badge>
                    ))}
                  </div>
                  {report.outreachDescription && (
                    <p className="mt-2 whitespace-pre-wrap text-gray-600">
                      {report.outreachDescription}
                    </p>
                  )}
                </div>
              )}

              {report.challenges?.length > 0 && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Challenges</h4>
                  <div className="flex flex-wrap gap-2">
                    {report.challenges.map((c) => (
                      <Badge key={c} variant="warning">
                        {c}
                      </Badge>
                    ))}
                  </div>
                  {report.challengeDescription && (
                    <p className="mt-2 whitespace-pre-wrap text-gray-600">
                      {report.challengeDescription}
                    </p>
                  )}
                </div>
              )}

              {report.keyWins && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Key Wins</h4>
                  <p className="whitespace-pre-wrap">{report.keyWins}</p>
                </div>
              )}

              {report.supportNeeded && (
                <div>
                  <h4 className="font-medium text-gray-700 mb-1">Support Needed</h4>
                  <p className="whitespace-pre-wrap">{report.supportNeeded}</p>
                </div>
              )}

              {report.urgentAlert && report.urgentDetails && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-700 mb-1">⚠ Urgent Alert</h4>
                  <p className="whitespace-pre-wrap text-red-700">{report.urgentDetails}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Evidence */}
        {report.evidenceUrls?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Evidence / Attachments</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {report.evidenceUrls.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Attachment {i + 1} — {url.split("/").pop()}
                    </a>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {/* Comments / Conversation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> Comments
              {comments.length > 0 && (
                <Badge variant="secondary">{comments.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {comments.length === 0 && (
              <p className="text-sm text-gray-400">No comments yet.</p>
            )}

            {comments.length > 0 && (
              <div className="space-y-4 mb-6">
                {comments.map((c) => (
                  <div
                    key={c._id}
                    className="rounded-lg border border-gray-200 p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{c.authorName}</span>
                      <Badge variant="secondary" className="text-xs">
                        {c.authorRole}
                      </Badge>
                      <span className="text-gray-400 text-xs ml-auto">
                        {format(new Date(c.createdAt), "MMM d, yyyy hh:mm a")}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-gray-700">{c.body}</p>
                  </div>
                ))}
              </div>
            )}

            {canComment && (
              <div className="space-y-2">
                {commentError && (
                  <p className="text-sm text-red-600">{commentError}</p>
                )}
                <div className="flex gap-2">
                  <textarea
                    className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2}
                    placeholder="Write a comment…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        handleAddComment();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    disabled={commentLoading || !commentBody.trim()}
                    onClick={handleAddComment}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
