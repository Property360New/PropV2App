import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
  SectionList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetTodayAttendanceQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useGetMyAttendanceQuery,
  useGetTeamAttendanceQuery,
  useGetAttendanceSummaryQuery,
  useLazyDownloadMyAttendanceQuery,
  useLazyDownloadTeamAttendanceQuery,
} from "../store/attendance.api";
import { useGetProfileQuery } from "../store/auth.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import type { AttendanceRecord } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

// ─── Helpers ────────────────────────────────────────────────

type DateRangeKey = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

const DATE_RANGES: { label: string; value: DateRangeKey }[] = [
  { label: "Today", value: "TODAY" },
  { label: "This Week", value: "THIS_WEEK" },
  { label: "This Month", value: "THIS_MONTH" },
  { label: "Custom", value: "CUSTOM" },
];

const MANAGER_DESIGNATIONS = [
  "TEAM_LEAD",
  "SALES_MANAGER",
  "AREA_MANAGER",
  "DGM",
  "GM",
  "VP_SALES",
  "ADMIN",
];

const getStartOfDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

const getDateRange = (key: DateRangeKey): { startDate?: string; endDate?: string } => {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  if (key === "TODAY") {
    return { startDate: getStartOfDay(now).toISOString(), endDate: endOfDay.toISOString() };
  }
  if (key === "THIS_WEEK") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { startDate: getStartOfDay(monday).toISOString(), endDate: endOfDay.toISOString() };
  }
  if (key === "THIS_MONTH") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: first.toISOString(), endDate: endOfDay.toISOString() };
  }
  return {};
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const formatTime = (dateStr: string | null): string => {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
};

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: { "User-Agent": "Property360CRM/1.0" },
        signal: AbortSignal.timeout(5_000),
      }
    );
    if (!res.ok) return "Address not available";
    const data = await res.json();
    if (data.address) {
      const a = data.address;
      return [
        a.road || a.pedestrian || a.footway,
        a.suburb || a.neighbourhood,
        a.city || a.town || a.village || a.county,
        a.state,
      ]
        .filter(Boolean)
        .join(", ");
    }
    return data.display_name ?? "Address not available";
  } catch {
    return "Address not available";
  }
}

const formatHours = (hours: number | null): string => {
  if (hours == null) return "--";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
};

const getStatusLabel = (status: AttendanceRecord["status"]): string => {
  switch (status) {
    case "FULL_DAY":
    case "PRESENT_FULL":
      return "Full Day";
    case "HALF_DAY":
    case "PRESENT_HALF":
      return "Half Day";
    case "ABSENT":
      return "Absent";
    default:
      return status;
  }
};

