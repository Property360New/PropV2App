import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { ScopeEmployee, ManagedEmployee, CreateEmployeeBody, HierarchyNode } from "../types";

export const hierarchyApi = createApi({
  reducerPath: "hierarchyApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.HIERARCHY, TAG_TYPES.EMPLOYEES],
  endpoints: (builder) => ({
    getHierarchyTree: builder.query<HierarchyNode[], void>({
      query: () => "/hierarchy/tree",
      providesTags: [{ type: TAG_TYPES.HIERARCHY, id: "TREE" }],
    }),

    getScopeEmployees: builder.query<ScopeEmployee[], void>({
      query: () => "/hierarchy/employees",
      providesTags: [{ type: TAG_TYPES.EMPLOYEES, id: "SCOPE" }],
    }),

    getEmployeeDetail: builder.query<ManagedEmployee, string>({
      query: (id) => `/hierarchy/employees/${id}`,
      providesTags: (_r, _e, id) => [{ type: TAG_TYPES.EMPLOYEES, id }],
    }),

    createEmployee: builder.mutation<ManagedEmployee, CreateEmployeeBody>({
      query: (body) => ({ url: "/hierarchy/employees", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.EMPLOYEES, TAG_TYPES.HIERARCHY],
    }),

    updateEmployee: builder.mutation<ManagedEmployee, { id: string; body: Partial<CreateEmployeeBody> }>({
      query: ({ id, body }) => ({ url: `/hierarchy/employees/${id}`, method: "PATCH", body }),
      invalidatesTags: [TAG_TYPES.EMPLOYEES, TAG_TYPES.HIERARCHY],
    }),

    deactivateEmployee: builder.mutation<void, string>({
      query: (id) => ({ url: `/hierarchy/employees/${id}/deactivate`, method: "PATCH" }),
      invalidatesTags: [TAG_TYPES.EMPLOYEES, TAG_TYPES.HIERARCHY],
    }),

    reactivateEmployee: builder.mutation<void, string>({
      query: (id) => ({ url: `/hierarchy/employees/${id}/reactivate`, method: "PATCH" }),
      invalidatesTags: [TAG_TYPES.EMPLOYEES, TAG_TYPES.HIERARCHY],
    }),
  }),
});

export const {
  useGetHierarchyTreeQuery,
  useGetScopeEmployeesQuery,
  useGetEmployeeDetailQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useReactivateEmployeeMutation,
} = hierarchyApi;
