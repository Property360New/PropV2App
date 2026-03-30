import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, getApiBaseUrl } from "./api";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export interface ImportHistoryItem {
  id: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  createdAt: string;
  uploadedById: string;
}

export interface ImportResult {
  importId: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; reason: string }>;
}

export const bulkImportApi = createApi({
  reducerPath: "bulkImportApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["BulkImport"],
  endpoints: (builder) => ({
    getImportHistory: builder.query<ImportHistoryItem[], void>({
      query: () => "/bulk-import/history",
      transformResponse: (raw: any) => raw?.data ?? raw ?? [],
      providesTags: [{ type: "BulkImport", id: "LIST" }],
    }),

    downloadTemplate: builder.query<void, void>({
      queryFn: async () => {
        try {
          const token = await SecureStore.getItemAsync("accessToken");
          const baseUrl = getApiBaseUrl();
          const fileUri = FileSystem.documentDirectory + "leads-import-template.xlsx";

          const result = await FileSystem.downloadAsync(
            `${baseUrl}/bulk-import/template`,
            fileUri,
            {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }
          );

          if (result.status !== 200) {
            return { error: { status: result.status, data: "Download failed" } as any };
          }

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(result.uri);
          }

          return { data: undefined as void };
        } catch (err: any) {
          return {
            error: { status: "FETCH_ERROR" as const, error: String(err?.message ?? err) },
          };
        }
      },
    }),

    importLeads: builder.mutation<ImportResult, { fileUri: string; fileName: string; assignedToId?: string }>({
      queryFn: async ({ fileUri, fileName, assignedToId }, _queryApi, _extraOptions, baseQuery) => {
        const formData = new FormData();
        formData.append("file", {
          uri: fileUri,
          name: fileName,
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        } as any);
        if (assignedToId) formData.append("assignedToId", assignedToId);

        const result = await baseQuery({
          url: "/bulk-import/leads",
          method: "POST",
          body: formData,
        });

        if (result.error) return { error: result.error };
        const raw = result.data as any;
        return { data: raw?.data ?? raw };
      },
      invalidatesTags: ["BulkImport"],
    }),
  }),
});

export const {
  useGetImportHistoryQuery,
  useLazyDownloadTemplateQuery,
  useImportLeadsMutation,
} = bulkImportApi;
