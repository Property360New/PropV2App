import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { StatusBadge } from "../components/common/StatusBadge";
import {
  useGetActivityStatsQuery,
  useGetTeamPerformanceQuery,
  useGetCallActivityQuery,
  useGetDailyCallActivityQuery,
  type ActivityStats,
  type TeamPerfRow,
} from "../store/reports.api";
import { useGetProfileQuery } from "../store/auth.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import type { ScopeEmployee } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

type DateFilter = "today" | "week" | "month" | "custom";

interface StatCard {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  darkColor: string;
  bg: string;
  darkBg: string;
}

const STAT_CARDS: StatCard[] = [
  { key: "totalCalls", label: "Total Calls", icon: "call", color: "#2980B9", darkColor: "#5DADE2", bg: "#D6EAF8", darkBg: "#1A2E3D" },
  { key: "queries", label: "Queries", icon: "chatbubble-ellipses", color: "#8E44AD", darkColor: "#BB6BD9", bg: "#E8D8F0", darkBg: "#2E1F3D" },
  { key: "remarks", label: "Remarks", icon: "document-text", color: "#E67E22", darkColor: "#F0A040", bg: "#FAE5D3", darkBg: "#3D2E1F" },
  { key: "visits", label: "Visits", icon: "walk", color: "#27AE60", darkColor: "#2ECC71", bg: "#D4EFDF", darkBg: "#1F3D2A" },
  { key: "meetings", label: "Meetings", icon: "people", color: "#16A085", darkColor: "#48C9B0", bg: "#D5F5E3", darkBg: "#1F3D30" },
  { key: "deals", label: "Deals", icon: "trophy", color: "#C8922A", darkColor: "#D4A843", bg: "#F5E6C8", darkBg: "#3D3020" },
  { key: "notInterested", label: "Not Interested", icon: "thumbs-down", color: "#C0392B", darkColor: "#E74C3C", bg: "#F5D7D3", darkBg: "#3D1F1F" },
  { key: "hotProspects", label: "Hot Prospects", icon: "flame", color: "#E74C3C", darkColor: "#FF6B6B", bg: "#FADBD8", darkBg: "#3D1F1F" },
];

function getDateRange(filter: DateFilter, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  let startDate: string;
  let endDate: string;

  switch (filter) {
    case "today":
      startDate = now.toISOString().split("T")[0];
      endDate = startDate;
      break;
    case "week": {
      const dayOfWeek = now.getDay();
      const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const monday = new Date(now);
      monday.setDate(now.getDate() - diffToMonday);
      startDate = monday.toISOString().split("T")[0];
      endDate = now.toISOString().split("T")[0];
      break;
    }
    case "month":
      startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      endDate = now.toISOString().split("T")[0];
      break;
    case "custom":
      startDate = customStart
        ? customStart.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];
      endDate = customEnd
        ? customEnd.toISOString().split("T")[0]
        : now.toISOString().split("T")[0];
      break;
  }

  return { startDate, endDate };
}

