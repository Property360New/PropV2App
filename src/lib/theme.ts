import { useColorScheme } from "react-native";
import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

export const lightTheme = {
  mode: "light" as const,
  // Backgrounds
  background: "#F5F0F5",
  card: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceVariant: "#F5F0F5",
  // Text
  text: "#1A0F2E",
  textSecondary: "#666666",
  textTertiary: "#999999",
  textInverse: "#FFFFFF",
  // Brand
  mauve: "#9B5E8A",
  lavender: "#C9A8C0",
  gold: "#C8922A",
  goldLight: "#F5E6C8",
  goldDark: "#A67820",
  mauveLight: "#B87DA8",
  mauveDark: "#7A4A6C",
  lavenderLight: "#E8D8E4",
  pearl: "#F5F0F5",
  darkIndigo: "#1A0F2E",
  // Status
  danger: "#C0392B",
  dangerLight: "#F5D7D3",
  success: "#27AE60",
  successLight: "#D4EFDF",
  warning: "#F39C12",
  warningLight: "#FEF3CD",
  info: "#3498DB",
  infoLight: "#D6EAF8",
  // UI
  border: "#E8D8E4",
  divider: "#E8D8E4",
  inputBg: "#F5F0F5",
  inputBorder: "#C9A8C0",
  placeholder: "#999999",
  shadow: "rgba(0,0,0,0.08)",
  overlay: "rgba(0,0,0,0.5)",
  // Tab/Nav
  tabActive: "#C8922A",
  tabInactive: "#999999",
  tabBarBg: "#FFFFFF",
  headerBg: "#1A0F2E",
  headerText: "#FFFFFF",
  // Specific
  statusBadgeBg: "#F5E6C8",
  statusBadgeText: "#A67820",
  cardBorder: "#E8D8E4",
  skeletonBase: "#E8D8E4",
  skeletonHighlight: "#F5F0F5",
  whatsappGreen: "#25D366",
};

export const darkTheme = {
  mode: "dark" as const,
  // Backgrounds
  background: "#0D0D0D",
  card: "#1A1A2E",
  surface: "#1A1A2E",
  surfaceVariant: "#252540",
  // Text
  text: "#F0E6F0",
  textSecondary: "#A89DB8",
  textTertiary: "#7A7090",
  textInverse: "#1A0F2E",
  // Brand
  mauve: "#B87DA8",
  lavender: "#C9A8C0",
  gold: "#D4A843",
  goldLight: "#3D3020",
  goldDark: "#C8922A",
  mauveLight: "#C9A8C0",
  mauveDark: "#9B5E8A",
  lavenderLight: "#3A2E40",
  pearl: "#252540",
  darkIndigo: "#F0E6F0",
  // Status
  danger: "#E74C3C",
  dangerLight: "#3D1F1F",
  success: "#2ECC71",
  successLight: "#1F3D2A",
  warning: "#F1C40F",
  warningLight: "#3D3A1F",
  info: "#5DADE2",
  infoLight: "#1F2E3D",
  // UI
  border: "#3A2E40",
  divider: "#3A2E40",
  inputBg: "#252540",
  inputBorder: "#4A3E5A",
  placeholder: "#7A7090",
  shadow: "rgba(0,0,0,0.3)",
  overlay: "rgba(0,0,0,0.7)",
  // Tab/Nav
  tabActive: "#D4A843",
  tabInactive: "#7A7090",
  tabBarBg: "#1A1A2E",
  headerBg: "#0D0D0D",
  headerText: "#F0E6F0",
  // Specific
  statusBadgeBg: "#3D3020",
  statusBadgeText: "#D4A843",
  cardBorder: "#3A2E40",
  skeletonBase: "#252540",
  skeletonHighlight: "#3A2E40",
  whatsappGreen: "#25D366",
};

export type AppTheme = Omit<typeof lightTheme, 'mode'> & { mode: string };

interface ThemeContextType {
  theme: AppTheme;
  isDark: boolean;
  toggleTheme: () => void;
  setThemeMode: (mode: "light" | "dark" | "system") => void;
  themeMode: "light" | "dark" | "system";
}

export const ThemeContext = createContext<ThemeContextType>({
  theme: lightTheme,
  isDark: false,
  toggleTheme: () => {},
  setThemeMode: () => {},
  themeMode: "system",
});

export const useTheme = () => useContext(ThemeContext);

export { React, useState, useCallback, useMemo, useColorScheme };