const getDaysInMonth = (month: number, year: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

const getFirstDayOfMonth = (month: number, year: number): number => {
  return new Date(year, month, 1).getDay();
};

// ─── Component ──────────────────────────────────────────────

export const AttendanceScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { data: profile } = useGetProfileQuery();

  const isManager = profile ? MANAGER_DESIGNATIONS.includes(profile.designation) : false;

  // Tab state
  const [activeTab, setActiveTab] = useState<"my" | "team">("my");

  // Date filter state
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("THIS_MONTH");
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
  const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);

  // Location loading state
  const [locationLoading, setLocationLoading] = useState(false);

  // Team member filter state
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>("");
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);

  // Today attendance
  const {
    data: todayAttendance,
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useGetTodayAttendanceQuery();

  const [checkIn, { isLoading: checkingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: checkingOut }] = useCheckOutMutation();

  // Build query params
  const queryParams = useMemo(() => {
    if (dateRangeKey === "CUSTOM") {
      const endOfCustom = new Date(customEnd);
      endOfCustom.setHours(23, 59, 59, 999);
      return {
        startDate: getStartOfDay(customStart).toISOString(),
        endDate: endOfCustom.toISOString(),
        page: 1,
        limit: 100,
      };
    }
    const range = getDateRange(dateRangeKey);
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      page: 1,
      limit: 100,
    };
  }, [dateRangeKey, customStart, customEnd]);

  // My attendance
  const {
    data: myAttendance,
    isLoading: myLoading,
    isFetching: myFetching,
    refetch: refetchMy,
  } = useGetMyAttendanceQuery(queryParams as any);

  // Team attendance
  const {
    data: teamAttendance,
    isLoading: teamLoading,
    isFetching: teamFetching,
    refetch: refetchTeam,
  } = useGetTeamAttendanceQuery({
    ...queryParams,
    ...(selectedTeamMember ? { employeeId: selectedTeamMember } : {}),
  } as any, { skip: !isManager || activeTab !== "team" });

  // Summary
  const now = new Date();
  const {
    data: summaryData,
  } = useGetAttendanceSummaryQuery({ month: now.getMonth() + 1, year: now.getFullYear() });

  // Download hooks
  const [triggerDownloadMy, { isFetching: downloadingMy }] = useLazyDownloadMyAttendanceQuery();
  const [triggerDownloadTeam, { isFetching: downloadingTeam }] = useLazyDownloadTeamAttendanceQuery();

  // Scope employees for team view
  const { data: scopeEmployees } = useGetScopeEmployeesQuery(undefined, { skip: !isManager });

  // ─── Location + Check In/Out ───────────────────────────────

  const requestLocationAndGetCoords = async (): Promise<{
  latitude: number;
  longitude: number;
} | null> => {
  try {
    setLocationLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Location permission is required for attendance.");
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch (err: any) {
    Alert.alert("Location Error", err?.message ?? "Unable to get your location.");
    return null;
  } finally {
    setLocationLoading(false);
  }
};
 
// ─── Check In: locate → geocode → POST ───────────────────────────────────────
const handleCheckIn = async () => {
  const coords = await requestLocationAndGetCoords();
  if (!coords) return;
 
  // Resolve address on the frontend before sending — keeps the DB record complete immediately
  const address = await reverseGeocode(coords.latitude, coords.longitude);
 
  try {
    await checkIn({ ...coords, address }).unwrap();
    refetchToday();
  } catch {
    Alert.alert("Error", "Failed to check in. Please try again.");
  }
};
 
// ─── Check Out: same three-step pattern ──────────────────────────────────────
const handleCheckOut = async () => {
  const coords = await requestLocationAndGetCoords();
  if (!coords) return;
 
  const address = await reverseGeocode(coords.latitude, coords.longitude);
 
  try {
    await checkOut({ ...coords, address }).unwrap();
    refetchToday();
  } catch {
    Alert.alert("Error", "Failed to check out. Please try again.");
  }
};

  // ─── Download ──────────────────────────────────────────────

  const handleDownload = () => {
    const params = {
      startDate: queryParams.startDate ?? getStartOfDay(new Date()).toISOString(),
      endDate: queryParams.endDate ?? new Date().toISOString(),
    };
    if (activeTab === "my") {
      triggerDownloadMy(params);
    } else {
      triggerDownloadTeam(params);
    }
  };

  // ─── Status badge color helper ─────────────────────────────

  const getStatusColor = (status: AttendanceRecord["status"]): { bg: string; text: string } => {
    switch (status) {
      case "FULL_DAY":
      case "PRESENT_FULL":
        return { bg: theme.successLight, text: theme.success };
      case "HALF_DAY":
      case "PRESENT_HALF":
        return { bg: theme.goldLight, text: theme.gold };
      case "ABSENT":
        return { bg: theme.dangerLight, text: theme.danger };
      default:
        return { bg: theme.surfaceVariant, text: theme.textSecondary };
    }
  };

  // ─── Check-in/out banner ───────────────────────────────────

  const isCheckedIn = todayAttendance?.checkInAt != null;
  const isCheckedOut = todayAttendance?.checkOutAt != null;
  const isBusy = locationLoading || checkingIn || checkingOut;

  const renderBanner = () => {
    if (todayLoading) {
      return (
        <View style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <ActivityIndicator size="small" color={theme.gold} />
          <Text style={[styles.bannerText, { color: theme.textSecondary }]}>
            Loading today's attendance...
          </Text>
        </View>
      );
    }

    // Both checked in and out
    if (isCheckedIn && isCheckedOut) {
      return (
        <View style={[styles.banner, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
          <Ionicons name="checkmark-circle" size={22} color={theme.success} />
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: theme.success }]}>Day Complete</Text>
            <View style={styles.bannerTimesRow}>
              <View style={styles.bannerTimeBlock}>
                <Text style={[styles.bannerTimeLabel, { color: theme.textSecondary }]}>Check In</Text>
                <Text style={[styles.bannerTimeValue, { color: theme.text }]}>
                  {formatTime(todayAttendance!.checkInAt)}
                </Text>
                <Text style={[styles.bannerLocationText, { color: theme.textTertiary }]} numberOfLines={4}>
                  {(todayAttendance as any)?.checkInLocation || ((todayAttendance as any)?.checkInLat ? `${(todayAttendance as any).checkInLat.toFixed(4)}, ${(todayAttendance as any).checkInLng.toFixed(4)}` : "")}
                </Text>
              </View>
              <View style={styles.bannerTimeBlock}>
                <Text style={[styles.bannerTimeLabel, { color: theme.textSecondary }]}>Check Out</Text>
                <Text style={[styles.bannerTimeValue, { color: theme.text }]}>
                  {formatTime(todayAttendance!.checkOutAt)}
                </Text>
                <Text style={[styles.bannerLocationText, { color: theme.textTertiary }]} numberOfLines={4}>
                  {(todayAttendance as any)?.checkOutLocation || ((todayAttendance as any)?.checkOutLat ? `${(todayAttendance as any).checkOutLat.toFixed(4)}, ${(todayAttendance as any).checkOutLng.toFixed(4)}` : "")}
                </Text>
              </View>
              <View style={styles.bannerTimeBlock}>
                <Text style={[styles.bannerTimeLabel, { color: theme.textSecondary }]}>Hours</Text>
                <Text style={[styles.bannerTimeValue, { color: theme.gold }]}>
                  {formatHours(todayAttendance!.hoursWorked)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // Checked in, not checked out
    if (isCheckedIn && !isCheckedOut) {
      return (
        <View style={[styles.banner, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
          <Ionicons name="time-outline" size={22} color={theme.gold} />
          <View style={styles.bannerContent}>
            <Text style={[styles.bannerTitle, { color: theme.gold }]}>Checked In</Text>
            <Text style={[styles.bannerSubtext, { color: theme.textSecondary }]}>
              Since {formatTime(todayAttendance!.checkInAt)}
            </Text>
            <Text style={[styles.bannerLocationText, { color: theme.textTertiary }]} numberOfLines={4}>
              {(todayAttendance as any)?.checkInLocation || ((todayAttendance as any)?.checkInLat ? `${(todayAttendance as any).checkInLat.toFixed(4)}, ${(todayAttendance as any).checkInLng.toFixed(4)}` : "")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleCheckOut}
            disabled={isBusy}
            style={[styles.bannerBtn, { backgroundColor: theme.danger, opacity: isBusy ? 0.6 : 1 }]}
          >
            {isBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color="#FFFFFF" />
                <Text style={styles.bannerBtnText}>Check Out</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      );
    }

    // Not checked in
    return (
      <View style={[styles.banner, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Ionicons name="location-outline" size={22} color={theme.mauve} />
        <View style={styles.bannerContent}>
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Good Morning!</Text>
          <Text style={[styles.bannerSubtext, { color: theme.textSecondary }]}>
            Mark your attendance for today
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleCheckIn}
          disabled={isBusy}
          style={[styles.bannerBtn, { backgroundColor: theme.success, opacity: isBusy ? 0.6 : 1 }]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons name="location" size={16} color="#FFFFFF" />
              <Text style={styles.bannerBtnText}>Check In</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Attendance item renderer ──────────────────────────────

  const renderAttendanceItem = useCallback(
    ({ item }: { item: AttendanceRecord }) => {
      const statusColor = getStatusColor(item.status);
      return (
        <View style={[styles.recordCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.recordHeader}>
            <Text style={[styles.recordDate, { color: theme.text }]}>{formatDate(item.date)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor.text }]}>
                {getStatusLabel(item.status)}
              </Text>
            </View>
          </View>
          {item.employee && activeTab === "team" && (
            <Text style={[styles.employeeName, { color: theme.mauve }]}>
              {item.employee.firstName} {item.employee.lastName}
            </Text>
          )}
          <View style={styles.recordTimesRow}>
            <View style={styles.recordTimeBlock}>
              <Ionicons name="log-in-outline" size={14} color={theme.success} />
              <Text style={[styles.recordTimeLabel, { color: theme.textSecondary }]}>In:</Text>
              <Text style={[styles.recordTimeValue, { color: theme.text }]}>
                {formatTime(item.checkInAt)}
              </Text>
            </View>
            <View style={styles.recordTimeBlock}>
              <Ionicons name="log-out-outline" size={14} color={theme.danger} />
              <Text style={[styles.recordTimeLabel, { color: theme.textSecondary }]}>Out:</Text>
              <Text style={[styles.recordTimeValue, { color: theme.text }]}>
                {formatTime(item.checkOutAt)}
              </Text>
            </View>
            <View style={styles.recordTimeBlock}>
              <Ionicons name="hourglass-outline" size={14} color={theme.gold} />
              <Text style={[styles.recordTimeLabel, { color: theme.textSecondary }]}>Hours:</Text>
              <Text style={[styles.recordTimeValue, { color: theme.gold }]}>
                {formatHours(item.hoursWorked)}
              </Text>
            </View>
          </View>
          {((item as any).checkInLocation || (item as any).checkInLat) && (
            <View style={styles.recordLocationRow}>
              <Ionicons name="location-outline" size={12} color={theme.textTertiary} />
              <Text style={[styles.recordLocationText, { color: theme.textTertiary }]} numberOfLines={4}>
                In: {(item as any).checkInLocation || `${(item as any).checkInLat?.toFixed(4)}, ${(item as any).checkInLng?.toFixed(4)}`}
              </Text>
            </View>
          )}
          {((item as any).checkOutLocation || (item as any).checkOutLat) && (
            <View style={styles.recordLocationRow}>
              <Ionicons name="location-outline" size={12} color={theme.textTertiary} />
              <Text style={[styles.recordLocationText, { color: theme.textTertiary }]} numberOfLines={4}>
                Out: {(item as any).checkOutLocation || `${(item as any).checkOutLat?.toFixed(4)}, ${(item as any).checkOutLng?.toFixed(4)}`}
              </Text>
            </View>
          )}
        </View>
      );
    },
    [theme, activeTab]
  );

  // ─── Team grouped by employee ──────────────────────────────

  const teamSections = useMemo(() => {
    if (!teamAttendance || teamAttendance.length === 0) return [];
    const grouped: Record<string, { title: string; data: AttendanceRecord[] }> = {};
    for (const record of teamAttendance) {
      const empName = record.employee
        ? `${record.employee.firstName} ${record.employee.lastName}`
        : record.employeeId;
      if (!grouped[record.employeeId]) {
        grouped[record.employeeId] = { title: empName, data: [] };
      }
      grouped[record.employeeId].data.push(record);
    }
    return Object.values(grouped);
  }, [teamAttendance]);

  // ─── Monthly calendar summary ─────────────────────────────

  const renderCalendarGrid = () => {
    const month = now.getMonth();
    const year = now.getFullYear();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);
    const dayNames = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

    // Build lookup from summary data
    const summaryMap: Record<number, string> = {};
    if (summaryData && typeof summaryData === "object") {
      const days = (summaryData as any).days ?? (summaryData as any).data?.days;
      if (Array.isArray(days)) {
        for (const d of days) {
          const dayNum = new Date(d.date).getDate();
          summaryMap[dayNum] = d.status;
        }
      }
    }

    const getCalendarDayColor = (status?: string): string => {
      switch (status) {
        case "FULL_DAY":
        case "PRESENT_FULL":
          return theme.success;
        case "HALF_DAY":
        case "PRESENT_HALF":
          return theme.gold;
        case "ABSENT":
          return theme.danger;
        default:
          return theme.surfaceVariant;
      }
    };

    const cells: React.ReactNode[] = [];

    // Day name headers
    for (const dn of dayNames) {
      cells.push(
        <View key={`hdr-${dn}`} style={styles.calendarCell}>
          <Text style={[styles.calendarDayName, { color: theme.textTertiary }]}>{dn}</Text>
        </View>
      );
    }

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cells.push(<View key={`empty-${i}`} style={styles.calendarCell} />);
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
      const status = summaryMap[day];
      const isToday = day === now.getDate();
      cells.push(
        <View key={`day-${day}`} style={styles.calendarCell}>
          <View
            style={[
              styles.calendarDayCircle,
              {
                backgroundColor: getCalendarDayColor(status),
                borderWidth: isToday ? 2 : 0,
                borderColor: isToday ? theme.mauve : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.calendarDayText,
                {
                  color:
                    status === "FULL_DAY" || status === "PRESENT_FULL" || status === "ABSENT"
                      ? "#FFFFFF"
                      : status === "HALF_DAY" || status === "PRESENT_HALF"
                      ? "#FFFFFF"
                      : theme.textTertiary,
                },
              ]}
            >
              {day}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.calendarContainer, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Text style={[styles.calendarTitle, { color: theme.text }]}>
          Monthly Summary - {now.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
        </Text>
        <View style={styles.calendarLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Full Day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.gold }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Half Day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: theme.danger }]} />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>Absent</Text>
          </View>
        </View>
        <View style={styles.calendarGrid}>{cells}</View>
      </View>
    );
  };

  // ─── List header (filters + banner + calendar) ─────────────

  const activeData = activeTab === "my" ? myAttendance : teamAttendance;
  const isListLoading = activeTab === "my" ? myLoading : teamLoading;
  const isFetching = activeTab === "my" ? myFetching : teamFetching;
  const refetchActive = activeTab === "my" ? refetchMy : refetchTeam;
  const isDownloading = activeTab === "my" ? downloadingMy : downloadingTeam;

  const renderListHeader = () => (
    <View>
      {/* Check-in/out banner */}
      {renderBanner()}

      {/* Tab toggle */}
      <View style={[styles.tabRow, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => setActiveTab("my")}
          style={[
            styles.tabBtn,
            activeTab === "my" && { backgroundColor: theme.gold },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "my" ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            My Attendance
          </Text>
        </TouchableOpacity>
        {isManager && (
          <TouchableOpacity
            onPress={() => setActiveTab("team")}
            style={[
              styles.tabBtn,
              activeTab === "team" && { backgroundColor: theme.gold },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === "team" ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              Team Attendance
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Team member filter dropdown */}
      {isManager && activeTab === "team" && (
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            onPress={() => setShowTeamDropdown(!showTeamDropdown)}
            style={[styles.teamDropdownBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          >
            <Ionicons name="person-outline" size={16} color={theme.mauve} />
            <Text style={[styles.teamDropdownBtnText, { color: theme.text }]} numberOfLines={4}>
              {selectedTeamMember
                ? scopeEmployees?.find((e: any) => e.id === selectedTeamMember)
                  ? `${(scopeEmployees as any[]).find((e: any) => e.id === selectedTeamMember)?.firstName} ${(scopeEmployees as any[]).find((e: any) => e.id === selectedTeamMember)?.lastName}`
                  : "Selected Employee"
                : "All Team"}
            </Text>
            <Ionicons name={showTeamDropdown ? "chevron-up" : "chevron-down"} size={16} color={theme.textSecondary} />
          </TouchableOpacity>
          {showTeamDropdown && (
            <View style={[styles.teamDropdownList, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                <TouchableOpacity
                  onPress={() => { setSelectedTeamMember(""); setShowTeamDropdown(false); }}
                  style={[styles.teamDropdownItem, !selectedTeamMember && { backgroundColor: theme.goldLight }]}
                >
                  <Text style={[styles.teamDropdownItemText, { color: !selectedTeamMember ? theme.gold : theme.text }]}>
                    All Team
                  </Text>
                </TouchableOpacity>
                {(scopeEmployees ?? []).map((emp: any) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => { setSelectedTeamMember(emp.id); setShowTeamDropdown(false); }}
                    style={[styles.teamDropdownItem, selectedTeamMember === emp.id && { backgroundColor: theme.goldLight }]}
                  >
                    <Text style={[styles.teamDropdownItemText, { color: selectedTeamMember === emp.id ? theme.gold : theme.text }]}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {/* Date range filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateFilterRow}
      >
        {DATE_RANGES.map((dr) => (
          <TouchableOpacity
            key={dr.value}
            onPress={() => setDateRangeKey(dr.value)}
            style={[
              styles.dateChip,
              {
                backgroundColor: dateRangeKey === dr.value ? theme.mauve : theme.surfaceVariant,
                borderColor: dateRangeKey === dr.value ? theme.mauve : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.dateChipText,
                { color: dateRangeKey === dr.value ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              {dr.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Download button */}
        {/* <TouchableOpacity
          onPress={handleDownload}
          disabled={isDownloading}
          style={[
            styles.downloadChip,
            { backgroundColor: theme.infoLight, borderColor: theme.info },
          ]}
        >
          {isDownloading ? (
            <ActivityIndicator size="small" color={theme.info} />
          ) : (
            <>
              <Ionicons name="download-outline" size={14} color={theme.info} />
              <Text style={[styles.downloadChipText, { color: theme.info }]}>Export</Text>
            </>
          )}
        </TouchableOpacity> */}
      </ScrollView>

      {/* Custom date pickers */}
      {dateRangeKey === "CUSTOM" && (
        <View style={styles.customDateRow}>
          <TouchableOpacity
            onPress={() => setShowCustomStartPicker(true)}
            style={[styles.datePickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          >
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.datePickerText, { color: theme.text }]}>
              {formatDate(customStart.toISOString())}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: theme.textTertiary, marginHorizontal: 6 }}>to</Text>
          <TouchableOpacity
            onPress={() => setShowCustomEndPicker(true)}
            style={[styles.datePickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
          >
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.datePickerText, { color: theme.text }]}>
              {formatDate(customEnd.toISOString())}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {showCustomStartPicker && (
        <DateTimePicker
          value={customStart}
          mode="date"
          display="default"
          onChange={(_: DateTimePickerEvent, d?: Date) => {
            setShowCustomStartPicker(false);
            if (d) setCustomStart(d);
          }}
        />
      )}
      {showCustomEndPicker && (
        <DateTimePicker
          value={customEnd}
          mode="date"
          display="default"
          onChange={(_: DateTimePickerEvent, d?: Date) => {
            setShowCustomEndPicker(false);
            if (d) setCustomEnd(d);
          }}
        />
      )}

      {/* Monthly calendar grid */}
      {activeTab === "my" && renderCalendarGrid()}
    </View>
  );

  const headerRightAction = (
  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
    <TutorialButton videoUrl={TUTORIALS.attendance} label="" />
    <TouchableOpacity
      onPress={handleDownload}
      disabled={isDownloading}
      style={{ padding: 4 }}
    >
      {isDownloading ? (
        <ActivityIndicator size="small" color={theme.headerText} />
      ) : (
        <Ionicons name="download-outline" size={20} color={theme.headerText} />
      )}
    </TouchableOpacity>
  </View>
);

  // ─── Main render ───────────────────────────────────────────

  if (isListLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader title="Attendance" />
        <LoadingScreen message="Loading attendance..." />
      </View>
    );
  }

  // Team attendance uses SectionList grouped by employee
  if (activeTab === "team" && isManager) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader
  title="Attendance"
  rightAction={headerRightAction}
/>
        <SectionList
          sections={teamSections}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendanceItem}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.surfaceVariant }]}>
              <Ionicons name="person-outline" size={16} color={theme.mauve} />
              <Text style={[styles.sectionHeaderText, { color: theme.text }]}>{section.title}</Text>
              <View style={[styles.sectionCountBadge, { backgroundColor: theme.goldLight }]}>
                <Text style={[styles.sectionCountText, { color: theme.gold }]}>
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No team attendance"
              subtitle="No records found for the selected period"
            />
          }
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={teamFetching}
              onRefresh={refetchTeam}
              tintColor={theme.gold}
              colors={[theme.gold]}
            />
          }
          stickySectionHeadersEnabled={false}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
  title="Attendance"
  rightAction={headerRightAction}
/>
      <FlatList
        data={myAttendance ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderAttendanceItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={
          !myFetching ? (
            <EmptyState
              icon="calendar-outline"
              title="No attendance records"
              subtitle="No records found for the selected period"
            />
          ) : null
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={myFetching}
            onRefresh={() => {
              refetchMy();
              refetchToday();
            }}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      />
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },

  // Banner
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  bannerSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  bannerText: {
    fontSize: 14,
    marginLeft: 8,
  },
  bannerTimesRow: {
    flexDirection: "row",
    marginTop: 8,
    gap: 16,
  },
  bannerTimeBlock: {
  alignItems: "center",
  flex: 1,           // each block takes equal width
  minWidth: 0,       // allows text to wrap instead of stretching
},
  bannerTimeLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  bannerTimeValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  bannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  bannerBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // Tabs
  tabRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Date filter
  dateFilterRow: {
    paddingBottom: 10,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  downloadChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  downloadChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  datePickerText: {
    fontSize: 13,
  },

  // Record card
  recordCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  recordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordDate: {
    fontSize: 15,
    fontWeight: "600",
  },
  employeeName: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  recordTimesRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 16,
  },
  recordTimeBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  recordTimeLabel: {
    fontSize: 12,
  },
  recordTimeValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  // Section header (team)
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 4,
    gap: 8,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  sectionCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Calendar grid
  calendarContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  calendarTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  calendarLegend: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 2,
  },
  calendarDayName: {
    fontSize: 11,
    fontWeight: "600",
  },
  calendarDayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarDayText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Banner location text
  bannerLocationText: {
  fontSize: 10,
  marginTop: 1,
  textAlign: "center",
  flexWrap: "wrap",  // ensures wrapping
},

  // Record card location
  recordLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  recordLocationText: {
    fontSize: 11,
    flex: 1,
  },

  // Team dropdown
  teamDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  teamDropdownBtnText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  teamDropdownList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    overflow: "hidden",
  },
  teamDropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  teamDropdownItemText: {
    fontSize: 14,
  },
});

export default AttendanceScreen;
