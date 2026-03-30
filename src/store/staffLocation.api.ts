import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth } from "./api";
import type { StaffLocation } from "../types";

export const staffLocationApi = createApi({
  reducerPath: "staffLocationApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: ["StaffLocation"],
  endpoints: (builder) => ({
    getLatestLocations: builder.query<StaffLocation[], void>({
      query: () => "/staff-location/latest",
      providesTags: ["StaffLocation"],
    }),
    requestLocation: builder.mutation<unknown, { employeeId: string }>({
      query: (body) => ({ url: "/staff-location/request", method: "POST", body }),
    }),
  }),
});

export const { useGetLatestLocationsQuery, useRequestLocationMutation } = staffLocationApi;
