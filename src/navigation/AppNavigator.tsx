import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  ScrollView,
  BackHandler,
} from "react-native";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../lib/theme";
import { useAppSelector, useAppDispatch } from "../store";
import { restoreSession, clearAuth } from "../store/authSlice";
import { useLogoutMutation, useGetProfileQuery } from "../store/auth.api";
import { setNavigationRef } from "../store/api";

import { DrawerContext, useDrawer as _useDrawer } from "./DrawerContext";
export type { DrawerContextType } from "./DrawerContext";
export { _useDrawer as useDrawer };

// Screens
import { LoginScreen } from "../screens/LoginScreen";
import { DashboardScreen } from "../screens/DashboardScreen";
import { LeadsScreen } from "../screens/LeadsScreen";
import { LeadDetailScreen } from "../screens/LeadDetailScreen";
import { AttendanceScreen } from "../screens/AttendanceScreen";
import { TargetsScreen } from "../screens/TargetsScreen";
import { ExpensesScreen } from "../screens/ExpensesScreen";
import { InventoryScreen } from "../screens/InventoryScreen";
import { CustomersScreen } from "../screens/CustomersScreen";
import EmployeesScreen from "../screens/EmployeesScreen";
import ReportsScreen from "../screens/ReportsScreen";
import ProjectsScreen from "../screens/ProjectsScreen";
import { HierarchyScreen } from "../screens/HierarchyScreen";
import { WhatsAppTemplateScreen } from "../screens/WhatsAppTemplateScreen";
import { StaffLocationScreen } from "../screens/StaffLocationScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { NewLeadsScreen } from "../screens/NewLeadsScreen";
import { TermsScreen } from "../screens/TermsScreen";
import { PrivacyScreen } from "../screens/PrivacyScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  LeadDetail: { leadId: string; highlightedQueryId?: string };
  Notifications: undefined;
};

