import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type {
  InventoryItem,
  PaginatedResponse,
  InventoryType,
  InventorySubType,
  BHKType,
} from "../types";

export interface ListInventoryParams {
  page?: number;
  limit?: number;
  inventoryType?: InventoryType;
  inventorySubType?: InventorySubType;
  bhk?: BHKType;
  projectId?: string;
  search?: string;
  minDemand?: number;
  maxDemand?: number;
  /** "true" = active only, "false" = inactive only, omit = all */
  isActive?: "true" | "false";
}

export interface CreateInventoryBody {
  ownerName: string;
  ownerPhone: string;
  ownerEmail?: string;
  inventoryType: InventoryType;
  inventorySubType: InventorySubType;
  projectId?: string;
  unitNo?: string;
  towerNo?: string;
  bhk?: BHKType;
  size?: number;
  facing?: string;
  floor?: string;
  demand?: number;
  hasTenant?: boolean;
  hasParking?: boolean;
  expectedVisitTime?: string;
  availableDate?: string;
  furnishingType?: string;
  inventoryStatus?: string;
}

export const inventoryApi = createApi({
  reducerPath: "inventoryApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.INVENTORY],
  endpoints: (builder) => ({
    getInventory: builder.query<
      PaginatedResponse<InventoryItem>,
      ListInventoryParams | void
    >({
      query: (params) => ({ url: "/inventory", params: params || undefined }),
      providesTags: [{ type: TAG_TYPES.INVENTORY, id: "LIST" }],
    }),

    getInventoryDetail: builder.query<InventoryItem, string>({
      query: (id) => `/inventory/${id}`,
      providesTags: (_r, _e, id) => [{ type: TAG_TYPES.INVENTORY, id }],
    }),

    createInventory: builder.mutation<InventoryItem, CreateInventoryBody>({
      query: (body) => ({ url: "/inventory", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.INVENTORY],
    }),

    updateInventory: builder.mutation<
      InventoryItem,
      { id: string; body: Partial<CreateInventoryBody> }
    >({
      query: ({ id, body }) => ({ url: `/inventory/${id}`, method: "PATCH", body }),
      invalidatesTags: [TAG_TYPES.INVENTORY],
    }),

    /** Toggle active / inactive without a full update payload */
    toggleInventoryStatus: builder.mutation<
      InventoryItem,
      { id: string; isActive: boolean }
    >({
      query: ({ id, isActive }) => ({
        url: `/inventory/${id}/status`,
        method: "PATCH",
        body: { isActive },
      }),
      invalidatesTags: [TAG_TYPES.INVENTORY],
    }),

    deleteInventory: builder.mutation<void, string>({
      query: (id) => ({ url: `/inventory/${id}`, method: "DELETE" }),
      invalidatesTags: [TAG_TYPES.INVENTORY],
    }),
  }),
});

export const {
  useGetInventoryQuery,
  useGetInventoryDetailQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useToggleInventoryStatusMutation,
  useDeleteInventoryMutation,
} = inventoryApi;