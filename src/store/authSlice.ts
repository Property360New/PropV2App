import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import * as SecureStore from "expo-secure-store";
import type { Employee } from "../types";

interface AuthState {
  employee: Employee | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  employee: null,
  isAuthenticated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ employee: Employee; accessToken: string; refreshToken: string }>) {
      const { employee, accessToken, refreshToken } = action.payload;
      state.employee = employee;
      state.isAuthenticated = true;
      // Store tokens asynchronously (fire-and-forget from reducer)
      SecureStore.setItemAsync("accessToken", accessToken);
      SecureStore.setItemAsync("refreshToken", refreshToken);
    },
    restoreSession(state) {
      state.isAuthenticated = true;
    },
    setEmployee(state, action: PayloadAction<Employee>) {
      state.employee = action.payload;
    },
    clearAuth(state) {
      state.employee = null;
      state.isAuthenticated = false;
      SecureStore.deleteItemAsync("accessToken");
      SecureStore.deleteItemAsync("refreshToken");
    },
  },
});

export const { setCredentials, restoreSession, setEmployee, clearAuth } = authSlice.actions;
export default authSlice.reducer;