export type DrawerParamList = {
  DashboardTab: undefined;
  Leads: undefined;
  NewLeads: undefined;
  Attendance: undefined;
  Targets: undefined;
  Expenses: undefined;
  Inventory: undefined;
  Customers: undefined;
  Employees: undefined;
  Reports: undefined;
  Projects: undefined;
  Hierarchy: undefined;
  WhatsAppTemplate: undefined;
  StaffLocation: undefined;
  Profile: undefined;
  Terms: undefined;
  Privacy: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Exported so any component can reset to Login without useNavigation scope issues
export const rootNavigationRef = React.createRef<any>();

type Designation = string;

const MENU_ITEMS: Array<{
  name: keyof DrawerParamList;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  roles?: Designation[];
}> = [
  { name: "DashboardTab",     label: "Dashboard",     icon: "grid-outline"            },
  { name: "Leads",            label: "Lead Bank",      icon: "people-outline"          },
  { name: "NewLeads",         label: "All Leads",      icon: "list-outline"            },
  { name: "Attendance",       label: "Attendance",     icon: "calendar-outline"        },
  { name: "Targets",          label: "Targets",        icon: "trending-up-outline"     },
  { name: "Expenses",         label: "Expenses",       icon: "wallet-outline"          },
  { name: "Inventory",        label: "Inventory",      icon: "home-outline"            },
  { name: "Customers",        label: "Customers",      icon: "person-outline"          },
  { name: "Employees",        label: "Employees",      icon: "people-circle-outline",  roles: ["ADMIN", "SALES_COORDINATOR"] },
  { name: "Reports",          label: "Reports",        icon: "bar-chart-outline"       },
  { name: "Projects",         label: "Projects",       icon: "business-outline"        },
  { name: "Hierarchy",        label: "Hierarchy",      icon: "git-network-outline"     },
  { name: "WhatsAppTemplate", label: "WhatsApp",       icon: "logo-whatsapp"           },
  { name: "StaffLocation",    label: "Staff Location", icon: "location-outline",       roles: ["ADMIN"] },
  { name: "Profile",          label: "Profile",        icon: "person-circle-outline"   },
  { name: "Terms",            label: "Terms",          icon: "document-text-outline"   },
  { name: "Privacy",          label: "Privacy",        icon: "shield-outline"          },
];

const SCREENS: Record<keyof DrawerParamList, React.ComponentType<any>> = {
  DashboardTab:     DashboardScreen,
  Leads:            LeadsScreen,
  NewLeads:         NewLeadsScreen,
  Attendance:       AttendanceScreen,
  Targets:          TargetsScreen,
  Expenses:         ExpensesScreen,
  Inventory:        InventoryScreen,
  Customers:        CustomersScreen,
  Employees:        EmployeesScreen,
  Reports:          ReportsScreen,
  Projects:         ProjectsScreen,
  Hierarchy:        HierarchyScreen,
  WhatsAppTemplate: WhatsAppTemplateScreen,
  StaffLocation:    StaffLocationScreen,
  Profile:          ProfileScreen,
  Terms:            TermsScreen,
  Privacy:          PrivacyScreen,
};

const DRAWER_WIDTH = 280;

// ─── Custom Drawer Content ────────────────────────────────────────────────────

function CustomDrawerContent({
  activeScreen,
  onNavigate,
  onClose,
  onLogout,
}: {
  activeScreen: keyof DrawerParamList;
  onNavigate: (name: keyof DrawerParamList) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  const { theme, isDark, toggleTheme } = useTheme();
  const dispatch = useAppDispatch();
  const [logout] = useLogoutMutation();
  const employee = useAppSelector((s) => s.auth.employee);
  const { data: profile } = useGetProfileQuery(undefined, { skip: !employee });
  const designation = profile?.designation || employee?.designation || "";

  const filteredItems = MENU_ITEMS.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(designation);
  });

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {}
    dispatch(clearAuth());
    onClose();
    // Use the exported root ref — guaranteed to reach the root Stack navigator
    onLogout();
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.card }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View style={[styles.drawerHeader, { backgroundColor: theme.headerBg }]}>
        <View style={styles.drawerAvatar}>
          <Text style={styles.drawerAvatarText}>
            {employee?.firstName?.[0] || "U"}
          </Text>
        </View>
        <Text style={[styles.drawerName, { color: theme.headerText }]}>
          {employee?.firstName} {employee?.lastName}
        </Text>
        <Text style={[styles.drawerDesignation, { color: theme.gold }]}>
          {designation.replace(/_/g, " ")}
        </Text>
      </View>

      {/* Menu Items */}
      {filteredItems.map((item) => {
        const isActive = activeScreen === item.name;
        return (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.menuItem,
              isActive && {
                backgroundColor: isDark
                  ? "rgba(212,168,67,0.15)"
                  : "rgba(200,146,42,0.1)",
              },
            ]}
            onPress={() => onNavigate(item.name)}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={isActive ? theme.gold : theme.textSecondary}
              style={{ width: 32 }}
            />
            <Text
              style={[
                styles.menuLabel,
                {
                  color: isActive ? theme.gold : theme.textSecondary,
                  fontWeight: isActive ? "700" : "400",
                },
              ]}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Dark Mode Toggle */}
      <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}>
        <Ionicons
          name={isDark ? "sunny-outline" : "moon-outline"}
          size={22}
          color={theme.textSecondary}
          style={{ width: 32 }}
        />
        <Text style={[styles.menuLabel, { color: theme.textSecondary }]}>
          {isDark ? "Light Mode" : "Dark Mode"}
        </Text>
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
        <Ionicons
          name="log-out-outline"
          size={22}
          color={theme.danger}
          style={{ width: 32 }}
        />
        <Text style={[styles.menuLabel, { color: theme.danger }]}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Drawer Navigator ─────────────────────────────────────────────────────────

