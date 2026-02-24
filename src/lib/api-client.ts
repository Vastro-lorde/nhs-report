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
  },

  reports: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Report>>(`/api/reports?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Report>(`/api/reports/${id}`),
    create: (data: CreateReportInput) =>
      request<Report>("/api/reports", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Report>) =>
      request<Report>(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
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
