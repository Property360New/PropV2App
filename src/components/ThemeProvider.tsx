import React, { useState, useCallback, useMemo } from "react";
import { useColorScheme } from "react-native";
import { ThemeContext, lightTheme, darkTheme } from "../lib/theme";

interface Props {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<Props> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");

  const isDark = useMemo(() => {
    if (themeMode === "system") return systemScheme === "dark";
    return themeMode === "dark";
  }, [themeMode, systemScheme]);

  const theme = useMemo(() => (isDark ? darkTheme : lightTheme), [isDark]);

  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => {
      if (prev === "light") return "dark";
      if (prev === "dark") return "light";
      return isDark ? "light" : "dark";
    });
  }, [isDark]);

  const value = useMemo(
    () => ({ theme, isDark, toggleTheme, setThemeMode, themeMode }),
    [theme, isDark, toggleTheme, themeMode]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
