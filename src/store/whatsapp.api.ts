import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./api";

interface WhatsappTemplate {
  id: string;
  templateText: string;
  employeeId: string;
  createdAt: string;
  updatedAt: string;
}

interface Placeholder {
  key: string;
  label: string;
  example: string;
}

interface RenderResult {
  renderedMessage: string;
  whatsappUrl: string;
}

function normalisePlaceholders(raw: unknown): Placeholder[] {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const map = (obj.supportedPlaceholders ?? obj) as Record<string, string>;

    if (map && typeof map === "object" && !Array.isArray(map)) {
      const entries = Object.entries(map);
      if (entries.length > 0) {
        return entries.map(([bracketKey, description]) => {
          const key = bracketKey.replace(/^\{|\}$/g, "");
          return {
            key,
            label: description || key.replace(/_/g, " "),
            example: "",
          };
        });
      }
    }
  }

  return [];
}

export const whatsappApi = createApi({
  reducerPath: "whatsappApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["WhatsappTemplate"],
  endpoints: (builder) => ({
    getPlaceholders: builder.query<Placeholder[], void>({
      query: () => "/whatsapp/placeholders",
      transformResponse: (raw: unknown): Placeholder[] => {
        const d = (raw as Record<string, unknown>)?.data ?? raw;
        return normalisePlaceholders(d);
      },
    }),

    getMyTemplate: builder.query<WhatsappTemplate | null, void>({
  query: () => "/whatsapp/template",
  transformResponse: (raw: unknown): WhatsappTemplate | null => {
    const obj = ((raw as Record<string, unknown>)?.data ?? raw) as Record<string, unknown>;

    // API returns { templateText, hasTemplate, supportedPlaceholders }
    // — no id field, so check hasTemplate + templateText instead
    if (!obj || !obj.hasTemplate || typeof obj.templateText !== "string") return null;

    return {
      id: "mine",                               // synthetic — not returned by this endpoint
      templateText: obj.templateText as string,
      employeeId: (obj.employeeId ?? "") as string,
      createdAt: (obj.createdAt ?? "") as string,
      updatedAt: (obj.updatedAt ?? "") as string,
    };
  },
  providesTags: [{ type: "WhatsappTemplate", id: "MINE" }],
}),

    upsertTemplate: builder.mutation<WhatsappTemplate, { templateText: string }>({
      query: (body) => ({ url: "/whatsapp/template", method: "PUT", body }),
      invalidatesTags: [{ type: "WhatsappTemplate", id: "MINE" }],
    }),

    deleteTemplate: builder.mutation<void, void>({
      query: () => ({ url: "/whatsapp/template", method: "DELETE" }),
      invalidatesTags: [{ type: "WhatsappTemplate", id: "MINE" }],
    }),

    renderTemplate: builder.mutation<RenderResult, { leadId: string }>({
      query: (body) => ({ url: "/whatsapp/render", method: "POST", body }),
    }),

    getAllTemplates: builder.query<WhatsappTemplate[], void>({
      query: () => "/whatsapp/admin/all",
      transformResponse: (raw: unknown): WhatsappTemplate[] => {
        const d = (raw as Record<string, unknown>)?.data ?? raw;
        return Array.isArray(d) ? d : [];
      },
      providesTags: [{ type: "WhatsappTemplate", id: "ALL" }],
    }),
  }),
});

export const {
  useGetPlaceholdersQuery,
  useGetMyTemplateQuery,
  useUpsertTemplateMutation,
  useDeleteTemplateMutation,
  useRenderTemplateMutation,
  useGetAllTemplatesQuery,
} = whatsappApi;