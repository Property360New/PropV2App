// ============================================================
// src/store/leads.api.ts
// ============================================================

import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type {
  TabCounts, NotificationStripItem, TodaysFollowup,
  Lead, LeadStatus, LeadType, FurnishingType, PaginatedResponse,
} from "../types";

// ─── Param interfaces ─────────────────────────────────────────────────────────

interface FindTabParams {
  search: string;
  assignedToId?: string;
}
interface LeadTabParams {
  page?: number;
  limit?: number;
  search?: string;
  assignedToId?: string;
  createdById?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface CreateLeadBody {
  name: string;
  phone: string;
  email?: string;
  phone2?: string;
  address?: string;
  source?: string;
  type?: string;
  assignedToId?: string;
  projectId?: string;
  clientBirthday?: string | null;
  clientMarriageAnniversary?: string | null;
}

interface FindTabResult {
  tab: string;
  leadId: string | null;
  tabCounts: Record<string, number>;
}

interface LeadCelebration {
  type: 'BIRTHDAY' | 'ANNIVERSARY';
  isLead: true;
  leadId: string;
  name: string;
  phone: string;
}


export interface CreateQueryBody {
  projectName: string;
  status: LeadStatus;
  remark?: string;
  followUpDate?: string;
  visitDate?: string;
  meetingDate?: string;
  dealDoneDate?: string;
  expVisitDate?: string;
  shiftingDate?: string;
  leadType?: string;
  bhk?: string;
  size?: number;
  floor?: string;
  location?: string;
  purpose?: string;
  furnishingType?: string;
  projectId?: string;
  budgetMin?: number;
  budgetMax?: number;
  budgetUnit?: string;
  visitDoneById?: string;
  meetingDoneById?: string;
  closingAmount?: number;
  unitNo?: string;
  reason?: string;
  leadActualSlab?: number;
  discount?: number;
  actualRevenue?: number;
  incentiveSlab?: number;
  sellRevenue?: number;
}

export type UpdateQueryBody = Partial<CreateQueryBody>;

export interface CreateRemarkBody {
  text: string;
}

// ─── QueryTabRow shape ────────────────────────────────────────────────────────

interface QueryTabRow {
  queryId: string;
  status: LeadStatus;
  callStatus: LeadStatus;
  remark: string | null;
  isAutoRemark: boolean;
  followUpDate: string | null;
  visitDate: string | null;
  meetingDate: string | null;
  dealDoneDate: string | null;
  expVisitDate: string | null;
  shiftingDate: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetUnit: string | null;
  leadType: LeadType | null;
  bhk: string | null;
  size: number | null;
  floor: string | null;
  location: string | null;
  purpose: string | null;
  furnishingType: FurnishingType | null;
  closingAmount: number | null;
  unitNo: string | null;
  reason: string | null;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string; designation?: string };
  visitDoneBy?: { id: string; firstName: string; lastName: string } | null;
  meetingDoneBy?: { id: string; firstName: string; lastName: string } | null;
  isHighlighted: boolean;
  lead: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    phone2: string | null;
    source: string | null;
    type: string | null;
    // FIX: backend now returns createdAt on the lead
    createdAt?: string | null;
    assignedTo?: { id: string; firstName: string; lastName: string; designation?: string } | null;
    project?: { id: string; name: string } | null;
    isHot: boolean;
    lastActivityAt: string | null;
    allQueries: Array<{
      id: string;
      status: LeadStatus;
      callStatus: LeadStatus;
      remark: string | null;
      isAutoRemark: boolean;
      followUpDate: string | null;
      visitDate: string | null;
      meetingDate: string | null;
      dealDoneDate: string | null;
      expVisitDate: string | null;
      shiftingDate: string | null;
      budgetMin: number | null;
      budgetMax: number | null;
      budgetUnit: string | null;
      leadType: LeadType | null;
      bhk: string | null;
      size: number | null;
      floor: string | null;
      location: string | null;
      purpose: string | null;
      furnishingType: FurnishingType | null;
      closingAmount: number | null;
      unitNo: string | null;
      reason: string | null;
      projectId: string | null;
      createdAt: string;
      createdBy?: { id: string; firstName: string; lastName: string };
      visitDoneBy?: { id: string; firstName: string; lastName: string } | null;
      meetingDoneBy?: { id: string; firstName: string; lastName: string } | null;
      remarks?: Array<{
        id: string;
        text: string;
        createdAt: string;
        createdBy: { id: string; firstName: string; lastName: string };
      }>;
    }>;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * FIX: Total calls = number of queries + number of extra remarks across all queries.
 * When you add a query, that counts as 1 call. Any additional remarks on that
 * query (remarks array) count as extra calls beyond the initial one.
 * So: totalCalls = queries.length + sum(query.remarks.length for each query)
 */
function computeTotalCalls(allQueries: QueryTabRow["lead"]["allQueries"]): number {
  if (!allQueries || allQueries.length === 0) return 0;
  return allQueries.reduce((total, q) => {
    // Each query = 1 call; each extra remark on the query = 1 more call
    return total + 1 + (q.remarks?.length ?? 0);
  }, 0);
}

/**
 * FIX: lastCalledAt should be the most recent activity:
 * max of all query createdAt and all remark createdAt
 */
function computeLastCalledAt(allQueries: QueryTabRow["lead"]["allQueries"]): string {
  if (!allQueries || allQueries.length === 0) return "";
  let latest = "";
  for (const q of allQueries) {
    if (q.createdAt > latest) latest = q.createdAt;
    for (const r of q.remarks ?? []) {
      if (r.createdAt > latest) latest = r.createdAt;
    }
  }
  return latest;
}

// ─── Flatten QueryTabRow → Lead shape for the table ───────────────────────────

function flattenQueryRow(row: QueryTabRow): Lead {
  const lead = row.lead;
  const allQueries = lead.allQueries || [];

  return {
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    phone2: lead.phone2 || null,
    email: lead.email || null,
    address: null,
    source: lead.source || null,
    type: lead.type || null,
    assignedToId: lead.assignedTo?.id || "",
    assignedTo: lead.assignedTo
      ? { id: lead.assignedTo.id, firstName: lead.assignedTo.firstName, lastName: lead.assignedTo.lastName }
      : undefined,
    createdById: "",
    projectId: lead.project?.id || null,
    project: lead.project || null,
    // FIX: use lead.createdAt from the backend response
    createdAt: lead.createdAt || "",
    updatedAt: "",
    queries: allQueries.map((q) => ({
      id: q.id,
      status: q.status,
      callStatus: q.status,
      remark: q.remark,
      isAutoRemark: q.isAutoRemark,
      followUpDate: q.followUpDate,
      visitDate: q.visitDate,
      meetingDate: q.meetingDate,
      dealDoneDate: q.dealDoneDate,
      expVisitDate: q.expVisitDate,
      shiftingDate: q.shiftingDate,
      projectId: q.projectId,
      budgetMin: q.budgetMin,
      budgetMax: q.budgetMax,
      budgetUnit: q.budgetUnit,
      leadType: q.leadType as LeadType | null,
      bhk: q.bhk,
      size: q.size,
      floor: q.floor,
      location: q.location,
      purpose: q.purpose,
      furnishingType: q.furnishingType as FurnishingType | null,
      closingAmount: q.closingAmount,
      unitNo: q.unitNo,
      reason: q.reason,
      leadActualSlab: null,
      discount: null,
      actualRevenue: null,
      incentiveSlab: null,
      sellRevenue: null,
      createdAt: q.createdAt,
      createdBy: q.createdBy,
      visitDoneBy: q.visitDoneBy,
      meetingDoneBy: q.meetingDoneBy,
      remarks: q.remarks,
      // FIX: calls per query = 1 (the query itself) + remarks on it
      callCount: 1 + (q.remarks?.length ?? 0),
    })),
    latestQuery: {
      id: row.queryId,
      status: row.status,
      callStatus: row.status,
      remark: row.remark,
      followUpDate: row.followUpDate,
      visitDate: row.visitDate,
      meetingDate: row.meetingDate,
      dealDoneDate: row.dealDoneDate,
      expVisitDate: row.expVisitDate,
      shiftingDate: row.shiftingDate,
      projectId: null,
      budgetMin: row.budgetMin,
      budgetMax: row.budgetMax,
      budgetUnit: row.budgetUnit,
      leadType: row.leadType as LeadType | null,
      bhk: row.bhk,
      size: row.size,
      floor: row.floor,
      location: row.location,
      purpose: row.purpose,
      furnishingType: row.furnishingType as FurnishingType | null,
      closingAmount: row.closingAmount,
      unitNo: row.unitNo,
      reason: row.reason,
      leadActualSlab: null,
      discount: null,
      actualRevenue: null,
      incentiveSlab: null,
      sellRevenue: null,
      createdAt: row.createdAt,
      createdBy: row.createdBy,
      visitDoneBy: row.visitDoneBy,
      meetingDoneBy: row.meetingDoneBy,
    },
    // FIX: totalCalls = queries + extra remarks
    totalCalls: (row as any).remarkCount != null
      ? 1 + (row as any).remarkCount   // highlighted query calls
      : 0,
    lastCalledAt: row.createdAt ?? "",
    // Store the highlighted queryId so the detail panel can use it
    highlightedQueryId: row.queryId,
  };
}

// ─── Response normaliser ──────────────────────────────────────────────────────

function normalisePaginatedResponse(
  raw: any,
  mapper?: (item: any) => Lead,
): PaginatedResponse<Lead> {
  let rows: any[] = [];
  let paginationMeta: any = null;

  if (raw?.success !== undefined && raw?.data?.data !== undefined) {
    rows = raw.data.data ?? [];
    paginationMeta = raw.data.pagination ?? raw.data.meta ?? null;
  } else if (Array.isArray(raw?.data) && raw?.pagination) {
    rows = raw.data;
    paginationMeta = raw.pagination;
  } else if (Array.isArray(raw?.data) && raw?.meta) {
    rows = raw.data;
    paginationMeta = raw.meta;
  } else if (raw?.data?.data !== undefined && (raw?.data?.pagination || raw?.data?.meta)) {
    rows = raw.data.data ?? [];
    paginationMeta = raw.data.pagination ?? raw.data.meta ?? null;
  }

  if (!paginationMeta) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[leadsApi] normalisePaginatedResponse: unrecognised shape", raw);
    }
    return { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } };
  }

  const items: Lead[] = mapper ? rows.map(mapper) : (rows as Lead[]);
  return {
    data: items,
    meta: {
      page: paginationMeta.page ?? 1,
      limit: paginationMeta.limit ?? 20,
      total: paginationMeta.total ?? items.length,
      totalPages: paginationMeta.totalPages ?? 1,
    },
  };
}