function DrawerNavigator({ onLogout }: { onLogout: () => void }) {
  const { theme } = useTheme();
  const [activeScreen, setActiveScreen] = useState<keyof DrawerParamList>("DashboardTab");
  const [isOpen, setIsOpen] = useState(false);
  const slideAnim   = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = useCallback(() => {
    setIsOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: 0,            duration: 250, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 1,            duration: 250, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, overlayAnim]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim,   { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayAnim, { toValue: 0,             duration: 200, useNativeDriver: true }),
    ]).start(() => setIsOpen(false));
  }, [slideAnim, overlayAnim]);

  const navigateTo = useCallback((name: string) => {
    if (name in SCREENS) {
      setActiveScreen(name as keyof DrawerParamList);
    }
  }, []);

  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (isOpen) { closeDrawer(); return true; }
      return false;
    });
    return () => handler.remove();
  }, [isOpen, closeDrawer]);

  const handleNavigate = (name: keyof DrawerParamList) => {
    setActiveScreen(name);
    closeDrawer();
  };

  const ActiveComponent = SCREENS[activeScreen];

  return (
    <DrawerContext.Provider
      value={{ openDrawer, closeDrawer, isOpen, navigateTo, activeScreen }}
    >
      <View style={{ flex: 1 }}>
        {/* Active Screen */}
        <ActiveComponent />

        {/* Overlay */}
        {isOpen && (
          <TouchableWithoutFeedback onPress={closeDrawer}>
            <Animated.View
              style={[
                StyleSheet.absoluteFillObject,
                { backgroundColor: "rgba(0,0,0,0.5)", opacity: overlayAnim },
              ]}
            />
          </TouchableWithoutFeedback>
        )}

        {/* Drawer Panel */}
        <Animated.View
          style={[
            styles.drawerPanel,
            {
              backgroundColor: theme.card,
              transform: [{ translateX: slideAnim }],
            },
          ]}
          pointerEvents={isOpen ? "auto" : "none"}
        >
          <CustomDrawerContent
            activeScreen={activeScreen}
            onNavigate={handleNavigate}
            onClose={closeDrawer}
            onLogout={onLogout}
          />
        </Animated.View>
      </View>
    </DrawerContext.Provider>
  );
}

// ─── App Navigator ────────────────────────────────────────────────────────────

export function AppNavigator() {
  const { theme, isDark } = useTheme();
  const dispatch        = useAppDispatch();
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    setNavigationRef(rootNavigationRef);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync("accessToken");
      if (token) dispatch(restoreSession());
      setChecking(false);
    })();
  }, []);

  // Callback passed down so DrawerNavigator → CustomDrawerContent can reset
  // to Login without needing useNavigation (which only sees the child navigator)
  const handleLogout = useCallback(() => {
    rootNavigationRef.current?.reset({ index: 0, routes: [{ name: "Login" }] });
  }, []);

  const navTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme : DefaultTheme).colors,
      background: theme.background,
      card:       theme.card,
      text:       theme.text,
      border:     theme.border,
      primary:    theme.gold,
    },
  };

  if (checking) return null;

  return (
    <NavigationContainer ref={rootNavigationRef} theme={navTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Login" component={LoginScreen} />
        ) : (
          <>
            <Stack.Screen
              name="Main"
              children={() => <DrawerNavigator onLogout={handleLogout} />}
            />
            <Stack.Screen
              name="LeadDetail"
              component={LeadDetailScreen}
              options={{
                headerShown:    true,
                headerTitle:    "Lead Details",
                headerStyle:    { backgroundColor: theme.headerBg },
                headerTintColor: theme.headerText,
              }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                headerShown:    true,
                headerTitle:    "Notifications",
                headerStyle:    { backgroundColor: theme.headerBg },
                headerTintColor: theme.headerText,
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  drawerHeader: {
    paddingVertical:   24,
    paddingHorizontal: 16,
    alignItems:        "center",
    marginBottom:      8,
  },
  drawerAvatar: {
    width:           60,
    height:          60,
    borderRadius:    30,
    backgroundColor: "#C8922A",
    justifyContent:  "center",
    alignItems:      "center",
    marginBottom:    8,
  },
  drawerAvatarText: {
    color:      "#fff",
    fontSize:   24,
    fontWeight: "700",
  },
  drawerName: {
    fontSize:   16,
    fontWeight: "700",
  },
  drawerDesignation: {
    fontSize:   12,
    fontWeight: "500",
    marginTop:  2,
  },
  drawerPanel: {
    position:     "absolute",
    top:          0,
    bottom:       0,
    left:         0,
    width:        DRAWER_WIDTH,
    elevation:    16,
    shadowColor:  "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius:  8,
  },
  menuItem: {
    flexDirection:  "row",
    alignItems:     "center",
    paddingVertical:   12,
    paddingHorizontal: 16,
    borderRadius:   8,
    marginHorizontal: 8,
    marginVertical:   1,
  },
  menuLabel: {
    fontSize:   14,
    marginLeft: 8,
  },
});