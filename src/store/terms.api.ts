import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./api";
import type { TermsConditions, PrivacyPolicy } from "../types";

export const termsApi = createApi({
  reducerPath: "termsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["Terms", "Privacy"],
  endpoints: (builder) => ({
    getLatestTerms: builder.query<TermsConditions | null, void>({
      query: () => "/terms-conditions/latest",
      providesTags: ["Terms"],
    }),
    getTermsHistory: builder.query<TermsConditions[], void>({
      query: () => "/terms-conditions/history",
      providesTags: ["Terms"],
    }),
    getNeedsAcceptance: builder.query<{ mustAccept: boolean; terms: TermsConditions | null }, void>({
      query: () => "/terms-conditions/needs-acceptance",
    }),
    publishTerms: builder.mutation<TermsConditions, { content: string }>({
      query: (body) => ({ url: "/terms-conditions", method: "POST", body }),
      invalidatesTags: ["Terms"],
    }),
    acceptTerms: builder.mutation<unknown, { termsId?: string }>({
      query: (body) => ({ url: "/terms-conditions/accept", method: "POST", body }),
      invalidatesTags: ["Terms"],
    }),
    getLatestPrivacy: builder.query<PrivacyPolicy | null, void>({
      query: () => "/privacy-policy/latest",
      providesTags: ["Privacy"],
    }),
    publishPrivacy: builder.mutation<PrivacyPolicy, { content: string }>({
      query: (body) => ({ url: "/privacy-policy", method: "POST", body }),
      invalidatesTags: ["Privacy"],
    }),
  }),
});

export const {
  useGetLatestTermsQuery,
  useGetTermsHistoryQuery,
  useGetNeedsAcceptanceQuery,
  usePublishTermsMutation,
  useAcceptTermsMutation,
  useGetLatestPrivacyQuery,
  usePublishPrivacyMutation,
} = termsApi;
