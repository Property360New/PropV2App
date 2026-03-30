import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { Project } from "../types";

export const projectsApi = createApi({
  reducerPath: "projectsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.PROJECTS],
  endpoints: (builder) => ({
    getProjects: builder.query<Project[], void>({
      query: () => "/projects",
      providesTags: [{ type: TAG_TYPES.PROJECTS, id: "LIST" }],
    }),
    getProjectDetail: builder.query<Project, string>({
      query: (id) => `/projects/${id}`,
      providesTags: (_r, _e, id) => [{ type: TAG_TYPES.PROJECTS, id }],
    }),
    createProject: builder.mutation<Project, Record<string, unknown>>({
      query: (body) => ({ url: "/projects", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.PROJECTS],
    }),
    updateProject: builder.mutation<Project, { id: string; body: Record<string, unknown> }>({
      query: ({ id, body }) => ({ url: `/projects/${id}`, method: "PATCH", body }),
      invalidatesTags: [TAG_TYPES.PROJECTS],
    }),
    deleteProject: builder.mutation<void, string>({
      query: (id) => ({ url: `/projects/${id}`, method: "DELETE" }),
      invalidatesTags: [TAG_TYPES.PROJECTS],
    }),
    getProjectsDropdown: builder.query<{ id: string; name: string; product: string | null }[], void>({
      query: () => "/projects/dropdown",
      providesTags: [{ type: TAG_TYPES.PROJECTS, id: "DROPDOWN" }],
    }),
  }),
});

export const {
  useGetProjectsQuery,
  useGetProjectDetailQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useGetProjectsDropdownQuery,
} = projectsApi;
