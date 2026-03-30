import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./api";

export interface ActivityStats {
  stats: {
    totalCalls: number;
    queries: number;
    remarks: number;
    followups: number;
    visits: number;
    meetings: number;
    deals: number;
    notInterested: number;
    hotProspects: number;
    ringing: number;
    switchOff: number;
    callBack: number;
    suspect: number;
  };
  hourly: Array<{ range: string; count: number }>;
  leads: Record<string, Array<{
    leadId: string; name: string; phone: string;
    source: string | null; status: string; createdAt: string;
    createdBy?: { id: string; firstName: string; lastName: string };
  }>>;
  dateRange: { gte: string; lte: string };
}

export interface TeamPerfRow {
  id: string;
  firstName: string;
  lastName: string;
  designation: string;
  callsMade: number;
  queries: number;
  remarks: number;
  visitsCompleted: number;
  meetingsHeld: number;
  dealsDone: number;
  notInterested: number;
  followUps: number;
}

export const reportsApi = createApi({
  reducerPath: "reportsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["REPORTS"],
  endpoints: (builder) => ({
    getDashboardSummary: builder.query<Record<string, number>, void>({
      query: () => "/reports/dashboard",
      transformResponse: (raw: any) => raw?.data ?? raw,
      providesTags: [{ type: "REPORTS", id: "DASHBOARD" }],
    }),

    getActivityStats: builder.query<ActivityStats, {
      startDate?: string; endDate?: string;
      month?: number; year?: number; employeeId?: string;
    } | void>({
      query: (params) => ({ url: "/reports/activity", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
      providesTags: [{ type: "REPORTS", id: "ACTIVITY" }],
    }),

    getCallActivity: builder.query<{ buckets: Array<{ range: string; count: number }>; total: number }, {
      month?: number; year?: number; employeeId?: string;
    } | void>({
      query: (params) => ({ url: "/reports/call-activity", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
      providesTags: [{ type: "REPORTS", id: "CALL_ACTIVITY" }],
    }),

    getDailyCallActivity: builder.query<{
      buckets: Array<{ date: string; callsMade: number; callTarget: number }>;
      total: number;
      dailyCallTarget: number;
    }, { month?: number; year?: number; employeeId?: string } | void>({
      query: (params) => ({ url: "/reports/daily-call-activity", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
      providesTags: [{ type: "REPORTS", id: "DAILY_CALL_ACTIVITY" }],
    }),

    getTeamPerformance: builder.query<{ data: TeamPerfRow[] }, {
      month?: number; year?: number; employeeId?: string;
    } | void>({
      query: (params) => ({ url: "/reports/team/performance", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
      providesTags: [{ type: "REPORTS", id: "TEAM_PERFORMANCE" }],
    }),

    getLeadStatusReport: builder.query<unknown, { month?: number; year?: number } | void>({
      query: (params) => ({ url: "/reports/leads/status", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),

    getLeadSourceReport: builder.query<unknown, { month?: number; year?: number } | void>({
      query: (params) => ({ url: "/reports/leads/source", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),

    getDealsReport: builder.query<unknown, { startDate?: string; endDate?: string } | void>({
      query: (params) => ({ url: "/reports/deals", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),

    getAttendanceReport: builder.query<unknown, { month?: number; year?: number } | void>({
      query: (params) => ({ url: "/reports/attendance", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),

    getExpenseReport: builder.query<unknown, { month?: number; year?: number } | void>({
      query: (params) => ({ url: "/reports/expenses", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),
  }),
});

export const {
  useGetDashboardSummaryQuery,
  useGetActivityStatsQuery,
  useGetCallActivityQuery,
  useGetDailyCallActivityQuery,
  useGetTeamPerformanceQuery,
  useGetLeadStatusReportQuery,
  useGetLeadSourceReportQuery,
  useGetDealsReportQuery,
  useGetAttendanceReportQuery,
  useGetExpenseReportQuery,
} = reportsApi;
