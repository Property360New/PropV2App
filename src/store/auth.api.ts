import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { LoginResponse, AuthProfile, Employee } from "../types";

export const authApi = createApi({
  reducerPath: "authApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.AUTH],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, { email: string; password: string }>({
      query: (credentials) => ({
        url: "/auth/login",
        method: "POST",
        body: credentials,
      }),
    }),

    getProfile: builder.query<AuthProfile, void>({
      query: () => "/auth/profile",
      transformResponse: (raw: any): AuthProfile => {
        return raw?.data ?? raw;
      },
      providesTags: [{ type: TAG_TYPES.AUTH, id: "PROFILE" }],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: "/auth/logout",
        method: "POST",
      }),
      invalidatesTags: [TAG_TYPES.AUTH],
    }),

    changePassword: builder.mutation<void, { oldPassword: string; newPassword: string }>({
      query: (data) => ({
        url: "/auth/change-password",
        method: "POST",
        body: data,
      }),
    }),

    updateProfile: builder.mutation<Employee, {
      firstName?: string;
      lastName?: string;
      phone?: string;
      avatar?: string;
      birthday?: string;
      marriageAnniversary?: string;
    }>({
      query: (data) => ({
        url: "/auth/profile",
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: [{ type: TAG_TYPES.AUTH, id: "PROFILE" }],
    }),
  }),
});

export const {
  useLoginMutation,
  useGetProfileQuery,
  useLazyGetProfileQuery,
  useLogoutMutation,
  useChangePasswordMutation,
  useUpdateProfileMutation,
} = authApi;
