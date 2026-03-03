/* ──────────────────────────────────────────
   API fetch wrapper (client-side)
   Single source of truth for all API calls
   ────────────────────────────────────────── */

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    if (typeof window !== "undefined" && (res.status === 401 || res.status === 403)) {
      window.location.href = "/unauthorized";
    }

    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error || "Request failed");
  }

  return res.json();
}

// ─── Dashboard ─────────────────────────────
export const api = {
  dashboard: {
    get: () => request<DashboardData>("/api/dashboard"),
  },

  mentors: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Mentor>>(`/api/mentors?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Mentor>(`/api/mentors/${id}`),
    create: (data: CreateMentorInput) =>
      request<Mentor>("/api/mentors", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Mentor>) =>
      request<Mentor>(`/api/mentors/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/mentors/${id}`, { method: "DELETE" }),
    bulkCreate: (data: { mentors: BulkMentorInput[] }) =>
      request<{ successful: number; failed: number; errors: string[] }>("/api/mentors/bulk", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/mentors/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/mentors/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  coordinators: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Coordinator>>(`/api/coordinators?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Coordinator>(`/api/coordinators/${id}`),
    create: (data: CreateCoordinatorInput) =>
      request<Coordinator>("/api/coordinators", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Coordinator>) =>
      request<Coordinator>(`/api/coordinators/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/coordinators/${id}`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/coordinators/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/coordinators/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  reports: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Report>>(`/api/reports?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Report>(`/api/reports/${id}`),
    create: (data: CreateReportInput) =>
      request<Report>("/api/reports", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Report>) =>
      request<Report>(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

    monthly: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<MonthlyReport>>(`/api/reports/monthly?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<MonthlyReport>(`/api/reports/monthly/${id}`),
      create: (data: CreateMonthlyReportInput) =>
        request<MonthlyReport>("/api/reports/monthly", { method: "POST", body: JSON.stringify(data) }),
    }
  },

  alerts: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<AlertItem>>(`/api/alerts?${new URLSearchParams(params).toString()}`),
    update: (id: string, data: { status?: string; notes?: string }) =>
      request<AlertItem>(`/api/alerts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  rollups: {
    list: () => request<RollupItem[]>("/api/rollups"),
    get: (weekKey: string) => request<RollupItem>(`/api/rollups?weekKey=${weekKey}`),
  },

  fellows: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Fellow>>(`/api/fellows?${new URLSearchParams(params).toString()}`),
    create: (data: CreateFellowInput) =>
      request<Fellow>("/api/fellows", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Fellow>) =>
      request<Fellow>(`/api/fellows/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/api/fellows/${id}`, { method: "DELETE" }),
    documents: {
      list: (fellowId: string) =>
        request<FellowDocument[]>(`/api/fellows/${fellowId}/documents`),
      upload: (fellowId: string, data: { documents: UploadFellowDocumentInput[] }) =>
        request<FellowDocument[]>(`/api/fellows/${fellowId}/documents`, { method: "POST", body: JSON.stringify(data) }),
    },
    bulkCreate: (data: { fellows: BulkFellowInput[] }) =>
      request<{ successful: number; failed: number; errors: string[] }>("/api/fellows/bulk", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/fellows/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  upload: {
    file: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new ApiError(res.status, body.error);
      }
      return res.json() as Promise<{ url: string; publicId: string }>;
    },
  },

  documentTypes: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<DocumentType>>(`/api/document-types?${new URLSearchParams(params).toString()}`),
    create: (data: CreateDocumentTypeInput) =>
      request<DocumentType>("/api/document-types", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: UpdateDocumentTypeInput) =>
      request<DocumentType>(`/api/document-types/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request(`/api/document-types/${id}`, { method: "DELETE" }),
  },
};

// ─── Types ──────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Mentor {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  state?: string;
  lgas: string[];
  active: boolean;
  createdAt: string;
}

export interface CreateMentorInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  state?: string;
  lgas?: string[];
}