export default function ReportsScreen() {
  const { theme, isDark } = useTheme();
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
  const [customStartDate, setCustomStartDate] = useState<Date>(new Date());
  const [customEndDate, setCustomEndDate] = useState<Date>(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [drillDownKey, setDrillDownKey] = useState<string | null>(null);
  const [drillDownLabel, setDrillDownLabel] = useState("");
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string | null>(null);

  const { data: profile } = useGetProfileQuery();
  const { data: scopeEmployees = [] } = useGetScopeEmployeesQuery();

  const { startDate, endDate } = useMemo(
    () => getDateRange(dateFilter, customStartDate, customEndDate),
    [dateFilter, customStartDate, customEndDate]
  );

  const activityParams = useMemo(() => {
    const p: Record<string, string> = { startDate, endDate };
    if (selectedEmployeeId) p.employeeId = selectedEmployeeId;
    return p;
  }, [startDate, endDate, selectedEmployeeId]);

  const now = new Date();
  const monthYearParams = useMemo(() => {
    const p: Record<string, unknown> = {
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    };
    if (selectedEmployeeId) p.employeeId = selectedEmployeeId;
    return p;
  }, [selectedEmployeeId, now.getMonth(), now.getFullYear()]);

  const {
    data: activityStats,
    isLoading: statsLoading,
    refetch: refetchStats,
  } = useGetActivityStatsQuery(activityParams);

  const { data: teamPerformance, isLoading: teamLoading } =
    useGetTeamPerformanceQuery(monthYearParams);

  const { data: callActivity } = useGetCallActivityQuery(monthYearParams);
  const { data: dailyCallActivity } = useGetDailyCallActivityQuery(monthYearParams);

  const stats = activityStats?.stats;
  const teamRows: TeamPerfRow[] = useMemo(() => {
    if (!teamPerformance) return [];
    if (Array.isArray(teamPerformance)) return teamPerformance;
    if ((teamPerformance as any).data) return (teamPerformance as any).data;
    return [];
  }, [teamPerformance]);

  const drillDownLeads = useMemo(() => {
    if (!drillDownKey || !activityStats?.leads) return [];
    return activityStats.leads[drillDownKey] ?? [];
  }, [drillDownKey, activityStats]);

  const selectedEmployee = useMemo(
    () => scopeEmployees.find((e) => e.id === selectedEmployeeId),
    [scopeEmployees, selectedEmployeeId]
  );

  const handleStartDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowStartPicker(false);
      if (date) setCustomStartDate(date);
    },
    []
  );

  const handleEndDateChange = useCallback(
    (_event: DateTimePickerEvent, date?: Date) => {
      setShowEndPicker(false);
      if (date) setCustomEndDate(date);
    },
    []
  );

  const openDrillDown = useCallback(
    (key: string, label: string) => {
      setDrillDownKey(key);
      setDrillDownLabel(label);
    },
    []
  );

  if (statsLoading && !activityStats) {
    return <LoadingScreen message="Loading reports..." />;
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Reports" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.reports} />}/>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Date Filters */}
        <View style={styles.filterSection}>
          <View style={styles.dateFilterRow}>
            {(["today", "week", "month", "custom"] as DateFilter[]).map((f) => {
              const labels: Record<DateFilter, string> = {
                today: "Today",
                week: "This Week",
                month: "This Month",
                custom: "Custom",
              };
              const isActive = dateFilter === f;
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? theme.gold : theme.surfaceVariant,
                      borderColor: isActive ? theme.gold : theme.border,
                    },
                  ]}
                  onPress={() => setDateFilter(f)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? theme.textInverse : theme.textSecondary },
                    ]}
                  >
                    {labels[f]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {dateFilter === "custom" && (
            <View style={styles.customDateRow}>
              <TouchableOpacity
                style={[
                  styles.dateBtn,
                  { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                ]}
                onPress={() => setShowStartPicker(true)}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.dateBtnText, { color: theme.text }]}>
                  {customStartDate.toISOString().split("T")[0]}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.dateSep, { color: theme.textTertiary }]}>to</Text>
              <TouchableOpacity
                style={[
                  styles.dateBtn,
                  { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
                ]}
                onPress={() => setShowEndPicker(true)}
              >
                <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
                <Text style={[styles.dateBtnText, { color: theme.text }]}>
                  {customEndDate.toISOString().split("T")[0]}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {showStartPicker && (
            <DateTimePicker
              value={customStartDate}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
              maximumDate={new Date()}
            />
          )}
          {showEndPicker && (
            <DateTimePicker
              value={customEndDate}
              mode="date"
              display="default"
              onChange={handleEndDateChange}
              maximumDate={new Date()}
            />
          )}

          {/* Staff Filter */}
          <TouchableOpacity
            style={[
              styles.staffFilterBtn,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder },
            ]}
            onPress={() => setShowStaffPicker(true)}
          >
            <Ionicons name="person-outline" size={16} color={theme.textSecondary} />
            <Text
              style={[
                styles.staffFilterText,
                { color: selectedEmployeeId ? theme.text : theme.placeholder },
              ]}
              numberOfLines={1}
            >
              {selectedEmployee
                ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                : "All Staff"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Staff Picker Modal */}
        <Modal
          visible={showStaffPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStaffPicker(false)}
        >
          <TouchableOpacity
            style={[styles.pickerOverlay, { backgroundColor: theme.overlay }]}
            activeOpacity={1}
            onPress={() => setShowStaffPicker(false)}
          >
            <View style={[styles.pickerModal, { backgroundColor: theme.card }]}>
              <Text style={[styles.pickerTitle, { color: theme.text }]}>Select Staff</Text>
              <ScrollView>
                <TouchableOpacity
                  style={[
                    styles.pickerOption,
                    { borderBottomColor: theme.divider },
                    !selectedEmployeeId && { backgroundColor: theme.goldLight },
                  ]}
                  onPress={() => {
                    setSelectedEmployeeId("");
                    setShowStaffPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      { color: theme.text },
                      !selectedEmployeeId && { color: theme.gold },
                    ]}
                  >
                    All Staff
                  </Text>
                  {!selectedEmployeeId && (
                    <Ionicons name="checkmark" size={20} color={theme.gold} />
                  )}
                </TouchableOpacity>
                {scopeEmployees.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    style={[
                      styles.pickerOption,
                      { borderBottomColor: theme.divider },
                      selectedEmployeeId === e.id && { backgroundColor: theme.goldLight },
                    ]}
                    onPress={() => {
                      setSelectedEmployeeId(e.id);
                      setShowStaffPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: theme.text },
                        selectedEmployeeId === e.id && { color: theme.gold },
                      ]}
                    >
                      {e.firstName} {e.lastName}
                    </Text>
                    {selectedEmployeeId === e.id && (
                      <Ionicons name="checkmark" size={20} color={theme.gold} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Activity Stats */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Activity Stats</Text>
          {statsLoading && <ActivityIndicator size="small" color={theme.gold} />}
        </View>

        <View style={styles.statsGrid}>
          {STAT_CARDS.map((card) => {
            const count = stats ? (stats as Record<string, number>)[card.key] ?? 0 : 0;
            return (
              <TouchableOpacity
                key={card.key}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.cardBorder,
                  },
                ]}
                onPress={() => openDrillDown(card.key, card.label)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statIconWrap,
                    { backgroundColor: isDark ? card.darkBg : card.bg },
                  ]}
                >
                  <Ionicons
                    name={card.icon}
                    size={20}
                    color={isDark ? card.darkColor : card.color}
                  />
                </View>
                <Text style={[styles.statCount, { color: theme.text }]}>{count}</Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>
                  {card.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Hourly Activity Chart */}
        {activityStats?.hourly && activityStats.hourly.length > 0 && (
          <View style={[styles.hourlyCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.hourlyTitle, { color: theme.text }]}>
              Hourly Activity (2-hour intervals)
            </Text>
            {(() => {
              const maxCount = Math.max(...activityStats.hourly.map(h => h.count), 1);
              const peakBucket = activityStats.hourly.reduce((a, b) => b.count > a.count ? b : a, activityStats.hourly[0]);
              return (
                <>
                  <View style={styles.hourlyBarsContainer}>
                    {activityStats.hourly.map((bucket, idx) => {
                      const pct = (bucket.count / maxCount) * 100;
                      const isPeak = bucket === peakBucket && bucket.count > 0;
                      return (
                        <View key={idx} style={styles.hourlyBarCol}>
                          <Text style={[styles.hourlyBarCount, { color: isPeak ? theme.gold : theme.textTertiary }]}>
                            {bucket.count > 0 ? bucket.count : ""}
                          </Text>
                          <View style={[styles.hourlyBarTrack, { backgroundColor: theme.surfaceVariant }]}>
                            <View style={[styles.hourlyBarFill, {
                              height: `${Math.max(pct, 2)}%`,
                              backgroundColor: isPeak ? theme.gold : theme.mauve,
                            }]} />
                          </View>
                          <Text style={[styles.hourlyBarLabel, { color: theme.textTertiary }]} numberOfLines={1}>
                            {bucket.range.replace("-", "\n")}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  {peakBucket && peakBucket.count > 0 && (
                    <Text style={[styles.hourlyPeakText, { color: theme.gold }]}>
                      Peak: {peakBucket.range}h with {peakBucket.count} calls
                    </Text>
                  )}
                </>
              );
            })()}
          </View>
        )}

        {/* Activity Breakdown */}
        {activityStats?.stats && (
          <View style={[styles.breakdownCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.breakdownTitle, { color: theme.text }]}>Activity Breakdown</Text>
            {[
              { label: "Total Calls", value: activityStats.stats.totalCalls, color: theme.gold },
              { label: "Follow Ups", value: activityStats.stats.followups, color: theme.info },
              { label: "Visit Done", value: activityStats.stats.visits, color: theme.success },
              { label: "Meeting Done", value: activityStats.stats.meetings, color: theme.mauve },
              { label: "Deals Done", value: activityStats.stats.deals, color: "#27AE60" },
              { label: "Not Interested", value: activityStats.stats.notInterested, color: theme.danger },
              { label: "Hot Prospects", value: activityStats.stats.hotProspects, color: "#FF9500" },
              { label: "Ringing", value: activityStats.stats.ringing, color: theme.warning },
              { label: "Call Back", value: activityStats.stats.callBack, color: "#5AC8FA" },
              { label: "Suspect", value: activityStats.stats.suspect, color: theme.textTertiary },
              { label: "Switch Off", value: activityStats.stats.switchOff, color: "#8E8E93" },
            ].map((item) => {
              const maxVal = activityStats.stats.totalCalls || 1;
              const pct = Math.round((item.value / maxVal) * 100);
              return (
                <View key={item.label} style={styles.breakdownRow}>
                  <View style={styles.breakdownLabelRow}>
                    <View style={[styles.breakdownDot, { backgroundColor: item.color }]} />
                    <Text style={[styles.breakdownLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                    <Text style={[styles.breakdownCount, { color: theme.text }]}>{item.value}</Text>
                    <Text style={[styles.breakdownPct, { color: theme.textTertiary }]}>({pct}%)</Text>
                  </View>
                  <View style={[styles.breakdownBarTrack, { backgroundColor: theme.surfaceVariant }]}>
                    <View style={[styles.breakdownBarFill, { backgroundColor: item.color, width: `${Math.max(pct, 1)}%` }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Drill-Down Modal */}
        <Modal
          visible={!!drillDownKey}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setDrillDownKey(null)}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {drillDownLabel} Leads
              </Text>
              <TouchableOpacity onPress={() => setDrillDownKey(null)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={drillDownLeads}
              keyExtractor={(item) => item.leadId}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              ListEmptyComponent={
                <View style={styles.emptyDrill}>
                  <Ionicons name="file-tray-outline" size={40} color={theme.textTertiary} />
                  <Text style={[styles.emptyDrillText, { color: theme.textSecondary }]}>
                    No leads found for this status
                  </Text>
                </View>
              }
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.drillCard,
                    { backgroundColor: theme.card, borderColor: theme.cardBorder },
                  ]}
                >
                  <View style={styles.drillCardHeader}>
                    <Text style={[styles.drillName, { color: theme.text }]}>{item.name}</Text>
                    <StatusBadge status={item.status} small />
                  </View>
                  <View style={styles.drillRow}>
                    <Ionicons name="call-outline" size={13} color={theme.textSecondary} />
                    <Text style={[styles.drillText, { color: theme.textSecondary }]}>
                      {item.phone}
                    </Text>
                  </View>
                  {item.source && (
                    <View style={styles.drillRow}>
                      <Ionicons name="globe-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.drillText, { color: theme.textSecondary }]}>
                        {item.source}
                      </Text>
                    </View>
                  )}
                  {item.createdBy && (
                    <View style={styles.drillRow}>
                      <Ionicons name="person-outline" size={13} color={theme.textSecondary} />
                      <Text style={[styles.drillText, { color: theme.textSecondary }]}>
                        {item.createdBy.firstName} {item.createdBy.lastName}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.drillDate, { color: theme.textTertiary }]}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              )}
            />
          </View>
        </Modal>

        {/* Team Performance */}
        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Team Performance</Text>
          {teamLoading && <ActivityIndicator size="small" color={theme.gold} />}
        </View>

        {teamRows.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              {/* Header Row */}
              <View
                style={[styles.tableHeaderRow, { backgroundColor: theme.surfaceVariant }]}
              >
                <Text
                  style={[styles.tableHeaderCell, styles.tableNameCell, { color: theme.textSecondary }]}
                >
                  Name
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Calls
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Queries
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Remarks
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Visits
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Meetings
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Deals
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  NI
                </Text>
                <Text style={[styles.tableHeaderCell, styles.tableNumCell, { color: theme.textSecondary }]}>
                  Follow Ups
                </Text>
              </View>

              {/* Data Rows */}
              {teamRows.map((row) => {
                const isSelected = selectedTeamMemberId === row.id;
                return (
                  <TouchableOpacity
                    key={row.id}
                    style={[
                      styles.tableRow,
                      {
                        backgroundColor: isSelected ? theme.goldLight : theme.card,
                        borderBottomColor: theme.divider,
                      },
                    ]}
                    onPress={() =>
                      setSelectedTeamMemberId(isSelected ? null : row.id)
                    }
                    activeOpacity={0.7}
                  >
                    <View style={[styles.tableCell, styles.tableNameCell]}>
                      <Text style={[styles.tableName, { color: theme.text }]} numberOfLines={1}>
                        {row.firstName} {row.lastName}
                      </Text>
                      <Text style={[styles.tableDesig, { color: theme.textTertiary }]}>
                        {row.designation}
                      </Text>
                    </View>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.callsMade}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.queries}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.remarks}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.visitsCompleted}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.meetingsHeld}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.dealsDone}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.notInterested}
                    </Text>
                    <Text style={[styles.tableCell, styles.tableNumCell, { color: theme.text }]}>
                      {row.followUps}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        ) : (
          !teamLoading && (
            <View style={[styles.emptyTeam, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
              <Text style={[styles.emptyTeamText, { color: theme.textSecondary }]}>
                No team performance data available
              </Text>
            </View>
          )
        )}

        {/* Call Activity Summary */}
        {callActivity && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>
              Call Activity Breakdown
            </Text>
            <View
              style={[
                styles.callActivityCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.callActivityTotal}>
                <Text style={[styles.callTotalLabel, { color: theme.textSecondary }]}>
                  Total Calls
                </Text>
                <Text style={[styles.callTotalValue, { color: theme.gold }]}>
                  {callActivity.total}
                </Text>
              </View>
              {callActivity.buckets?.map((bucket, idx) => (
                <View
                  key={idx}
                  style={[styles.bucketRow, { borderTopColor: theme.divider }]}
                >
                  <Text style={[styles.bucketRange, { color: theme.textSecondary }]}>
                    {bucket.range}
                  </Text>
                  <Text style={[styles.bucketCount, { color: theme.text }]}>
                    {bucket.count}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Daily Call Activity */}
        {dailyCallActivity && dailyCallActivity.buckets && dailyCallActivity.buckets.length > 0 && (
          <View style={{ marginTop: 20 }}>
            <Text style={[styles.sectionTitle, { color: theme.text, marginBottom: 10 }]}>
              Daily Call Activity
            </Text>
            <View
              style={[
                styles.callActivityCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.callActivityTotal}>
                <Text style={[styles.callTotalLabel, { color: theme.textSecondary }]}>
                  Daily Target
                </Text>
                <Text style={[styles.callTotalValue, { color: theme.gold }]}>
                  {dailyCallActivity.dailyCallTarget}
                </Text>
              </View>
              {dailyCallActivity.buckets.slice(-7).map((bucket, idx) => {
                const pct =
                  bucket.callTarget > 0
                    ? Math.round((bucket.callsMade / bucket.callTarget) * 100)
                    : 0;
                return (
                  <View
                    key={idx}
                    style={[styles.dailyRow, { borderTopColor: theme.divider }]}
                  >
                    <Text style={[styles.dailyDate, { color: theme.textSecondary }]}>
                      {new Date(bucket.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={styles.dailyBarContainer}>
                      <View
                        style={[
                          styles.dailyBar,
                          {
                            backgroundColor: theme.surfaceVariant,
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.dailyBarFill,
                            {
                              backgroundColor:
                                pct >= 100
                                  ? theme.success
                                  : pct >= 50
                                  ? theme.warning
                                  : theme.danger,
                              width: `${Math.min(pct, 100)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={[styles.dailyCount, { color: theme.text }]}>
                      {bucket.callsMade}/{bucket.callTarget}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  filterSection: {
    gap: 10,
    marginBottom: 16,
  },
  dateFilterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  dateBtnText: {
    fontSize: 13,
  },
  dateSep: {
    fontSize: 13,
  },
  staffFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
  },
  staffFilterText: {
    flex: 1,
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "47%",
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 6,
  },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  statCount: {
    fontSize: 22,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  pickerModal: {
    borderRadius: 16,
    maxHeight: 400,
    paddingBottom: 8,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    padding: 16,
    paddingBottom: 8,
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerOptionText: {
    fontSize: 15,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  drillCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  drillCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  drillName: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  drillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 3,
  },
  drillText: {
    fontSize: 13,
  },
  drillDate: {
    fontSize: 11,
    marginTop: 6,
  },
  emptyDrill: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 8,
  },
  emptyDrillText: {
    fontSize: 14,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderRadius: 8,
    paddingVertical: 10,
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  tableNameCell: {
    width: 140,
    paddingLeft: 12,
    textAlign: "left",
  },
  tableNumCell: {
    width: 70,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tableCell: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 4,
  },
  tableCellText: {
    fontSize: 14,
    textAlign: "center" as const,
  },
  tableName: {
    fontSize: 13,
    fontWeight: "600",
  },
  tableDesig: {
    fontSize: 10,
    marginTop: 1,
  },
  emptyTeam: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyTeamText: {
    fontSize: 14,
  },
  callActivityCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  callActivityTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  callTotalLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  callTotalValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  bucketRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bucketRange: {
    fontSize: 13,
  },
  bucketCount: {
    fontSize: 14,
    fontWeight: "700",
  },
  dailyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  dailyDate: {
    fontSize: 12,
    width: 50,
  },
  dailyBarContainer: {
    flex: 1,
  },
  dailyBar: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  dailyBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  dailyCount: {
    fontSize: 12,
    fontWeight: "600",
    width: 50,
    textAlign: "right",
  },
  hourlyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
  },
  hourlyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  hourlyBarsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 140,
    gap: 2,
    marginTop: 12,
    marginBottom: 8,
  },
  hourlyBarCol: {
    flex: 1,
    alignItems: "center",
  },
  hourlyBarCount: {
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 2,
  },
  hourlyBarTrack: {
    width: "80%",
    height: 100,
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  hourlyBarFill: {
    width: "100%",
    borderRadius: 4,
    minHeight: 2,
  },
  hourlyBarLabel: {
    fontSize: 8,
    marginTop: 4,
    textAlign: "center",
  },
  hourlyPeakText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 4,
  },
  breakdownCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
  },
  breakdownTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12,
  },
  breakdownRow: {
    marginBottom: 10,
  },
  breakdownLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  breakdownDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 13,
    flex: 1,
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: "700",
    marginRight: 4,
  },
  breakdownPct: {
    fontSize: 11,
  },
  breakdownBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  breakdownBarFill: {
    height: "100%",
    borderRadius: 3,
  },
});
