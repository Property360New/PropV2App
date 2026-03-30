import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAuth, TAG_TYPES } from "./api";
import type { Expense, ExpenseListResponse, ExpenseCategory, ExpenseSubCategory } from "../types";

interface ListExpensesParams {
  page?: number;
  limit?: number;
  category?: ExpenseCategory;
  subCategory?: ExpenseSubCategory;
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

interface CreateExpenseBody {
  category: ExpenseCategory;
  subCategory: ExpenseSubCategory;
  title: string;
  amount: number;
  description?: string;
  receiptUrl?: string;
  expenseDate: string;
}

export const expensesApi = createApi({
  reducerPath: "expensesApi",
  baseQuery: baseQueryWithAuth,
  tagTypes: [TAG_TYPES.EXPENSES],
  endpoints: (builder) => ({
    getExpenses: builder.query<ExpenseListResponse, ListExpensesParams | void>({
      query: (params) => ({ url: "/expenses", params: params || undefined }),
      providesTags: [{ type: TAG_TYPES.EXPENSES, id: "LIST" }],
    }),

    createExpense: builder.mutation<Expense, CreateExpenseBody>({
      query: (body) => ({ url: "/expenses", method: "POST", body }),
      invalidatesTags: [TAG_TYPES.EXPENSES],
    }),

    updateExpense: builder.mutation<Expense, { id: string; body: Partial<CreateExpenseBody> }>({
      query: ({ id, body }) => ({ url: `/expenses/${id}`, method: "PATCH", body }),
      invalidatesTags: [TAG_TYPES.EXPENSES],
    }),

    deleteExpense: builder.mutation<void, string>({
      query: (id) => ({ url: `/expenses/${id}`, method: "DELETE" }),
      invalidatesTags: [TAG_TYPES.EXPENSES],
    }),
  }),
});

export const {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expensesApi;