export interface BulkMentorInput {
  name: string;
  email: string;
  phone?: string;
  state?: string;
  lgas?: string;
}

export interface Coordinator {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  states: string[];
  active: boolean;
  createdAt: string;
}

export interface CreateCoordinatorInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  states?: string[];
}

export interface Fellow {
  _id: string;
  mentor: string;
  name: string;
  gender: string;
  lga: string;
  createdAt: string;
}

export interface CreateFellowInput {
  name: string;
  gender: string;
  lga: string;
}

export interface BulkFellowInput {
  name: string;
  state: string;
  lga: string;
  phone: string;
  gender: string;
  mentorId: string;
}

export interface FellowDocument {
  _id: string;
  fellow: string;
  documentType: { _id: string; title: string } | string;
  url: string;
  createdAt: string;
}

export interface UploadFellowDocumentInput {
  documentTypeId: string;
  url: string;
}

export interface MentorshipSessionInput {
  menteeName: string;
  menteeLGA?: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  duration: string;
  topicDiscussed: string;
  challenges: string[];
  solutions: string[];
  actionPlan: string[];
}

export interface Report {
  _id: string;
  mentor: { _id: string; name: string; email: string; state?: string };
  weekEnding: string;
  weekNumber: number;
  weekKey: string;
  coverNote?: string;
  fellows: { name: string; lga: string }[];
  sessions: (MentorshipSessionInput & { _id?: string })[];
  sessionsCount: number;
  menteesCheckedIn: number;
  outreachActivities: string[];
  outreachDescription?: string;
  keyWins?: string;
  challenges: string[];
  challengeDescription?: string;
  urgentAlert: boolean;
  urgentDetails?: string;
  supportNeeded?: string;
  evidenceUrls: string[];
  status: string;
  dataQualityFlags: string[];
  state: string;
  createdAt: string;
  /** Convenience — populated from mentor.name or virtual */
  mentorName?: string;
}

export interface CreateReportInput {
  weekEnding: string;
  weekNumber?: number;
  coverNote?: string;
  fellows?: { name: string; lga: string }[];
  sessions?: MentorshipSessionInput[];
  sessionsCount: number;
  menteesCheckedIn: number;
  outreachActivities: string[];
  outreachDescription?: string;
  keyWins?: string;
  challenges: string[];
  challengeDescription?: string;
  urgentAlert: boolean;
  urgentDetails?: string;
  supportNeeded?: string;
  evidenceUrls?: string[];
}

export interface AlertItem {
  _id: string;
  mentor: { _id: string; name: string; email: string; state?: string };
  weekKey: string;
  state: string;
  urgentDetails: string;
  status: string;
  notes?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  /** Convenience — populated from mentor.name */
  mentorName?: string;
}

export interface RollupItem {
  _id: string;
  weekKey: string;
  reportsSubmitted: number;
  expectedReports: number;
  submissionRate: number;
  totalSessions: number;
  totalCheckins: number;
  urgentAlertsCount: number;
  topChallenges: { name: string; count: number }[];
  topStates: { name: string; count: number }[];
}

export interface DashboardData {
  currentWeekKey: string;
  totalMentors: number;
  activeMentors: number;
  reportsThisWeek: number;
  openAlerts: number;
  submissionRate: number;
  rollups: RollupItem[];
  submissionsByState: {
    _id: string | { state: string; weekKey: string };
    count: number;
    sessions?: number;
    checkins?: number;
  }[];
}

export interface MonthlyReport {
  _id: string;
  coordinator: { _id: string; name: string; email: string; state: string };
  state: string;
  month: string;
  summaryText: string;
  weeklyReports: Report[];
  status: string;
  createdAt: string;
}

export interface CreateMonthlyReportInput {
  month: string;
  summaryText: string;
}

export interface DocumentType {
  _id: string;
  title: string;
  createdAt: string;
}

export interface CreateDocumentTypeInput {
  title: string;
}

export interface UpdateDocumentTypeInput {
  title: string;
}
