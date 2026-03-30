import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { MyTarget, TeamTarget } from "../types";

export type Period = "1M" | "3M" | "6M" | "1Y";

export interface TargetSummary {
  period: Period;
  employee: { id: string; firstName: string; lastName: string; designation: string; dailyCallTarget?: number } | null;
  achieved: {
    calls: number;
    queries: number;
    remarks: number;
    visits: number;
    meetings: number;
    deals: number;
    salesRevenue: number;
    incentive: number;
  };
  targets: {
    calls: number;
    salesRevenue: number;
  };
  dateRange: { from: string; to: string };
}

export interface TodayStats {
  calls: number;
  visits: number;
  meetings: number;
  deals: number;
  dailyCallTarget: number;
}

export const targetsApi = createApi({
  reducerPath: "targetsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.TARGETS],
  endpoints: (builder) => ({
    getMyTarget: builder.query<MyTarget, { month?: number; year?: number } | void>({
      query: (params) => ({ url: "/targets/mine", params: params ?? undefined }),
      transformResponse: (raw: any) => raw?.data ?? raw,
    }),

    getMyTargetSeries: builder.query<MyTarget[], { months?: number; employeeId?: string } | void>({
      query: (params) => ({ url: "/targets/series/mine", params: params ?? undefined }),
      transformResponse: (raw: any): MyTarget[] => {
        const d = raw?.data ?? raw;
        return Array.isArray(d) ? d : [];
      },
    }),

    getTeamTargets: builder.query<TeamTarget[], { month?: number; year?: number; employeeId?: string } | void>({
      query: (params) => ({ url: "/targets/team", params: params ?? undefined }),
      transformResponse: (raw: any): TeamTarget[] => {
        const d = raw?.data ?? raw;
        return Array.isArray(d) ? d : [];
      },
    }),

    getTargetSummary: builder.query<TargetSummary, { employeeId?: string; period: Period }>({
      query: ({ employeeId, period }) => ({
        url: "/targets/summary",
        params: { ...(employeeId ? { employeeId } : {}), period },
      }),
      transformResponse: (raw: any): TargetSummary => {
        const d = raw?.data ?? raw;
        return {
          period: d?.period ?? "1M",
          employee: d?.employee ?? null,
          achieved: d?.achieved ?? { calls: 0, queries: 0, remarks: 0, visits: 0, meetings: 0, deals: 0, salesRevenue: 0, incentive: 0 },
          targets: d?.targets ?? { calls: 0, salesRevenue: 0 },
          dateRange: d?.dateRange ?? { from: "", to: "" },
        };
      },
    }),

    getTodayStats: builder.query<TodayStats, { employeeId?: string } | void>({
      query: (params) => ({ url: "/targets/today", params: params ?? undefined }),
      transformResponse: (raw: any): TodayStats => {
        const d = raw?.data ?? raw;
        return {
          calls: d?.calls ?? 0,
          visits: d?.visits ?? 0,
          meetings: d?.meetings ?? 0,
          deals: d?.deals ?? 0,
          dailyCallTarget: d?.dailyCallTarget ?? d?.callTarget ?? 0,
        };
      },
    }),

    setTarget: builder.mutation<void, {
      employeeId: string; month: number; year: number;
      callTarget?: number; salesTarget?: number;
    }>({
      query: (body) => ({ url: "/targets/set", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.TARGETS],
    }),
  }),
});

export const {
  useGetMyTargetQuery,
  useGetMyTargetSeriesQuery,
  useGetTeamTargetsQuery,
  useGetTargetSummaryQuery,
  useGetTodayStatsQuery,
  useSetTargetMutation,
} = targetsApi;