/**
 * FIX: Deduplicate query-tab rows by lead.id, keeping the row whose queryId
 * matches the highlighted (current-tab) query. This means the table shows
 * 1 row per lead, and the `highlightedQueryId` field tells the detail panel
 * which query to highlight.
 *
 * Also fixes the meta.total to reflect unique lead count, not query count.
 */
function deduplicateByLead(result: PaginatedResponse<Lead>): PaginatedResponse<Lead> {
  const seen = new Map<string, Lead>();
  for (const lead of result.data) {
    if (!seen.has(lead.id)) {
      seen.set(lead.id, lead);
    }
    // If we've seen this lead before, keep the entry — the first one encountered
    // will have the most-recent query as latestQuery (backend orders by createdAt desc)
  }
  const deduped = Array.from(seen.values());
  return {
    data: deduped,
    meta: {
      ...result.meta,
      total: deduped.length, // approximate; backend should ideally return distinct-lead count
    },
  };
}

// ─── RTK Query API slice ──────────────────────────────────────────────────────

export const leadsApi = createApi({
  reducerPath: "leadsApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [
    TAG_TYPES.TAB_COUNTS,
    TAG_TYPES.NOTIFICATION_STRIP,
    TAG_TYPES.TODAYS_FOLLOWUPS,
    TAG_TYPES.LEADS,
  ],
  endpoints: (builder) => ({
    getTabCounts: builder.query<TabCounts, { search?: string; assignedToId?: string } | void>({
      query: (params) => ({
        url: '/leads/tab-counts',
        params: params ?? undefined,
      }),
      providesTags: (_r, _e, arg) => [
        {
          type: TAG_TYPES.TAB_COUNTS,
          id: [arg?.search, arg?.assignedToId].filter(Boolean).join('_') || 'LIST',
        },
      ],
    }),

    findLeadTab: builder.query<FindTabResult, FindTabParams>({
      query: ({ search, assignedToId }) => ({
        url: '/leads/find-tab',
        params: { search, ...(assignedToId ? { assignedToId } : {}) },
      }),
    }),

    getNotificationStrip: builder.query<NotificationStripItem[], void>({
      query: () => "/leads/notification-strip",
      providesTags: [{ type: TAG_TYPES.NOTIFICATION_STRIP, id: "LIST" }],
    }),

    getTodaysFollowups: builder.query<TodaysFollowup[], void>({
      query: () => "/leads/todays-followups",
      providesTags: [{ type: TAG_TYPES.TODAYS_FOLLOWUPS, id: "LIST" }],
    }),

    getFreshLeads: builder.query<PaginatedResponse<Lead>, LeadTabParams | void>({
      query: (params) => ({ url: "/leads/tab/fresh", params: params || undefined }),
      transformResponse: (raw: any): PaginatedResponse<Lead> => normalisePaginatedResponse(raw),
      providesTags: [{ type: TAG_TYPES.LEADS, id: "FRESH" }],
    }),

    getAllLeads: builder.query<PaginatedResponse<Lead>, LeadTabParams & { createdById?: string }>({
      query: (params) => ({ url: '/leads/all', params }),
      transformResponse: (raw: any): PaginatedResponse<Lead> => {
        console.log('[getAllLeads] raw:', JSON.stringify(raw).slice(0, 200)); // ← add temporarily
        const data = raw?.data?.data ?? raw?.data ?? [];
        const pagination = raw?.data?.pagination ?? raw?.pagination ?? null;
        return {
          data: Array.isArray(data) ? data : [],
          meta: pagination
            ? { page: pagination.page, limit: pagination.limit, total: pagination.total, totalPages: pagination.totalPages }
            : { page: 1, limit: 20, total: 0, totalPages: 1 },
        };
      },
      providesTags: [{ type: TAG_TYPES.LEADS, id: 'ALL' }],
    }),

    getLeadsByStatus: builder.query<PaginatedResponse<Lead>, { status: string } & LeadTabParams>({
      query: ({ status, ...params }) => ({ url: `/leads/tab/${status}`, params }),
      transformResponse: (raw: any): PaginatedResponse<Lead> => {
        const rows: any[] =
          Array.isArray(raw?.data?.data) ? raw.data.data
            : Array.isArray(raw?.data) ? raw.data
              : [];
        const isQueryTab = rows.length > 0 && "lead" in rows[0] && "queryId" in rows[0];
        const base = normalisePaginatedResponse(raw, isQueryTab ? flattenQueryRow : undefined);
        // FIX: deduplicate so 1 row per lead, not 1 row per query
        return isQueryTab ? deduplicateByLead(base) : base;
      },
      providesTags: (_r, _e, arg) => [{ type: TAG_TYPES.LEADS, id: arg.status }],
    }),

    getLeadDetail: builder.query<Lead, string>({
      query: (id) => `/leads/${id}`,
      transformResponse: (raw: any): Lead => {
        const lead = raw?.data ?? raw;
        // FIX: compute totalCalls and per-query callCount from detail response too
        if (lead?.queries) {
          lead.totalCalls = lead.queries.reduce((total: number, q: any) => {
            return total + 1 + (q.remarks?.length ?? 0);
          }, 0);
          lead.queries = lead.queries.map((q: any) => ({
            ...q,
            callCount: 1 + (q.remarks?.length ?? 0),
          }));
        }
        return lead;
      },
      providesTags: (_r, _e, id) => [{ type: TAG_TYPES.LEADS, id }],
    }),

    createLead: builder.mutation<Lead, CreateLeadBody>({
      query: (body) => ({ url: "/leads", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    updateLead: builder.mutation<Lead, { id: string; body: Partial<CreateLeadBody> }>({
      query: ({ id, body }) => ({ url: `/leads/${id}`, method: "PATCH", body }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    addQuery: builder.mutation<unknown, { leadId: string; body: CreateQueryBody }>({
      query: ({ leadId, body }) => ({ url: `/leads/${leadId}/queries`, method: "POST", body }),
      invalidatesTags: [TAG_TYPES.LEADS, TAG_TYPES.TAB_COUNTS, TAG_TYPES.TODAYS_FOLLOWUPS],
    }),

    updateQuery: builder.mutation<unknown, { leadId: string; queryId: string; body: UpdateQueryBody }>({
      query: ({ leadId, queryId, body }) => ({
        url: `/leads/${leadId}/queries/${queryId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    addRemark: builder.mutation<unknown, { leadId: string; queryId: string; body: CreateRemarkBody }>({
      query: ({ leadId, queryId, body }) => ({
        url: `/leads/${leadId}/queries/${queryId}/remarks`,
        method: "POST",
        body,
      }),
      invalidatesTags: (_r, _e, arg) => [{ type: TAG_TYPES.LEADS, id: arg.leadId }],
    }),

    assignLead: builder.mutation<Lead, { id: string; assignedToId: string }>({
      query: ({ id, assignedToId }) => ({
        url: `/leads/${id}/assign`,
        method: "PATCH",
        body: { assignedToId },
      }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    bulkAssign: builder.mutation<Lead[], { leadIds: string[]; assignedToId: string }>({
      query: (body) => ({ url: "/leads/bulk-assign", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    deleteLead: builder.mutation<void, string>({
      query: (id) => ({ url: `/leads/${id}/delete`, method: "PATCH" }),
      invalidatesTags: [TAG_TYPES.LEADS, { type: TAG_TYPES.TAB_COUNTS, id: 'LIST' }],
    }),

    getTodayCelebrations: builder.query<LeadCelebration[], void>({
      query: () => '/leads/today-celebrations',
      providesTags: [{ type: TAG_TYPES.LEADS, id: 'CELEBRATIONS' }],
    }),
  }),
});

export const {
  useGetTabCountsQuery,
  useGetNotificationStripQuery,
  useGetTodaysFollowupsQuery,
  useGetFreshLeadsQuery,
  useGetLeadsByStatusQuery,
  useGetLeadDetailQuery,
  useCreateLeadMutation,
  useUpdateLeadMutation,
  useAddQueryMutation,
  useUpdateQueryMutation,
  useAddRemarkMutation,
  useAssignLeadMutation,
  useBulkAssignMutation,
  useDeleteLeadMutation,
  useFindLeadTabQuery,
  useGetAllLeadsQuery,
  useGetTodayCelebrationsQuery
} = leadsApi;