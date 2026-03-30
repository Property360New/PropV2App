import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
  Dimensions,
  Animated,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import { useTheme } from "../lib/theme";
import { useAppSelector } from "../store";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { useDrawer } from "../navigation/DrawerContext";
import {
  useGetTabCountsQuery,
  useGetTodaysFollowupsQuery,
  useGetNotificationStripQuery,
} from "../store/leads.api";
import { useGetProfileQuery } from "../store/auth.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import {
  useGetTodayAttendanceQuery,
  useCheckInMutation,
  useCheckOutMutation,
} from "../store/attendance.api";
import { useGetTargetSummaryQuery } from "../store/targets.api";
import { useGetDailyCallActivityQuery } from "../store/reports.api";
import { useGetNotificationsQuery } from "../store/notifications.api";
import type { TodaysFollowup, LeadStatus, ScopeEmployee } from "../types";
import { BirthdayCelebration } from "../components/BirthdayCelebration";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";
import { useGetTodayCelebrationsQuery } from "../store/leads.api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ─── Status Config (static — no theme dependency) ────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
}> = {
  FRESH:         { label: "Fresh",         icon: "sparkles",              color: "#3498DB", bg: "rgba(52,152,219,0.12)"  },
  FOLLOW_UP:     { label: "Follow Up",     icon: "call-outline",          color: "#9B59B6", bg: "rgba(155,89,182,0.12)"  },
  VISIT_DONE:    { label: "Visit Done",    icon: "location-outline",      color: "#1ABC9C", bg: "rgba(26,188,156,0.12)"  },
  MEETING_DONE:  { label: "Meeting",       icon: "people-outline",        color: "#E67E22", bg: "rgba(230,126,34,0.12)"  },
  RINGING:       { label: "Ringing",       icon: "phone-portrait-outline",color: "#2ECC71", bg: "rgba(46,204,113,0.12)"  },
  CALL_BACK:     { label: "Call Back",     icon: "arrow-undo-outline",    color: "#F39C12", bg: "rgba(243,156,18,0.12)"  },
  DEAL_DONE:     { label: "Deal Done",     icon: "trophy-outline",        color: "#C9A84C", bg: "rgba(201,168,76,0.15)"  },
  NOT_INTERESTED:{ label: "Not Interested",icon: "close-circle-outline",  color: "#E74C3C", bg: "rgba(231,76,60,0.12)"   },
  HOT_PROSPECT:  { label: "Hot Prospect",  icon: "flame-outline",         color: "#FF6B35", bg: "rgba(255,107,53,0.12)"  },
  SUSPECT:       { label: "Suspect",       icon: "help-circle-outline",   color: "#7F8C8D", bg: "rgba(127,140,141,0.12)" },
  SWITCH_OFF:    { label: "Switch Off",    icon: "power-outline",         color: "#7F8C8D", bg: "rgba(90,88,86,0.12)"    },
  WRONG_NUMBER:  { label: "Wrong No.",     icon: "alert-circle-outline",  color: "#E74C3C", bg: "rgba(231,76,60,0.12)"   },
};

const KPI_STATUSES: LeadStatus[] = [
  "FRESH","FOLLOW_UP","VISIT_DONE","MEETING_DONE",
  "DEAL_DONE","HOT_PROSPECT","RINGING","CALL_BACK",
  "NOT_INTERESTED","SUSPECT","SWITCH_OFF","WRONG_NUMBER",
];

const PRIORITY_STATUSES: LeadStatus[] = [
  "FRESH","HOT_PROSPECT","DEAL_DONE","FOLLOW_UP","VISIT_DONE","MEETING_DONE",
];

const QUICK_ACCESS_ITEMS = [
  { label: "Lead Bank",  icon: "people-outline"      as const, route: "Leads"      },
  { label: "Attendance", icon: "calendar-outline"    as const, route: "Attendance"  },
  { label: "Targets",    icon: "trending-up-outline" as const, route: "Targets"     },
  { label: "Reports",    icon: "bar-chart-outline"   as const, route: "Reports"     },
  { label: "Customers",  icon: "person-outline"      as const, route: "Customers"   },
  { label: "Inventory",  icon: "home-outline"        as const, route: "Inventory"   },
  { label: "Expenses",   icon: "wallet-outline"      as const, route: "Expenses"    },
  { label: "Projects",   icon: "business-outline"    as const, route: "Projects"    },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
  if (value >= 100000)   return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000)     return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "Property360CRM/1.0" }, signal: AbortSignal.timeout(5_000) }
    );
    if (!res.ok) return "Address not available";
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      return [a.road || a.pedestrian || a.footway, a.suburb || a.neighbourhood,
              a.city || a.town || a.village || a.county, a.state]
        .filter(Boolean).join(", ");
    }
    return data.display_name ?? "Address not available";
  } catch {
    return "Address not available";
  }
}

// ─── Animated Stat Card ───────────────────────────────────────────────────────

