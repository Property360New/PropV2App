import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";
import * as SecureStore from "expo-secure-store";

// Change this to your actual backend URL
const API_BASE_URL = "http://192.168.1.48:3000/api/v1";

export const getApiBaseUrl = () => API_BASE_URL;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: async (headers) => {
    const token = await SecureStore.getItemAsync("accessToken");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  },
});

// Unwrap the backend's { success, data, timestamp } envelope
function unwrapResponse<T>(result: T): T {
  const r = result as { data?: unknown };
  if (r.data && typeof r.data === "object" && "data" in (r.data as Record<string, unknown>)) {
    return { ...result, data: (r.data as { data: unknown }).data };
  }
  return result;
}

// Navigation ref for programmatic navigation on auth failure
let navigationRef: any = null;
export const setNavigationRef = (ref: any) => {
  navigationRef = ref;
};

// Wraps the base query to handle 401 → refresh token flow and unwrap envelope
export const baseQueryWithAuth: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const refreshToken = await SecureStore.getItemAsync("refreshToken");
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        {
          url: "/auth/refresh",
          method: "POST",
          headers: { Authorization: `Bearer ${refreshToken}` },
        },
        api,
        extraOptions
      );

      if (refreshResult.data) {
        const unwrapped = unwrapResponse(refreshResult);
        const data = unwrapped.data as { accessToken: string; refreshToken: string };
        await SecureStore.setItemAsync("accessToken", data.accessToken);
        await SecureStore.setItemAsync("refreshToken", data.refreshToken);
        // Retry original request
        result = await rawBaseQuery(args, api, extraOptions);
      } else {
        await SecureStore.deleteItemAsync("accessToken");
        await SecureStore.deleteItemAsync("refreshToken");
        if (navigationRef?.current) {
          navigationRef.current.reset({ index: 0, routes: [{ name: "Login" }] });
        }
      }
    } else {
      await SecureStore.deleteItemAsync("accessToken");
      if (navigationRef?.current) {
        navigationRef.current.reset({ index: 0, routes: [{ name: "Login" }] });
      }
    }
  }

  return unwrapResponse(result);
};

export const TAG_TYPES = {
  AUTH: "Auth" as const,
  LEADS: "Leads" as const,
  TAB_COUNTS: "TabCounts" as const,
  NOTIFICATION_STRIP: "NotificationStrip" as const,
  TODAYS_FOLLOWUPS: "TodaysFollowups" as const,
  ATTENDANCE: "Attendance" as const,
  TARGETS: "Targets" as const,
  NOTIFICATIONS: "Notifications" as const,
  REPORTS: "Reports" as const,
  CUSTOMERS: "Customers" as const,
  INVENTORY: "Inventory" as const,
  EMPLOYEES: "Employees" as const,
  HIERARCHY: "Hierarchy" as const,
  PROJECTS: "Projects" as const,
  EXPENSES: "Expenses" as const,
};
