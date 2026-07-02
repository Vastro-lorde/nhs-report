/* ──────────────────────────────────────────
   API fetch wrapper (client-side)
   Single source of truth for all API calls
   ────────────────────────────────────────── */

import type { ReportHistoryReportType, ReportHistoryAction } from "@/lib/constants";
import type { IZonalAuditReport } from "@/types/zonal-audit";
import type {
  INationalAuditReport,
  INationalAuditPeriodReport,
  IPeriodicCoverage,
  NationalAuditPeriodType,
} from "@/types/national-audit";

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
    get: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request<DashboardData>(`/api/dashboard${qs}`);
    },
  },

  analytics: {
    get: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request<AnalyticsData>(`/api/analytics${qs}`);
    },
  },

  admins: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Admin>>(`/api/admins?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Admin>(`/api/admins/${id}`),
    create: (data: CreateAdminInput) =>
      request<Admin>("/api/admins", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Admin>) =>
      request<Admin>(`/api/admins/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/admins/${id}`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/admins/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number; message?: string }>("/api/admins/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
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
    permanentDelete: (id: string) =>
      request(`/api/mentors/${id}?permanent=true`, { method: "DELETE" }),
    reassign: (id: string, coordinatorId: string) =>
      request<Mentor>(`/api/mentors/${id}`, { method: "PATCH", body: JSON.stringify({ coordinatorId }) }),
    bulkCreate: (data: { mentors: BulkMentorInput[]; coordinatorId?: string }) =>
      request<{ successful: number; failed: number; errors: string[] }>("/api/mentors/bulk", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/mentors/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    changeEmail: (id: string, newEmail: string) =>
      request<{ success: boolean; message: string }>(`/api/mentors/${id}/change-email`, {
        method: "POST",
        body: JSON.stringify({ email: newEmail }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/mentors/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
    sendReminders: () =>
      request<{ weekKey: string; totalMentors: number; remindersSent: number; message: string; errors: string[] }>(
        "/api/mentors/remind",
        { method: "POST" },
      ),
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
    permanentDelete: (id: string) =>
      request(`/api/coordinators/${id}?permanent=true`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/coordinators/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    changeEmail: (id: string, newEmail: string) =>
      request<{ success: boolean; message: string }>(`/api/coordinators/${id}/change-email`, {
        method: "POST",
        body: JSON.stringify({ email: newEmail }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/coordinators/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  deskOfficers: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<DeskOfficer>>(`/api/desk-officers?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<DeskOfficer>(`/api/desk-officers/${id}`),
    create: (data: CreateDeskOfficerInput) =>
      request<DeskOfficer>("/api/desk-officers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<DeskOfficer>) =>
      request<DeskOfficer>(`/api/desk-officers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/desk-officers/${id}`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/desk-officers/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/desk-officers/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  meOfficers: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<MEOfficer>>(`/api/me-officers?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<MEOfficer>(`/api/me-officers/${id}`),
    create: (data: CreateMEOfficerInput) =>
      request<MEOfficer>("/api/me-officers", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<MEOfficer>) =>
      request<MEOfficer>(`/api/me-officers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/me-officers/${id}`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/me-officers/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/me-officers/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  teamResearchLeads: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<TeamResearchLead>>(`/api/team-research-leads?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<TeamResearchLead>(`/api/team-research-leads/${id}`),
    create: (data: CreateTeamResearchLeadInput) =>
      request<TeamResearchLead>("/api/team-research-leads", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<TeamResearchLead>) =>
      request<TeamResearchLead>(`/api/team-research-leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deactivate: (id: string) =>
      request(`/api/team-research-leads/${id}`, { method: "DELETE" }),
    resetPassword: (id: string, newPassword: string) =>
      request<{ success: boolean; message: string }>(`/api/team-research-leads/${id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ password: newPassword }),
      }),
    bulkDelete: (data: { ids: string[] }) =>
      request<{ success: boolean; deletedCount: number }>("/api/team-research-leads/bulk", {
        method: "DELETE",
        body: JSON.stringify(data),
      }),
  },

  reports: {
    list: (params?: URLSearchParams | Record<string, string>) =>
      request<PaginatedResponse<Report>>(`/api/reports?${new URLSearchParams(params).toString()}`),
    get: (id: string) => request<Report>(`/api/reports/${id}`, { cache: "no-store" }),
    create: (data: CreateReportInput) =>
      request<Report>("/api/reports", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Report>) =>
      request<Report>(`/api/reports/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ message: string }>(`/api/reports/${id}`, { method: "DELETE" }),
    checkCurrentWeek: () =>
      request<{ hasReport: boolean }>("/api/reports/check-current-week"),
    history: (id: string) =>
      request<ReportHistoryEntry[]>(`/api/reports/${id}/history`),

    comments: {
      list: (reportId: string) =>
        request<ReportComment[]>(`/api/reports/${reportId}/comments`),
      add: (reportId: string, body: string) =>
        request<ReportComment>(`/api/reports/${reportId}/comments`, {
          method: "POST",
          body: JSON.stringify({ body }),
        }),
    },

    monthly: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<MonthlyReport>>(`/api/reports/monthly?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<MonthlyReport>(`/api/reports/monthly/${id}`),
      create: (data: CreateMonthlyReportInput) =>
        request<MonthlyReport>("/api/reports/monthly", { method: "POST", body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ message: string }>(`/api/reports/monthly/${id}`, { method: "DELETE" }),
      generateAI: (data: { month: string }) =>
        request<IZonalAuditReport>("/api/reports/monthly/generate-ai", { method: "POST", body: JSON.stringify(data) }),
    },

    fellowMonthly: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<MentorMonthlyReport>>(`/api/reports/fellow-monthly?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<MentorMonthlyReport>(`/api/reports/fellow-monthly/${id}`, { cache: "no-store" }),
      create: (data: CreateMentorMonthlyReportInput) =>
        request<MentorMonthlyReport>("/api/reports/fellow-monthly", { method: "POST", body: JSON.stringify(data) }),
      update: (id: string, data: Partial<CreateMentorMonthlyReportInput>) =>
        request<MentorMonthlyReport>(`/api/reports/fellow-monthly/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ success: boolean }>(`/api/reports/fellow-monthly/${id}`, { method: "DELETE" }),
      history: (id: string) =>
        request<ReportHistoryEntry[]>(`/api/reports/fellow-monthly/${id}/history`),
      prefill: (fellowId: string, month: string) =>
        request<MentorMonthlyReportPrefill>(`/api/reports/fellow-monthly/prefill?fellowId=${fellowId}&month=${encodeURIComponent(month)}`),
    },

    zonalAudits: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<SavedZonalAudit>>(`/api/reports/zonal-audits?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<SavedZonalAudit>(`/api/reports/zonal-audits/${id}`, { cache: "no-store" }),
      save: (data: CreateSavedZonalAuditInput) =>
        request<SavedZonalAudit>("/api/reports/zonal-audits", { method: "POST", body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ message: string }>(`/api/reports/zonal-audits/${id}`, { method: "DELETE" }),
      update: (id: string, data: { auditData: IZonalAuditReport }) =>
        request<SavedZonalAudit>(`/api/reports/zonal-audits/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    },

    nationalAudit: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<SavedNationalAudit>>(`/api/reports/national-audit?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<SavedNationalAudit>(`/api/reports/national-audit/${id}`),
      save: (data: CreateSavedNationalAuditInput) =>
        request<SavedNationalAudit>("/api/reports/national-audit", { method: "POST", body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ message: string }>(`/api/reports/national-audit/${id}`, { method: "DELETE" }),
      generate: (data: { month: string }) =>
        request<INationalAuditReport>("/api/reports/national-audit/generate", { method: "POST", body: JSON.stringify(data) }),
    },

    nationalAuditPeriod: {
      list: (params?: URLSearchParams | Record<string, string>) =>
        request<PaginatedResponse<SavedNationalAuditPeriod>>(`/api/reports/national-audit-period?${new URLSearchParams(params).toString()}`),
      get: (id: string) => request<SavedNationalAuditPeriod>(`/api/reports/national-audit-period/${id}`),
      save: (data: CreateSavedNationalAuditPeriodInput) =>
        request<SavedNationalAuditPeriod>("/api/reports/national-audit-period", { method: "POST", body: JSON.stringify(data) }),
      delete: (id: string) =>
        request<{ message: string }>(`/api/reports/national-audit-period/${id}`, { method: "DELETE" }),
      generate: (data: GenerateNationalAuditPeriodInput) =>
        request<GeneratedNationalAuditPeriod>("/api/reports/national-audit-period/generate", { method: "POST", body: JSON.stringify(data) }),
    },
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
    invite: (id: string, data: { email: string; phone?: string }) =>
      request<{ success: boolean; message: string; fellowId: string }>(`/api/fellows/${id}/invite`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    mySlots: () =>
      request<{ mentorName: string; slots: TimeSlotItem[] }>("/api/fellows/me/slots"),
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

  logs: {
    list: (params?: Record<string, string>) =>
      request<PaginatedResponse<ActivityLog>>(`/api/admin/logs?${new URLSearchParams(params).toString()}`),
    clear: () =>
      request<{ message: string }>("/api/admin/logs?confirm=yes", { method: "DELETE" }),
  },

  exceptionLogs: {
    list: (params?: Record<string, string>) =>
      request<PaginatedResponse<ExceptionLog>>(`/api/admin/exception-logs?${new URLSearchParams(params).toString()}`),
    clear: () =>
      request<{ message: string }>("/api/admin/exception-logs?confirm=yes", { method: "DELETE" }),
  },

  integrationLogs: {
    list: (params?: Record<string, string>) =>
      request<PaginatedResponse<IntegrationLog>>(`/api/admin/integration-logs?${new URLSearchParams(params).toString()}`),
    clear: () =>
      request<{ message: string }>("/api/admin/integration-logs?confirm=yes", { method: "DELETE" }),
  },
  admin: {
    toggleAiAccess: (userId: string, enabled: boolean) =>
      request<{ _id: string; name: string; email: string; role: string; aiAccessEnabled: boolean }>(
        `/api/admin/users/${userId}/ai-access`,
        { method: "PATCH", body: JSON.stringify({ aiAccessEnabled: enabled }) },
      ),
    getReportSettings: () =>
      request<ReportSettings>("/api/admin/report-settings"),
    updateReportSettings: (data: Partial<ReportSettings>) =>
      request<ReportSettings>("/api/admin/report-settings", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  scheduling: {
    getMe: () => request<MentorScheduleProfile>("/api/mentors/me"),
    updateMeetingLink: (meetingLink: string) =>
      request<MentorScheduleProfile>("/api/mentors/me", {
        method: "PATCH",
        body: JSON.stringify({ meetingLink }),
      }),
    getAvailability: () =>
      request<{ templates: AvailabilityTemplate[]; slots: TimeSlotItem[] }>(
        "/api/mentors/me/availability",
      ),
    saveTemplates: (templates: AvailabilityTemplateInput[]) =>
      request<{ success: boolean; templates: number; slotsCreated: number }>(
        "/api/mentors/me/availability",
        { method: "PUT", body: JSON.stringify({ templates }) },
      ),
    addSlot: (data: { startAt: string; meetingLinkOverride?: string }) =>
      request<TimeSlotItem>("/api/mentors/me/availability", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    deleteSlot: (slotId: string) =>
      request<{ success: boolean }>(`/api/mentors/me/availability/${slotId}`, { method: "DELETE" }),
    publish: () =>
      request<{ success: boolean; notified: number; openSlots: number }>(
        "/api/mentors/me/publish",
        { method: "POST" },
      ),
    connectGoogle: () =>
      request<{ url: string }>("/api/integrations/google/connect"),
    generateMeetLink: (mentorUserId: string) =>
      request<{ meetingLink: string; spaceName: string; meetingCode: string }>(
        `/api/mentors/${mentorUserId}/meet-link`,
        { method: "POST" },
      ),
    meetStats: (mentorUserId: string) =>
      request<MeetStatsResponse>(`/api/mentors/${mentorUserId}/meet-stats`),
  },

  notifications: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request<{
        data: NotificationItem[];
        unreadCount: number;
        pagination: PaginatedResponse<NotificationItem>["pagination"];
      }>(`/api/notifications${qs}`);
    },
    markRead: (id: string) =>
      request<NotificationItem>(`/api/notifications/${id}`, { method: "PATCH" }),
    markAllRead: () =>
      request<{ success: boolean; updated: number }>("/api/notifications/read-all", {
        method: "POST",
      }),
  },

  bookings: {
    list: (params?: Record<string, string>) => {
      const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
      return request<PaginatedResponse<BookingItem>>(`/api/bookings${qs}`);
    },
    create: (data: { slotId: string; note?: string }) =>
      request<BookingItem>("/api/bookings", { method: "POST", body: JSON.stringify(data) }),
    cancel: (id: string) =>
      request<{ success: boolean; status: string }>(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      }),
  },};

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

export interface Admin {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  rootAdmin?: boolean;
  active: boolean;
  aiAccessEnabled?: boolean;
  createdAt: string;
}

export interface CreateAdminInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface Mentor {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  states?: string[];
  lgas: string[];
  active: boolean;
  createdAt: string;
  mentorId?: string;
}

export interface CreateMentorInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  states?: string[];
  lgas?: string[];
  coordinatorId?: string;
}

export interface BulkMentorInput {
  name: string;
  email: string;
  phone?: string;
  states?: string;
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
  coordinatorId?: string;
  aiAccessEnabled?: boolean;
}

export interface CreateCoordinatorInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  states?: string[];
}

export interface DeskOfficer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  states: string[];
  active: boolean;
  createdAt: string;
}

export interface CreateDeskOfficerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
  states?: string[];
}

export interface MEOfficer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface CreateMEOfficerInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface TeamResearchLead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface CreateTeamResearchLeadInput {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

export interface Fellow {
  _id: string;
  mentor: string;
  name: string;
  gender: string;
  lga: string;
  qualification?: string;
  documentCount?: number;
  email?: string;
  inviteStatus?: "none" | "invited" | "active";
  invitedAt?: string;
  createdAt: string;
}

// ─── Scheduling / Booking types ─────────────
export interface MentorScheduleProfile {
  _id: string;
  meetingLink?: string;
  states: string[];
  lgas: string[];
  google?: {
    email?: string;
    connectedAt?: string;
    meetingUri?: string;
    spaceName?: string;
  };
}

export interface MeetMeetingStat {
  conferenceRecord: string;
  startTime?: string;
  endTime?: string;
  durationMinutes: number | null;
  participantCount: number;
  recordingUri?: string;
  transcriptUri?: string;
}

export interface MeetStatsResponse {
  connected: boolean;
  email: string | null;
  meetingLink?: string | null;
  summary: {
    totalMeetings: number;
    totalMinutes: number;
    totalRecordings: number;
    totalTranscripts: number;
    meetings: MeetMeetingStat[];
  } | null;
}

export interface AvailabilityTemplate {
  _id: string;
  mentor: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active: boolean;
}

export interface AvailabilityTemplateInput {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  active?: boolean;
}

export interface TimeSlotItem {
  _id: string;
  mentor: string;
  startAt: string;
  endAt: string;
  status: "open" | "booked" | "cancelled";
  source: "template" | "manual";
  meetingLinkOverride?: string;
  meetingLink?: string | null;
}

export interface BookingItem {
  _id: string;
  timeSlot: string;
  fellow: { _id: string; name: string; email?: string } | string;
  mentor: string;
  note?: string;
  status: "confirmed" | "cancelled" | "completed" | "no_show";
  meetingLink?: string;
  startAt: string;
  endAt: string;
  createdAt: string;
}

export interface NotificationItem {
  _id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export interface CreateFellowInput {
  name: string;
  gender: string;
  lga: string;
  qualification?: string;
}

export interface BulkFellowInput {
  name: string;
  state: string;
  lga: string;
  phone: string;
  gender: string;
  qualification?: string;
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
  fellows: { name: string; lga: string; qualification?: string }[];
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
  evidence: { url: string; comment: string }[];
  status: string;
  dataQualityFlags: string[];
  state: string;
  createdAt: string;
  canEdit?: boolean;
  /** Convenience — populated from mentor.name or virtual */
  mentorName?: string;
  comments?: ReportComment[];
}

export interface ReportComment {
  _id: string;
  author: string;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
}

export interface ReportHistoryEntry {
  _id: string;
  reportId: string;
  reportType: ReportHistoryReportType;
  action: ReportHistoryAction;
  snapshot: string | null;
  actorId: string;
  actorName: string;
  actorRole: string;
  meta?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportInput {
  weekEnding: string;
  weekNumber?: number;
  coverNote?: string;
  fellows?: { name: string; lga: string; qualification?: string }[];
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
  evidence?: { url: string; comment: string }[];
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
  totalFellows: number;
}

export interface MonthlyReport {
  _id: string;
  type: "mentor" | "zonal";
  coordinator?: { _id: string; name: string; email: string; state: string };
  mentor?: { _id: string; name: string; email: string; state?: string };
  state: string;
  month: string;
  summaryText: string;
  zonalAuditData?: IZonalAuditReport | null;
  weeklyReports: Report[];
  status: string;
  createdAt: string;
}

/** Derive display author name from a monthly report */
export function monthlyReportAuthorName(r: MonthlyReport): string {
  if (r.type === "mentor") {
    return r.mentor?.name || "Unknown Mentor";
  }
  return r.coordinator?.name || "Unknown Coordinator";
}

export interface CreateMonthlyReportInput {
  month: string;
  summaryText: string;
  zonalAuditData?: IZonalAuditReport;
}

export interface SavedZonalAudit {
  _id: string;
  coordinator: { _id: string; name: string; email: string; state: string };
  zoneName: string;
  month: string;
  auditData: IZonalAuditReport;
  createdAt: string;
  canEdit?: boolean;
}

export interface CreateSavedZonalAuditInput {
  month: string;
  auditData: IZonalAuditReport;
}

export interface SavedNationalAudit {
  _id: string;
  generatedBy: { _id: string; name: string; email: string };
  month: string;
  auditData: INationalAuditReport;
  createdAt: string;
}

export interface CreateSavedNationalAuditInput {
  month: string;
  auditData: INationalAuditReport;
}

export interface SavedNationalAuditPeriod {
  _id: string;
  generatedBy: { _id: string; name: string; email: string };
  startMonth: string;
  endMonth: string;
  periodType: NationalAuditPeriodType;
  periodLabel: string;
  auditData: INationalAuditPeriodReport;
  coverage: IPeriodicCoverage;
  createdAt: string;
}

export interface GenerateNationalAuditPeriodInput {
  startMonth: string;
  endMonth: string;
  periodType?: NationalAuditPeriodType;
}

export interface GeneratedNationalAuditPeriod {
  startMonth: string;
  endMonth: string;
  periodType: NationalAuditPeriodType;
  periodLabel: string;
  coverage: IPeriodicCoverage;
  auditData: INationalAuditPeriodReport;
}

export interface CreateSavedNationalAuditPeriodInput {
  startMonth: string;
  endMonth: string;
  periodType: NationalAuditPeriodType;
  periodLabel: string;
  auditData: INationalAuditPeriodReport;
  coverage: IPeriodicCoverage;
}

export interface MentorMonthlyReport {
  _id: string;
  mentor: { _id: string; states?: string[]; authId?: { name: string; email: string } };
  fellow: { _id: string; name: string; lga: string; qualification?: string };
  month: string;
  fellowName: string;
  fellowLGA: string;
  fellowQualification?: string;
  sessionsHeld: number;
  sessionsAttended: number;
  sessionsAbsent: number;
  summaryLearning?: string;
  summaryPhcVisits?: string;
  summaryActivities?: string;
  summaryGrowth?: string;
  summaryImpact?: string;
  challenges: string[];
  recommendations: string[];
  achievements?: string;
  progressRating?: "Excellent" | "Good" | "Fair" | "Needs Improvement" | "";
  weeklyReportIds: string[];
  status: string;
  createdAt: string;
  canEdit?: boolean;
}

export interface CreateMentorMonthlyReportInput {
  fellow: string;
  month: string;
  sessionsHeld: number;
  sessionsAttended: number;
  sessionsAbsent: number;
  summaryLearning?: string;
  summaryPhcVisits?: string;
  summaryActivities?: string;
  summaryGrowth?: string;
  summaryImpact?: string;
  challenges: string[];
  recommendations: string[];
  achievements?: string;
  progressRating?: string;
  weeklyReportIds?: string[];
}

export interface MentorMonthlyReportPrefill {
  fellow: { _id: string; name: string; lga: string; qualification?: string };
  sessionsHeld: number;
  sessionsAttended: number;
  sessionsAbsent: number;
  challenges: string[];
  recommendations: string[];
  weeklyReportIds: string[];
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

export interface EditLockConfig {
  mentor: boolean;
  coordinator: boolean;
}

export interface ReportSettings {
  blockWeeklyReportEdits: EditLockConfig;
  blockMonthlyReportEdits: EditLockConfig;
  blockZonalAuditEdits: boolean;
}

export interface ActivityLog {
  _id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface ExceptionLog {
  _id: string;
  message: string;
  stack?: string;
  context: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  request?: { method?: string; url?: string; body?: unknown };
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface IntegrationLog {
  _id: string;
  service: string;
  action: string;
  status: "success" | "failure";
  durationMs?: number;
  payload?: unknown;
  response?: unknown;
  error?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface AnalyticsData {
  totalFellows: number;
  totalMentors: number;
  fellowsByState: { state: string; count: number }[];
  fellowsByGender: { gender: string; count: number }[];
  fellowsByStateGender: { state: string; total: number; [gender: string]: string | number }[];
  mentorsByState: { state: string; count: number }[];
  qualifications: { name: string; count: number }[];
}
