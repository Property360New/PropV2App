import { createContext, useContext } from "react";

export interface DrawerContextType {
  openDrawer: () => void;
  closeDrawer: () => void;
  isOpen: boolean;
  navigateTo: (screen: string) => void;
  activeScreen: string;
}

export const DrawerContext = createContext<DrawerContextType>({
  openDrawer: () => {},
  closeDrawer: () => {},
  isOpen: false,
  navigateTo: () => {},
  activeScreen: "DashboardTab",
});

export const useDrawer = () => useContext(DrawerContext);