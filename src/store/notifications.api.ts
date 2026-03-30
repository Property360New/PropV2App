import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { NotificationListResponse } from "../types";

export const notificationsApi = createApi({
  reducerPath: "notificationsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.NOTIFICATIONS],
  endpoints: (builder) => ({
    getNotifications: builder.query<NotificationListResponse, { page?: number; limit?: number; unreadOnly?: boolean } | void>({
      query: (params) => ({
        url: "/notifications",
        params: params || undefined,
      }),
      providesTags: [{ type: TAG_TYPES.NOTIFICATIONS, id: "LIST" }],
    }),

    getUnreadCount: builder.query<number, void>({
      query: () => "/notifications/unread-count",
      transformResponse: (raw: { count: number }) => raw.count,
      providesTags: [{ type: TAG_TYPES.NOTIFICATIONS, id: "UNREAD" }],
    }),

    markAsRead: builder.mutation<void, string>({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: TAG_TYPES.NOTIFICATIONS, id: "LIST" },
        { type: TAG_TYPES.NOTIFICATIONS, id: "UNREAD" },
      ],
    }),

    markAllAsRead: builder.mutation<{ marked: number }, void>({
      query: () => ({
        url: "/notifications/read-all",
        method: "PATCH",
      }),
      invalidatesTags: [
        { type: TAG_TYPES.NOTIFICATIONS, id: "LIST" },
        { type: TAG_TYPES.NOTIFICATIONS, id: "UNREAD" },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationsApi;