const AnimatedStatCard = ({ label, value, icon, color, bg, cardBg, cardBorder, onPress }: {
  label: string; value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string; bg: string; cardBg: string; cardBorder: string;
  onPress?: () => void;
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn  = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, tension: 300, friction: 20 }).start();
  const handlePressOut = () => Animated.spring(scale, { toValue: 1,    useNativeDriver: true, tension: 300, friction: 20 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.statCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        <View style={[styles.statIconWrap, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text style={[styles.statValue, { color: color }]}>{value}</Text>
        <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const DashboardScreen = () => {
  const navigation  = useNavigation<any>();
  const { navigateTo, openDrawer } = useDrawer();
  const { theme, isDark } = useTheme();
  const employee = useAppSelector((s) => s.auth.employee);

  // ── State ─────────────────────────────────────────────────
  const [selectedEmployee,       setSelectedEmployee]       = useState<string | undefined>();
  const [showStaffPicker,        setShowStaffPicker]        = useState(false);
  const [followupModalVisible,   setFollowupModalVisible]   = useState(false);
  const [followupModalDismissed, setFollowupModalDismissed] = useState(false);
  const [refreshing,             setRefreshing]             = useState(false);
  const [kraMonth,               setKraMonth]               = useState(new Date().getMonth() + 1);
  const [kraYear,                setKraYear]                = useState(new Date().getFullYear());
  const [selectedDay,            setSelectedDay]            = useState<{ date: string; callsMade: number; callTarget: number } | null>(null);
  const [showCelebration,        setShowCelebration]        = useState(true);
  const [activeTab,              setActiveTab]              = useState<"pipeline" | "activity">("pipeline");
  const { data: leadCelebrations = [] } = useGetTodayCelebrationsQuery();

  // ── Queries ───────────────────────────────────────────────
  const { data: profile }        = useGetProfileQuery();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const { data: todayAttendance, refetch: refetchAttendance } = useGetTodayAttendanceQuery();
  const [checkIn,  { isLoading: checkingIn  }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  const tabCountParams = useMemo(() => {
    const p: { assignedToId?: string } = {};
    if (selectedEmployee) p.assignedToId = selectedEmployee;
    return p;
  }, [selectedEmployee]);

  const { data: tabCounts,        isFetching: tabCountsLoading, refetch: refetchTabCounts } = useGetTabCountsQuery(tabCountParams);
  const { data: todaysFollowups,  refetch: refetchFollowups }  = useGetTodaysFollowupsQuery();
  const { data: notificationStrip,refetch: refetchStrip }      = useGetNotificationStripQuery();
  const { data: targetSummary }    = useGetTargetSummaryQuery({ period: "1M", employeeId: selectedEmployee });
  const { data: dailyCallActivity} = useGetDailyCallActivityQuery({ month: kraMonth, year: kraYear, employeeId: selectedEmployee });
  const { data: notifData }        = useGetNotificationsQuery({ page: 1, limit: 100 });

  // ── Derived ───────────────────────────────────────────────
  const isManager = useMemo(() => {
    const d = profile?.designation || employee?.designation;
    return d && !["SALES_EXECUTIVE"].includes(d);
  }, [profile, employee]);

  const isCheckedIn  = !!todayAttendance?.checkInAt;
  const isCheckedOut = !!todayAttendance?.checkOutAt;

  const selectedEmployeeName = useMemo(() => {
    if (!selectedEmployee) return "All Team Members";
    const emp = scopeEmployees?.find((e) => e.id === selectedEmployee);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Selected";
  }, [selectedEmployee, scopeEmployees]);

  const totalLeads = useMemo(() => {
    if (!tabCounts) return 0;
    return KPI_STATUSES.reduce((sum, s) => sum + (tabCounts[s] ?? 0), 0);
  }, [tabCounts]);

  const conversionRate = useMemo(() => {
    if (!tabCounts || totalLeads === 0) return "0%";
    return `${(((tabCounts["DEAL_DONE"] ?? 0) / totalLeads) * 100).toFixed(1)}%`;
  }, [tabCounts, totalLeads]);

  const alertTickerText = useMemo(() => {
    if (!notificationStrip || notificationStrip.length === 0) return null;
    const salesPeople = notificationStrip.filter((n) => n.hasSale);
    if (salesPeople.length > 0) {
      return `🏆  Deal closed by ${salesPeople.map((s) => s.employeeName).join(", ")}`;
    }
    return null;
  }, [notificationStrip]);

  const celebrations = useMemo(() => {
  const result: Array<{
    type: "birthday" | "anniversary";
    name: string;
    phone?: string;
    employeeId?: string;
    source: "employee" | "client";   // ← new field
  }> = [];

  // — your existing profile block (unchanged, just add source) —
  if (profile) {
    const today = new Date().toISOString().slice(5, 10);
    if (profile.birthday?.slice(5, 10) === today)
      result.push({
        type: "birthday",
        name: `${profile.firstName} ${profile.lastName ?? ""}`.trim(),
        phone: profile.phone ?? undefined,
        source: "employee",
      });
    if (profile.marriageAnniversary?.slice(5, 10) === today)
      result.push({
        type: "anniversary",
        name: `${profile.firstName} ${profile.lastName ?? ""}`.trim(),
        phone: profile.phone ?? undefined,
        source: "employee",
      });
  }

  // — your existing notifData block (unchanged, just add source) —
  for (const n of (notifData?.data ?? [])) {
    if (n.type === "BIRTHDAY" || n.type === "ANNIVERSARY") {
      const empId = (n.metadata as any)?.employeeId;
      if (empId && empId === employee?.id) continue;
      const empName = n.recipientEmployee
        ? `${n.recipientEmployee.firstName} ${n.recipientEmployee.lastName ?? ""}`.trim()
        : n.title.replace(/^(Happy Birthday|Happy Anniversary)[!,]?\s*/i, "").trim() || "Team Member";
      result.push({
        type: n.type === "BIRTHDAY" ? "birthday" : "anniversary",
        name: empName,
        employeeId: empId,
        source: "employee",
      });
    }
  }

  // — NEW: client/lead celebrations —
  for (const c of leadCelebrations) {
    result.push({
      type: c.type === "BIRTHDAY" ? "birthday" : "anniversary",
      name: c.name,
      phone: c.phone,
      source: "client",
    });
  }

  return result;
}, [profile, employee, notifData, leadCelebrations]);

  // ── Effects ───────────────────────────────────────────────
  useEffect(() => {
    if (todaysFollowups && todaysFollowups.length > 0 && !followupModalDismissed) {
      setFollowupModalVisible(true);
    }
  }, [todaysFollowups, followupModalDismissed]);

  // ── Attendance handlers ───────────────────────────────────
  const getLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission Denied", "Location required for attendance."); return null; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    } catch {
      Alert.alert("Error", "Could not get location.");
      return null;
    }
  };

  const handleCheckIn = async () => {
    const coords = await getLocation();
    if (!coords) return;
    const address = await reverseGeocode(coords.latitude, coords.longitude);
    try {
      await checkIn({ ...coords, address }).unwrap();
      refetchAttendance();
    } catch (err: any) {
      Alert.alert("Check-In Failed", err?.data?.message || "Try again.");
    }
  };

  const handleCheckOut = async () => {
    const coords = await getLocation();
    if (!coords) return;
    const address = await reverseGeocode(coords.latitude, coords.longitude);
    try {
      await checkOut({ ...coords, address }).unwrap();
      refetchAttendance();
    } catch (err: any) {
      Alert.alert("Check-Out Failed", err?.data?.message || "Try again.");
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchTabCounts(), refetchFollowups(), refetchStrip(), refetchAttendance()]);
    setRefreshing(false);
  }, [refetchTabCounts, refetchFollowups, refetchStrip, refetchAttendance]);

  const navigateToLead = (leadId: string) => {
    setFollowupModalVisible(false);
    navigation.navigate("LeadDetail", { leadId });
  };

  // ── KRA calendar data ─────────────────────────────────────
  const kraData = useMemo(() => {
    const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const DAY_LABELS  = ["S","M","T","W","T","F","S"];
    const firstDay    = new Date(kraYear, kraMonth - 1, 1).getDay();
    const daysInMonth = new Date(kraYear, kraMonth, 0).getDate();
    const todayStr    = new Date().toISOString().slice(0, 10);
    const bucketMap: Record<string, { callsMade: number; callTarget: number }> = {};
    dailyCallActivity?.buckets?.forEach((b) => { bucketMap[b.date] = { callsMade: b.callsMade, callTarget: b.callTarget }; });
    const cells: Array<{ day: number | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null });
    for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
    while (cells.length % 7 !== 0) cells.push({ day: null });
    const rows: Array<Array<{ day: number | null }>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { MONTH_NAMES, DAY_LABELS, todayStr, bucketMap, rows };
  }, [kraYear, kraMonth, dailyCallActivity]);

  // ── Theme-derived color shortcuts ────────────────────────────────────────────
  // These keep JSX clean while remaining fully theme-reactive.
  const C = {
    bg:          theme.background,
    card:        theme.card,
    cardBorder:  theme.cardBorder,
    surface:     theme.surfaceVariant,        // SURFACE_3 equivalent
    text:        theme.text,
    textSub:     theme.textSecondary,
    textTert:    theme.textTertiary,
    gold:        theme.gold,
    goldLight:   theme.goldLight,             // translucent gold fill
    goldDark:    theme.goldDark,
    goldBg:      isDark ? "rgba(201,168,76,0.08)"  : "rgba(201,168,76,0.10)",
    goldBgStrong:isDark ? "rgba(201,168,76,0.15)"  : "rgba(201,168,76,0.18)",
    goldBorder:  isDark ? "rgba(201,168,76,0.25)"  : "rgba(201,168,76,0.35)",
    border:      theme.cardBorder,
    success:     theme.success,
    successBg:   theme.successLight,
    danger:      theme.danger,
    dangerBg:    theme.dangerLight,
    warning:     theme.warning  ?? "#F39C12",
    warningBg:   theme.warningLight ?? (isDark ? "rgba(243,156,18,0.10)" : "rgba(243,156,18,0.12)"),
    info:        theme.info     ?? "#3498DB",
    infoBg:      theme.infoLight ?? (isDark ? "rgba(52,152,219,0.10)"  : "rgba(52,152,219,0.12)"),
    // Hero header gradient
    heroGrad:    isDark ? [theme.background, theme.card] as const
                        : [theme.card, theme.background] as const,
  };

  // ── Followup row renderer ─────────────────────────────────
  const renderFollowupItem = ({ item }: { item: TodaysFollowup }) => {
    const cfg = STATUS_CONFIG[item.lead.status];
    return (
      <TouchableOpacity
        style={[styles.followupRow, { backgroundColor: C.card, borderColor: C.cardBorder }]}
        onPress={() => navigateToLead(item.lead.id)}
        activeOpacity={0.8}
      >
        <View style={[styles.followupAvatar, { backgroundColor: cfg?.bg || C.goldBg }]}>
          <Text style={[styles.followupAvatarText, { color: cfg?.color || C.gold }]}>
            {item.lead.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.followupInfo}>
          <Text style={[styles.followupName, { color: C.text }]}>{item.lead.name}</Text>
          <Text style={[styles.followupPhone, { color: C.textSub }]}>{item.lead.phone}</Text>
          <View style={[styles.statusPill, { backgroundColor: cfg?.bg || C.goldBg }]}>
            <Ionicons name={cfg?.icon || "ellipse"} size={10} color={cfg?.color || C.gold} />
            <Text style={[styles.statusPillText, { color: cfg?.color || C.gold }]}>
              {cfg?.label || item.lead.status}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.callBtn, { backgroundColor: C.successBg }]}
          onPress={() => Linking.openURL(`tel:${item.lead.phone}`)}
        >
          <Ionicons name="call" size={16} color={C.success} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={C.bg}
      />

      {/* ─── Hero Header ───────────────────────────────────────────────────── */}
      <View style={[styles.heroHeader, { borderBottomColor: C.border }]}>
        <LinearGradient colors={C.heroGrad} style={StyleSheet.absoluteFillObject} />

        <View style={styles.heroTopRow}>
          {/* ── Left: hamburger + greeting ── */}
          <View style={styles.heroLeft}>
            {/* Sidebar open button — matches the pattern in HierarchyScreen's ScreenHeader */}
            <TouchableOpacity
              style={[styles.drawerBtn, { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
              onPress={openDrawer}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="menu-outline" size={22} color={C.gold} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.greetingText, { color: C.textSub }]}>{getGreeting()},</Text>
              <Text style={[styles.heroName, { color: C.text }]}>{employee?.firstName || "Agent"}</Text>
            </View>
          </View>

          {/* ── Right: celebration badge + staff picker ── */}
          <View style={styles.heroRight}>
            {celebrations.length > 0 && (
              <TouchableOpacity
                style={[styles.celebBadge, { backgroundColor: C.goldBg, borderColor: C.goldBorder }]}
                onPress={() => setShowCelebration(true)}
              >
                <Ionicons name="gift-outline" size={16} color={C.gold} />
              </TouchableOpacity>
            )}
            <TutorialButton videoUrl={TUTORIALS.dashboard} label="" />
            {isManager && scopeEmployees && scopeEmployees.length > 0 && (
              <TouchableOpacity
                style={[styles.agentSelector, { backgroundColor: C.surface, borderColor: C.border }]}
                onPress={() => setShowStaffPicker(true)}
              >
                <Ionicons name="people-outline" size={14} color={C.gold} />
                <Text style={[styles.agentSelectorText, { color: C.text }]} numberOfLines={1}>
                  {selectedEmployee ? selectedEmployeeName.split(" ")[0] : "All Team"}
                </Text>
                <Ionicons name="chevron-down" size={12} color={C.textSub} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Metric Bar ── */}
        <View style={[styles.metricBar, { backgroundColor: C.surface, borderColor: C.border }]}>
          {[
            { label: "Total Leads",   value: tabCountsLoading ? "—" : totalLeads,                        color: C.text  },
            { label: "Hot Prospects", value: tabCountsLoading ? "—" : (tabCounts?.["HOT_PROSPECT"] ?? 0), color: C.gold  },
            { label: "Deals Done",    value: tabCountsLoading ? "—" : (tabCounts?.["DEAL_DONE"]    ?? 0), color: C.success },
            { label: "Conversion",    value: conversionRate,                                               color: C.info  },
          ].map((m, i) => (
            <React.Fragment key={m.label}>
              {i > 0 && <View style={[styles.metricDivider, { backgroundColor: C.border }]} />}
              <View style={styles.metricItem}>
                <Text style={[styles.metricValue, { color: m.color }]}>{m.value}</Text>
                <Text style={[styles.metricLabel, { color: C.textTert }]}>{m.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </View>

      {/* ─── Scrollable Body ───────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} colors={[C.gold]} />
        }
      >

        {/* ── Deal Alert Banner ── */}
        {alertTickerText && (
          <View style={[styles.dealBanner, { borderColor: C.goldBorder }]}>
            <LinearGradient
              colors={[C.goldBgStrong, "transparent"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={[styles.dealBannerText, { color: isDark ? "#E8C97A" : C.goldDark }]}>
              {alertTickerText}
            </Text>
          </View>
        )}

        {/* ── Attendance Card ── */}
        {!isCheckedOut && (
          <View style={[styles.attendanceCard, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
            <LinearGradient
              colors={isCheckedIn
                ? ["rgba(46,204,113,0.08)", "transparent"]
                : ["rgba(243,156,18,0.08)", "transparent"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.attendanceLeft}>
              <View style={[styles.attendanceDot, { backgroundColor: isCheckedIn ? C.success : C.warning }]} />
              <View>
                <Text style={[styles.attendanceTitle, { color: C.text }]}>
                  {isCheckedIn ? "Active — Checked In" : "Ready to start?"}
                </Text>
                {isCheckedIn && todayAttendance?.checkInAt && (
                  <Text style={[styles.attendanceTime, { color: C.textSub }]}>
                    Since {new Date(todayAttendance.checkInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.attendanceBtn, {
                backgroundColor: isCheckedIn ? C.dangerBg  : C.successBg,
                borderColor:     isCheckedIn ? C.danger    : C.success,
              }]}
              onPress={isCheckedIn ? handleCheckOut : handleCheckIn}
              disabled={checkingIn || checkingOut}
            >
              {checkingIn || checkingOut ? (
                <ActivityIndicator color={isCheckedIn ? C.danger : C.success} size="small" />
              ) : (
                <Text style={[styles.attendanceBtnText, { color: isCheckedIn ? C.danger : C.success }]}>
                  {isCheckedIn ? "Check Out" : "Check In"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pipeline / All-Leads Tab Switcher ── */}
        <View style={[styles.tabSwitcher, { backgroundColor: C.card, borderColor: C.border }]}>
          {(["pipeline", "activity"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && [styles.tabBtnActive, { backgroundColor: C.surface }]]}
              onPress={() => setActiveTab(tab)}
            >
              <Ionicons
                name={tab === "pipeline" ? "funnel-outline" : "grid-outline"}
                size={14}
                color={activeTab === tab ? C.gold : C.textTert}
              />
              <Text style={[styles.tabBtnText, { color: activeTab === tab ? C.gold : C.textTert },
                            activeTab === tab && styles.tabBtnTextActive]}>
                {tab === "pipeline" ? "Pipeline" : "All Leads"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Pipeline Cards ── */}
        {activeTab === "pipeline" ? (
          <>
            <View style={styles.pipelineGrid}>
              {PRIORITY_STATUSES.map((status) => {
                const cfg    = STATUS_CONFIG[status];
                const count  = tabCounts?.[status] ?? 0;
                const isGold = status === "DEAL_DONE" || status === "HOT_PROSPECT";
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.pipelineCard, {
                      backgroundColor: C.card,
                      borderColor: isGold ? C.goldBorder : C.border,
                    }]}
                    onPress={() => navigateTo("Leads")}
                    activeOpacity={0.8}
                  >
                    {isGold && (
                      <View style={[styles.pipelineGoldAccent, { backgroundColor: cfg.color }]} />
                    )}
                    <View style={[styles.pipelineIconWrap, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                    </View>
                    <Text style={[styles.pipelineCount, { color: isGold ? C.gold : C.text }]}>
                      {tabCountsLoading ? "—" : count}
                    </Text>
                    <Text style={[styles.pipelineLabel, { color: C.textSub }]} numberOfLines={1}>
                      {cfg.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryRow}>
              {KPI_STATUSES.filter((s) => !PRIORITY_STATUSES.includes(s)).map((status) => {
                const cfg   = STATUS_CONFIG[status];
                const count = tabCounts?.[status] ?? 0;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.secondaryCard, { backgroundColor: C.card, borderColor: C.border }]}
                    onPress={() => navigateTo("Leads")}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                    <Text style={[styles.secondaryCount, { color: C.text }]}>
                      {tabCountsLoading ? "—" : count}
                    </Text>
                    <Text style={[styles.secondaryLabel, { color: C.textTert }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <View style={styles.allLeadsGrid}>
            {KPI_STATUSES.map((status) => {
              const cfg   = STATUS_CONFIG[status];
              const count = tabCounts?.[status] ?? 0;
              return (
                <AnimatedStatCard
                  key={status}
                  label={cfg.label}
                  value={tabCountsLoading ? "—" : count}
                  icon={cfg.icon}
                  color={cfg.color}
                  bg={cfg.bg}
                  cardBg={C.card}
                  cardBorder={C.border}
                  onPress={() => navigateTo("Leads")}
                />
              );
            })}
          </View>
        )}

        {/* ── Target Summary ── */}
        {targetSummary && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="trending-up-outline" size={16} color={C.gold} />
                <Text style={[styles.sectionTitle, { color: C.text }]}>Target Summary</Text>
              </View>
              <TouchableOpacity onPress={() => navigateTo("Targets")} style={styles.seeAllBtn}>
                <Text style={[styles.seeAllText, { color: C.gold }]}>View All</Text>
                <Ionicons name="arrow-forward" size={12} color={C.gold} />
              </TouchableOpacity>
            </View>

            <View style={[styles.targetCard, { backgroundColor: C.card, borderColor: C.goldBorder }]}>
              <LinearGradient
                colors={[C.goldBg, "transparent"]}
                start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
              />
              <View style={styles.targetStatsRow}>
                {[
                  { label: "Calls",    achieved: targetSummary.achieved?.calls    ?? 0, target: targetSummary.targets?.calls },
                  { label: "Visits",   achieved: targetSummary.achieved?.visits   ?? 0, target: undefined },
                  { label: "Meetings", achieved: targetSummary.achieved?.meetings ?? 0, target: undefined },
                  { label: "Deals",    achieved: targetSummary.achieved?.deals    ?? 0, target: undefined },
                ].map((item) => {
                  const pct = item.target && item.target > 0 ? (item.achieved / item.target) * 100 : null;
                  return (
                    <View key={item.label} style={styles.targetStat}>
                      <Text style={[styles.targetStatValue, { color: C.text }]}>{item.achieved}</Text>
                      {item.target && <Text style={[styles.targetStatMax, { color: C.textTert }]}>/{item.target}</Text>}
                      <Text style={[styles.targetStatLabel, { color: C.textSub }]}>{item.label}</Text>
                      {pct !== null && (
                        <View style={[styles.miniProgress, { backgroundColor: C.surface }]}>
                          <View style={[styles.miniProgressFill, {
                            width: `${Math.min(pct, 100)}%` as any,
                            backgroundColor: pct >= 100 ? C.success : pct >= 60 ? C.gold : C.danger,
                          }]} />
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>

              {targetSummary.targets?.salesRevenue != null && targetSummary.targets.salesRevenue > 0 && (
                <View style={[styles.revenueStrip, { borderTopColor: C.border }]}>
                  <View>
                    <Text style={[styles.revenueLabel, { color: C.text }]}>Sales Revenue</Text>
                    <Text style={[styles.revenueCaption, { color: C.textTert }]}>Monthly target progress</Text>
                  </View>
                  <View style={styles.revenueRight}>
                    <Text style={[styles.revenueAchieved, { color: C.gold }]}>
                      {formatCurrency(targetSummary.achieved?.salesRevenue ?? 0)}
                    </Text>
                    <Text style={[styles.revenueTarget, { color: C.textSub }]}>
                      of {formatCurrency(targetSummary.targets.salesRevenue)}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Quick Access ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="apps-outline" size={16} color={C.gold} />
              <Text style={[styles.sectionTitle, { color: C.text }]}>Quick Access</Text>
            </View>
          </View>
          <View style={styles.quickGrid}>
            {QUICK_ACCESS_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.route}
                style={[styles.quickCard, { backgroundColor: C.card, borderColor: C.border }]}
                onPress={() => navigateTo(item.route)}
                activeOpacity={0.75}
              >
                <View style={[styles.quickIconWrap, { backgroundColor: C.goldBg }]}>
                  <Ionicons name={item.icon} size={20} color={C.gold} />
                </View>
                <Text style={[styles.quickLabel, { color: C.textSub }]} numberOfLines={2}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── KRA Calendar ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Ionicons name="calendar-outline" size={16} color={C.gold} />
              <Text style={[styles.sectionTitle, { color: C.text }]}>KRA Calendar</Text>
            </View>
            <TouchableOpacity onPress={() => navigateTo("Reports")} style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: C.gold }]}>Reports</Text>
              <Ionicons name="arrow-forward" size={12} color={C.gold} />
            </TouchableOpacity>
          </View>

          <View style={[styles.kraCard, { backgroundColor: C.card, borderColor: C.border }]}>
            {/* Month nav */}
            <View style={styles.kraMonthNav}>
              <TouchableOpacity
                style={[styles.kraNavBtn, { backgroundColor: C.surface }]}
                onPress={() => { if (kraMonth === 1) { setKraMonth(12); setKraYear(kraYear - 1); } else setKraMonth(kraMonth - 1); }}
              >
                <Ionicons name="chevron-back" size={18} color={C.text} />
              </TouchableOpacity>
              <Text style={[styles.kraMonthLabel, { color: C.text }]}>
                {kraData.MONTH_NAMES[kraMonth - 1]} {kraYear}
              </Text>
              <TouchableOpacity
                style={[styles.kraNavBtn, { backgroundColor: C.surface }]}
                onPress={() => { if (kraMonth === 12) { setKraMonth(1); setKraYear(kraYear + 1); } else setKraMonth(kraMonth + 1); }}
              >
                <Ionicons name="chevron-forward" size={18} color={C.text} />
              </TouchableOpacity>
            </View>

            {/* DOW header */}
            <View style={styles.kraDowRow}>
              {kraData.DAY_LABELS.map((l, i) => (
                <View key={i} style={styles.kraDowCell}>
                  <Text style={[styles.kraDowText, { color: C.textTert }]}>{l}</Text>
                </View>
              ))}
            </View>

            {/* Day grid */}
            {kraData.rows.map((row, ri) => (
              <View key={ri} style={styles.kraRow}>
                {row.map((cell, ci) => {
                  if (cell.day === null) return <View key={ci} style={styles.kraCell} />;
                  const dateStr = `${kraYear}-${String(kraMonth).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
                  const data    = kraData.bucketMap[dateStr];
                  const isToday = dateStr === kraData.todayStr;
                  const isFuture= dateStr > kraData.todayStr;
                  let bgColor   = C.surface;
                  let textColor = C.textSub;
                  if (data && data.callTarget > 0) {
                    bgColor   = data.callsMade >= data.callTarget ? "rgba(46,204,113,0.20)" : "rgba(231,76,60,0.20)";
                    textColor = data.callsMade >= data.callTarget ? C.success : C.danger;
                  }
                  return (
                    <TouchableOpacity
                      key={ci}
                      style={[
                        styles.kraCell,
                        { backgroundColor: bgColor, opacity: isFuture ? 0.35 : 1 },
                        isToday && [styles.kraCellToday, { borderColor: C.gold }],
                      ]}
                      activeOpacity={0.7}
                      onPress={() => { if (data) setSelectedDay({ date: dateStr, callsMade: data.callsMade, callTarget: data.callTarget }); }}
                    >
                      <Text style={[styles.kraCellText, { color: textColor }]}>{cell.day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Legend */}
            <View style={styles.kraLegend}>
              {[
                { label: "Achieved",  bg: "rgba(46,204,113,0.50)" },
                { label: "Missed",    bg: "rgba(231,76,60,0.50)"  },
                { label: "No Target", bg: C.surface               },
              ].map((l) => (
                <View key={l.label} style={styles.kraLegendItem}>
                  <View style={[styles.kraLegendDot, { backgroundColor: l.bg }]} />
                  <Text style={[styles.kraLegendLabel, { color: C.textSub }]}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* ── Today's Follow-ups ── */}
        {todaysFollowups && todaysFollowups.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="notifications-outline" size={16} color={C.gold} />
                <Text style={[styles.sectionTitle, { color: C.text }]}>Today's Follow-ups</Text>
              </View>
              <TouchableOpacity
                onPress={() => { setFollowupModalDismissed(false); setFollowupModalVisible(true); }}
                style={styles.seeAllBtn}
              >
                <Text style={[styles.seeAllText, { color: C.gold }]}>View All ({todaysFollowups.length})</Text>
                <Ionicons name="arrow-forward" size={12} color={C.gold} />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { setFollowupModalDismissed(false); setFollowupModalVisible(true); }}
              style={[styles.followupSummary, { backgroundColor: C.card, borderColor: C.goldBorder }]}
            >
              <LinearGradient
                colors={[C.warningBg, "transparent"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[StyleSheet.absoluteFillObject, { borderRadius: 14 }]}
              />
              <Ionicons name="alarm-outline" size={22} color={C.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.followupSummaryTitle, { color: C.text }]}>
                  {todaysFollowups.length} follow-up{todaysFollowups.length !== 1 ? "s" : ""} pending
                </Text>
                <Text style={[styles.followupSummarySubtitle, { color: C.textSub }]}>Tap to view and take action</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textSub} />
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>

      {/* ══════════ Staff Picker Modal ══════════ */}
      <Modal visible={showStaffPicker} animationType="slide" transparent onRequestClose={() => setShowStaffPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: C.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.border }]} />
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: C.text }]}>Select Team Member</Text>
              <TouchableOpacity onPress={() => setShowStaffPicker(false)}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.staffOption, { backgroundColor: C.surface, borderColor: !selectedEmployee ? C.goldBorder : C.border },
                      !selectedEmployee && { backgroundColor: C.goldBg }]}
              onPress={() => { setSelectedEmployee(undefined); setShowStaffPicker(false); }}
            >
              <View style={[styles.staffAvatarCircle, { backgroundColor: C.goldBg }]}>
                <Ionicons name="people" size={16} color={C.gold} />
              </View>
              <Text style={[styles.staffOptionName, { color: !selectedEmployee ? C.gold : C.text }]}>
                All Team Members
              </Text>
              {!selectedEmployee && <Ionicons name="checkmark" size={16} color={C.gold} />}
            </TouchableOpacity>

            <FlatList
              data={scopeEmployees || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }: { item: ScopeEmployee }) => {
                const active   = selectedEmployee === item.id;
                const initials = `${item.firstName[0]}${item.lastName?.[0] || ""}`.toUpperCase();
                return (
                  <TouchableOpacity
                    style={[styles.staffOption, { backgroundColor: C.surface, borderColor: active ? C.goldBorder : C.border },
                            active && { backgroundColor: C.goldBg }]}
                    onPress={() => { setSelectedEmployee(item.id); setShowStaffPicker(false); }}
                  >
                    <View style={[styles.staffAvatarCircle, { backgroundColor: active ? C.goldBg : C.surface }]}>
                      <Text style={[styles.staffAvatarText, { color: active ? C.gold : C.textSub }]}>{initials}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.staffOptionName, { color: active ? C.gold : C.text }]}>
                        {item.firstName} {item.lastName}
                      </Text>
                      <Text style={[styles.staffOptionRole, { color: C.textTert }]}>
                        {item.designation.replace(/_/g, " ")}
                      </Text>
                    </View>
                    {active && <Ionicons name="checkmark" size={16} color={C.gold} />}
                  </TouchableOpacity>
                );
              }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </View>
        </View>
      </Modal>

      {/* ══════════ Follow-ups Modal ══════════ */}
      <Modal
        visible={followupModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => { setFollowupModalVisible(false); setFollowupModalDismissed(true); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, styles.followupModalSheet, { backgroundColor: C.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: C.border }]} />
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={[styles.modalTitle, { color: C.text }]}>Today's Follow-ups</Text>
                <Text style={[styles.modalSubtitle, { color: C.textSub }]}>
                  {todaysFollowups?.length ?? 0} lead{(todaysFollowups?.length ?? 0) !== 1 ? "s" : ""} to connect with
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setFollowupModalVisible(false); setFollowupModalDismissed(true); }}>
                <Ionicons name="close" size={22} color={C.textSub} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={todaysFollowups || []}
              keyExtractor={(item) => item.id}
              renderItem={renderFollowupItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 24 }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="checkmark-done-circle-outline" size={48} color={C.textTert} />
                  <Text style={[styles.emptyText, { color: C.textSub }]}>All caught up for today</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ══════════ KRA Day Detail Modal ══════════ */}
      <Modal visible={!!selectedDay} animationType="fade" transparent onRequestClose={() => setSelectedDay(null)}>
        <View style={styles.kraModalOverlay}>
          <View style={[styles.kraDayModal, { backgroundColor: C.card, borderColor: C.goldBorder }]}>
            {selectedDay && (() => {
              const pct      = selectedDay.callTarget > 0 ? Math.round((selectedDay.callsMade / selectedDay.callTarget) * 100) : 0;
              const achieved = selectedDay.callTarget > 0 && selectedDay.callsMade >= selectedDay.callTarget;
              const dateObj  = new Date(selectedDay.date + "T00:00:00");
              return (
                <>
                  <View style={styles.modalHeaderRow}>
                    <Text style={[styles.kraDateText, { color: C.text }]}>
                      {dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedDay(null)}>
                      <Ionicons name="close" size={22} color={C.textSub} />
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.achievementBadge, {
                    backgroundColor: achieved ? C.successBg : C.dangerBg,
                    borderColor:     achieved ? C.success   : C.danger,
                  }]}>
                    <Ionicons name={achieved ? "checkmark-circle" : "close-circle"} size={20} color={achieved ? C.success : C.danger} />
                    <Text style={[styles.achievementText, { color: achieved ? C.success : C.danger }]}>
                      {achieved ? "Target Achieved" : "Target Not Met"}
                    </Text>
                  </View>
                  <View style={styles.kraStatsRow}>
                    {[
                      { label: "Daily Target", value: selectedDay.callTarget },
                      { label: "Calls Made",   value: selectedDay.callsMade  },
                      { label: "Achievement",  value: `${pct}%`              },
                    ].map((s) => (
                      <View key={s.label} style={styles.kraStat}>
                        <Text style={[styles.kraStatValue, { color: C.text }]}>{s.value}</Text>
                        <Text style={[styles.kraStatLabel,  { color: C.textSub }]}>{s.label}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={[styles.progressBarBg, { backgroundColor: C.surface }]}>
                    <LinearGradient
                      colors={achieved ? [C.success, "#27AE60"] : [C.danger, "#C0392B"]}
                      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                      style={[styles.progressBarFill, { width: `${Math.min(pct, 100)}%` as any }]}
                    />
                  </View>
                  <Text style={[styles.progressLabel, { color: C.textSub }]}>
                    {selectedDay.callsMade} / {selectedDay.callTarget} calls
                  </Text>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* ══════════ Birthday Celebration ══════════ */}
      {celebrations.length > 0 && showCelebration && (
        <BirthdayCelebration celebrations={celebrations} onClose={() => setShowCelebration(false)} />
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
// All colors are passed via inline style props above — nothing is hardcoded here.
const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollView:   { flex: 1 },
  scrollContent:{ paddingHorizontal: 16, paddingTop: 16 },

  // Hero Header
  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    borderBottomWidth: 1,
    overflow: "hidden",
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  heroRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  // Sidebar button
  drawerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  greetingText: {
    fontSize: 12,
    fontWeight: "400",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginTop: 2,
  },
  celebBadge: {
    width: 38, height: 38, borderRadius: 19,
    borderWidth: 1,
    justifyContent: "center", alignItems: "center",
  },
  agentSelector: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8,
    gap: 6, borderWidth: 1, maxWidth: 130,
  },
  agentSelectorText: { fontSize: 12, fontWeight: "500", flexShrink: 1 },

  // Metric Bar
  metricBar: {
    flexDirection: "row", borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, overflow: "hidden",
  },
  metricItem:    { flex: 1, alignItems: "center" },
  metricValue:   { fontSize: 20, fontWeight: "700", letterSpacing: -0.5 },
  metricLabel:   { fontSize: 10, marginTop: 3, fontWeight: "500", textTransform: "uppercase", letterSpacing: 0.3 },
  metricDivider: { width: 1, marginVertical: 4 },

  // Deal Banner
  dealBanner: {
    borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 12,
    marginBottom: 16, overflow: "hidden",
  },
  dealBannerText: { fontSize: 13, fontWeight: "600", letterSpacing: 0.2 },

  // Attendance Card
  attendanceCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 16, paddingVertical: 14,
    marginBottom: 16, overflow: "hidden",
  },
  attendanceLeft:    { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  attendanceDot:     { width: 10, height: 10, borderRadius: 5 },
  attendanceTitle:   { fontSize: 14, fontWeight: "600" },
  attendanceTime:    { fontSize: 12, marginTop: 2 },
  attendanceBtn:     { borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8, minWidth: 95, alignItems: "center" },
  attendanceBtnText: { fontSize: 13, fontWeight: "700" },

  // Tab Switcher
  tabSwitcher: {
    flexDirection: "row", borderRadius: 12, padding: 4,
    marginBottom: 16, borderWidth: 1,
  },
  tabBtn:         { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 9 },
  tabBtnActive:   {},
  tabBtnText:     { fontSize: 13, fontWeight: "500" },
  tabBtnTextActive:{ fontWeight: "600" },

  // Pipeline Grid
  pipelineGrid:       { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  pipelineCard:       { width: (SCREEN_WIDTH - 32 - 20) / 3, borderRadius: 14, borderWidth: 1, padding: 14, overflow: "hidden" },
  pipelineGoldAccent: { position: "absolute", top: 0, left: 0, right: 0, height: 2, opacity: 0.7 },
  pipelineIconWrap:   { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginBottom: 10 },
  pipelineCount:      { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  pipelineLabel:      { fontSize: 11, fontWeight: "500", marginTop: 3 },

  // Secondary Row
  secondaryRow:   { gap: 8, marginBottom: 20, paddingRight: 4 },
  secondaryCard:  { flexDirection: "column", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 4, minWidth: 80 },
  secondaryCount: { fontSize: 16, fontWeight: "700" },
  secondaryLabel: { fontSize: 10, fontWeight: "500" },

  // All Leads Grid
  allLeadsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  statCard:     { width: (SCREEN_WIDTH - 32 - 30) / 4, borderRadius: 12, borderWidth: 1, padding: 10, alignItems: "center" },
  statIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  statValue:    { fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  statLabel:    { fontSize: 9, fontWeight: "500", textAlign: "center", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },

  // Section
  section:        { marginBottom: 24 },
  sectionHeader:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitleRow:{ flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle:   { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  seeAllBtn:      { flexDirection: "row", alignItems: "center", gap: 4 },
  seeAllText:     { fontSize: 12, fontWeight: "600" },

  // Target Card
  targetCard:       { borderRadius: 14, borderWidth: 1, padding: 18, overflow: "hidden" },
  targetStatsRow:   { flexDirection: "row", justifyContent: "space-around", marginBottom: 16 },
  targetStat:       { alignItems: "center", minWidth: 60 },
  targetStatValue:  { fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  targetStatMax:    { fontSize: 12, fontWeight: "500" },
  targetStatLabel:  { fontSize: 11, fontWeight: "500", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  miniProgress:     { width: 48, height: 3, borderRadius: 2, marginTop: 6, overflow: "hidden" },
  miniProgressFill: { height: "100%", borderRadius: 2 },
  revenueStrip:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 14, borderTopWidth: 1 },
  revenueLabel:     { fontSize: 13, fontWeight: "600" },
  revenueCaption:   { fontSize: 11, marginTop: 2 },
  revenueRight:     { alignItems: "flex-end" },
  revenueAchieved:  { fontSize: 16, fontWeight: "800" },
  revenueTarget:    { fontSize: 11, marginTop: 1 },

  // Quick Grid
  quickGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard:    { width: (SCREEN_WIDTH - 32 - 30) / 4, borderRadius: 14, borderWidth: 1, padding: 12, alignItems: "center" },
  quickIconWrap:{ width: 44, height: 44, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 8 },
  quickLabel:   { fontSize: 10, fontWeight: "500", textAlign: "center", lineHeight: 14 },

  // KRA Calendar
  kraCard:      { borderRadius: 14, borderWidth: 1, padding: 16, overflow: "hidden" },
  kraMonthNav:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  kraNavBtn:    { width: 36, height: 36, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  kraMonthLabel:{ fontSize: 15, fontWeight: "700" },
  kraDowRow:    { flexDirection: "row", marginBottom: 8 },
  kraDowCell:   { flex: 1, alignItems: "center", paddingVertical: 4 },
  kraDowText:   { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  kraRow:       { flexDirection: "row" },
  kraCell:      { flex: 1, aspectRatio: 1, margin: 2, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  kraCellToday: { borderWidth: 1.5 },
  kraCellText:  { fontSize: 12, fontWeight: "600" },
  kraLegend:    { flexDirection: "row", justifyContent: "center", marginTop: 14, gap: 20 },
  kraLegendItem:{ flexDirection: "row", alignItems: "center", gap: 6 },
  kraLegendDot: { width: 8, height: 8, borderRadius: 4 },
  kraLegendLabel:{ fontSize: 11, fontWeight: "500" },

  // Follow-up Summary
  followupSummary:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  followupSummaryTitle:   { fontSize: 14, fontWeight: "600" },
  followupSummarySubtitle:{ fontSize: 12, marginTop: 2 },

  // Modal
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "flex-end" },
  modalSheet:      { maxHeight: "70%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderColor: "transparent", padding: 20 },
  followupModalSheet:{ maxHeight: "82%" },
  modalHandle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeaderRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 },
  modalTitle:      { fontSize: 18, fontWeight: "700" },
  modalSubtitle:   { fontSize: 13, marginTop: 3 },

  // Staff option
  staffOption:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  staffAvatarCircle:{ width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  staffAvatarText:  { fontSize: 14, fontWeight: "700" },
  staffOptionName:  { fontSize: 14, fontWeight: "600", flex: 1 },
  staffOptionRole:  { fontSize: 11, marginTop: 2 },

  // Followup row
  followupRow:      { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  followupAvatar:   { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" },
  followupAvatarText:{ fontSize: 16, fontWeight: "700" },
  followupInfo:     { flex: 1 },
  followupName:     { fontSize: 14, fontWeight: "600" },
  followupPhone:    { fontSize: 12, marginTop: 2 },
  statusPill:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
  statusPillText:   { fontSize: 10, fontWeight: "600" },
  callBtn:          { width: 38, height: 38, borderRadius: 19, justifyContent: "center", alignItems: "center" },
  emptyState:       { alignItems: "center", paddingVertical: 40, gap: 12 },
  emptyText:        { fontSize: 14, fontWeight: "500" },

  // KRA Day Modal
  kraModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.75)", justifyContent: "center", alignItems: "center" },
  kraDayModal:     { width: SCREEN_WIDTH - 48, borderRadius: 20, borderWidth: 1, padding: 22 },
  kraDateText:     { fontSize: 15, fontWeight: "700", flex: 1 },
  achievementBadge:{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginBottom: 20 },
  achievementText: { fontSize: 14, fontWeight: "700" },
  kraStatsRow:     { flexDirection: "row", justifyContent: "space-around", marginBottom: 20 },
  kraStat:         { alignItems: "center" },
  kraStatValue:    { fontSize: 24, fontWeight: "800" },
  kraStatLabel:    { fontSize: 11, fontWeight: "500", marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 },
  progressBarBg:   { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 8 },
  progressBarFill: { height: "100%", borderRadius: 4 },
  progressLabel:   { fontSize: 12, fontWeight: "500", textAlign: "center" },
});