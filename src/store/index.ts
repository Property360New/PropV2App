import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import authReducer from "./authSlice";
import { authApi } from "./auth.api";
import { leadsApi } from "./leads.api";
import { bulkImportApi } from "./bulk-import.api";
import { attendanceApi } from "./attendance.api";
import { targetsApi } from "./targets.api";
import { notificationsApi } from "./notifications.api";
import { reportsApi } from "./reports.api";
import { hierarchyApi } from "./hierarchy.api";
import { expensesApi } from "./expenses.api";
import { inventoryApi } from "./inventory.api";
import { customersApi } from "./customers.api";
import { staffLocationApi } from "./staffLocation.api";
import { projectsApi } from "./projects.api";
import { termsApi } from "./terms.api";
import { whatsappApi } from "./whatsapp.api";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [authApi.reducerPath]: authApi.reducer,
    [leadsApi.reducerPath]: leadsApi.reducer,
    [bulkImportApi.reducerPath]: bulkImportApi.reducer,
    [attendanceApi.reducerPath]: attendanceApi.reducer,
    [targetsApi.reducerPath]: targetsApi.reducer,
    [notificationsApi.reducerPath]: notificationsApi.reducer,
    [reportsApi.reducerPath]: reportsApi.reducer,
    [hierarchyApi.reducerPath]: hierarchyApi.reducer,
    [expensesApi.reducerPath]: expensesApi.reducer,
    [inventoryApi.reducerPath]: inventoryApi.reducer,
    [customersApi.reducerPath]: customersApi.reducer,
    [staffLocationApi.reducerPath]: staffLocationApi.reducer,
    [projectsApi.reducerPath]: projectsApi.reducer,
    [termsApi.reducerPath]: termsApi.reducer,
    [whatsappApi.reducerPath]: whatsappApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }).concat(
      authApi.middleware,
      leadsApi.middleware,
      bulkImportApi.middleware,
      attendanceApi.middleware,
      targetsApi.middleware,
      notificationsApi.middleware,
      reportsApi.middleware,
      hierarchyApi.middleware,
      expensesApi.middleware,
      inventoryApi.middleware,
      customersApi.middleware,
      staffLocationApi.middleware,
      projectsApi.middleware,
      termsApi.middleware,
      whatsappApi.middleware,
    ),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
