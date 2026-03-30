import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES, getApiBaseUrl } from "./api";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { AttendanceRecord } from "../types";

export const attendanceApi = createApi({
  reducerPath: "attendanceApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.ATTENDANCE],
  endpoints: (builder) => ({
    getTodayAttendance: builder.query<AttendanceRecord | null, void>({
      query: () => "/attendance/today",
      providesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "TODAY" }],
    }),

    checkIn: builder.mutation<
      AttendanceRecord,
      { latitude: number; longitude: number; accuracy?: number; address?: string }
    >({
      query: (body) => ({ url: "/attendance/check-in", method: "POST", body }),
      // Immediately invalidates TODAY → RTK Query refetches → UI updates without manual refresh
      invalidatesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "TODAY" }],
    }),

    checkOut: builder.mutation<
      AttendanceRecord,
      { latitude: number; longitude: number; accuracy?: number; address?: string }
    >({
      query: (body) => ({ url: "/attendance/check-out", method: "POST", body }),
      invalidatesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "TODAY" }],
    }),

    getMyAttendance: builder.query<
      AttendanceRecord[],
      { startDate?: string; endDate?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/attendance/mine", params }),
      transformResponse: (res: AttendanceRecord[] | { data: AttendanceRecord[] }) =>
        Array.isArray(res) ? res : res.data,
      providesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "MINE" }],
    }),

    getTeamAttendance: builder.query<
      AttendanceRecord[],
      { startDate?: string; endDate?: string; page?: number; limit?: number }
    >({
      query: (params) => ({ url: "/attendance", params }),
      transformResponse: (res: AttendanceRecord[] | { data: AttendanceRecord[] }) =>
        Array.isArray(res) ? res : res.data,
      providesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "TEAM" }],
    }),

    getAttendanceSummary: builder.query<unknown, { month: number; year: number }>({
      query: (params) => ({ url: "/attendance/summary", params }),
      providesTags: [{ type: TAG_TYPES.ATTENDANCE, id: "SUMMARY" }],
    }),

    downloadMyAttendance: builder.query<void, { startDate: string; endDate: string }>({
      queryFn: async (params) => {
        try {
          const token = await SecureStore.getItemAsync("accessToken");
          const baseUrl = getApiBaseUrl();
          const qs = new URLSearchParams(params).toString();
          const fileUri = FileSystem.documentDirectory + `my-attendance-${params.startDate}-${params.endDate}.xlsx`;

          const result = await FileSystem.downloadAsync(
            `${baseUrl}/attendance/export/mine?${qs}`,
            fileUri,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );

          if (result.status !== 200) {
            return { error: { status: result.status, data: "Download failed" } as any };
          }
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }
          return { data: undefined as void };
        } catch (err: any) {
          return { error: { status: "FETCH_ERROR" as const, error: String(err?.message ?? err) } };
        }
      },
    }),

    downloadTeamAttendance: builder.query<void, { startDate: string; endDate: string; employeeId?: string }>({
      queryFn: async (params) => {
        try {
          const token = await SecureStore.getItemAsync("accessToken");
          const baseUrl = getApiBaseUrl();
          const qs = new URLSearchParams(params as any).toString();
          const fileUri = FileSystem.documentDirectory + `team-attendance-${params.startDate}-${params.endDate}.xlsx`;

          const result = await FileSystem.downloadAsync(
            `${baseUrl}/attendance/export/team?${qs}`,
            fileUri,
            { headers: token ? { Authorization: `Bearer ${token}` } : {} }
          );

          if (result.status !== 200) {
            return { error: { status: result.status, data: "Download failed" } as any };
          }
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }
          return { data: undefined as void };
        } catch (err: any) {
          return { error: { status: "FETCH_ERROR" as const, error: String(err?.message ?? err) } };
        }
      },
    }),
  }),
});

export const {
  useGetTodayAttendanceQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetMyAttendanceQuery,
  useGetTeamAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useLazyDownloadMyAttendanceQuery,
  useLazyDownloadTeamAttendanceQuery,
} = attendanceApi;
