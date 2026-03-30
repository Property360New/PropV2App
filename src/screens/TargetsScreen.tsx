import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetTargetSummaryQuery,
  useGetTodayStatsQuery,
  useGetTeamTargetsQuery,
  useGetMyTargetSeriesQuery,
} from "../store/targets.api";
import type { Period } from "../store/targets.api";
import { useGetProfileQuery } from "../store/auth.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import type { TeamTarget, ScopeEmployee } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

// ─── Constants ──────────────────────────────────────────────

const PERIODS: { label: string; value: Period }[] = [
  { label: "1M", value: "1M" },
  { label: "3M", value: "3M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
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

const formatCurrency = (amount: number): string => {
  if (amount >= 10000000) return "\u20B9" + (amount / 10000000).toFixed(1) + " Cr";
  if (amount >= 100000) return "\u20B9" + (amount / 100000).toFixed(1) + " L";
  if (amount >= 1000) return "\u20B9" + (amount / 1000).toFixed(1) + "K";
  return "\u20B9" + amount.toLocaleString("en-IN");
};

const formatNumber = (n: number): string => {
  return n.toLocaleString("en-IN");
};

// ─── Progress Bar Component ─────────────────────────────────

interface ProgressBarProps {
  achieved: number;
  target: number;
  fillColor: string;
  trackColor: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ achieved, target, fillColor, trackColor }) => {
  const pct = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
  return (
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct}%`, backgroundColor: fillColor },
        ]}
      />
    </View>
  );
};

// ─── Component ──────────────────────────────────────────────

export const TargetsScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const { data: profile } = useGetProfileQuery();

  const isManager = profile ? MANAGER_DESIGNATIONS.includes(profile.designation) : false;

  // Period selector
  const [period, setPeriod] = useState<Period>("1M");

  // Staff filter for managers
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

  // Scope employees
  const { data: scopeEmployees } = useGetScopeEmployeesQuery(undefined, { skip: !isManager });

  // Target summary
  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useGetTargetSummaryQuery({ period, employeeId: selectedEmployeeId });

  // Today stats
  const {
    data: todayStats,
    isLoading: todayLoading,
    refetch: refetchToday,
  } = useGetTodayStatsQuery(selectedEmployeeId ? { employeeId: selectedEmployeeId } : undefined);

  // Team targets (for managers)
  const now = new Date();
  const {
    data: teamTargets,
    isLoading: teamLoading,
    refetch: refetchTeam,
  } = useGetTeamTargetsQuery(
    { month: now.getMonth() + 1, year: now.getFullYear() },
    { skip: !isManager }
  );

  // Activity trend series
  const { data: targetSeries, refetch: refetchSeries } = useGetMyTargetSeriesQuery(
    { months: 12, ...(selectedEmployeeId ? { employeeId: selectedEmployeeId } : {}) }
  );

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchSummary(),
      refetchToday(),
      refetchSeries(),
      ...(isManager ? [refetchTeam()] : []),
    ]);
    setRefreshing(false);
  };

  // Selected staff label
  const selectedEmployee = useMemo(() => {
    if (!selectedEmployeeId || !scopeEmployees) return null;
    return scopeEmployees.find((e) => e.id === selectedEmployeeId) ?? null;
  }, [selectedEmployeeId, scopeEmployees]);

  const selectedLabel = selectedEmployee
    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
    : "All Staff (Self)";

  // ─── Loading ───────────────────────────────────────────────

  if (summaryLoading && todayLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader title="Targets" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.targetCustomers} />}
        />
        <LoadingScreen message="Loading targets..." />
      </View>
    );
  }

  const achieved = summary?.achieved ?? {
    calls: 0,
    queries: 0,
    remarks: 0,
    visits: 0,
    meetings: 0,
    deals: 0,
    salesRevenue: 0,
    incentive: 0,
  };
  const targets = summary?.targets ?? { calls: 0, salesRevenue: 0 };
  const callPct = targets.calls > 0 ? Math.round((achieved.calls / targets.calls) * 100) : 0;
  const salesPct =
    targets.salesRevenue > 0 ? Math.round((achieved.salesRevenue / targets.salesRevenue) * 100) : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Targets"
      rightAction={<TutorialButton videoUrl={TUTORIALS.targetCustomers} />}
       />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[
                styles.periodBtn,
                {
                  backgroundColor: period === p.value ? theme.gold : theme.surfaceVariant,
                  borderColor: period === p.value ? theme.gold : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodBtnText,
                  { color: period === p.value ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Staff filter (managers) */}
        {isManager && scopeEmployees && scopeEmployees.length > 0 && (
          <View style={styles.staffFilterContainer}>
            <TouchableOpacity
              onPress={() => setShowStaffDropdown(!showStaffDropdown)}
              style={[
                styles.staffDropdownBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
              ]}
            >
              <Ionicons name="person-outline" size={16} color={theme.mauve} />
              <Text style={[styles.staffDropdownText, { color: theme.text }]} numberOfLines={1}>
                {selectedLabel}
              </Text>
              <Ionicons
                name={showStaffDropdown ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textSecondary}
              />
            </TouchableOpacity>

            {showStaffDropdown && (
              <View
                style={[
                  styles.staffDropdownList,
                  { backgroundColor: theme.card, borderColor: theme.border },
                ]}
              >
                <TouchableOpacity
                  onPress={() => {
                    setSelectedEmployeeId(undefined);
                    setShowStaffDropdown(false);
                  }}
                  style={[
                    styles.staffDropdownItem,
                    { borderBottomColor: theme.divider },
                    !selectedEmployeeId && { backgroundColor: theme.goldLight },
                  ]}
                >
                  <Text style={[styles.staffDropdownItemText, { color: theme.text }]}>
                    Self (My Targets)
                  </Text>
                  {!selectedEmployeeId && (
                    <Ionicons name="checkmark" size={16} color={theme.gold} />
                  )}
                </TouchableOpacity>
                {scopeEmployees.map((emp) => (
                  <TouchableOpacity
                    key={emp.id}
                    onPress={() => {
                      setSelectedEmployeeId(emp.id);
                      setShowStaffDropdown(false);
                    }}
                    style={[
                      styles.staffDropdownItem,
                      { borderBottomColor: theme.divider },
                      selectedEmployeeId === emp.id && { backgroundColor: theme.goldLight },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.staffDropdownItemText, { color: theme.text }]}>
                        {emp.firstName} {emp.lastName}
                      </Text>
                      <Text style={[styles.staffDropdownItemSub, { color: theme.textTertiary }]}>
                        {emp.designation.replace(/_/g, " ")}
                      </Text>
                    </View>
                    {selectedEmployeeId === emp.id && (
                      <Ionicons name="checkmark" size={16} color={theme.gold} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {summaryFetching && (
          <View style={styles.fetchingIndicator}>
            <ActivityIndicator size="small" color={theme.gold} />
          </View>
        )}

        {/* ─── Calls Target Card ──────────────────────────── */}
        <View style={[styles.targetCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.targetCardHeader}>
            <View style={styles.targetCardIcon}>
              <Ionicons name="call-outline" size={20} color={theme.mauve} />
            </View>
            <Text style={[styles.targetCardTitle, { color: theme.text }]}>Calls</Text>
            <Text style={[styles.targetCardPct, { color: theme.gold }]}>{callPct}%</Text>
          </View>
          <View style={styles.targetCardNumbers}>
            <Text style={[styles.achievedNumber, { color: theme.gold }]}>
              {formatNumber(achieved.calls)}
            </Text>
            <Text style={[styles.targetSeparator, { color: theme.textTertiary }]}> / </Text>
            <Text style={[styles.targetNumber, { color: theme.textSecondary }]}>
              {formatNumber(targets.calls)}
            </Text>
          </View>
          <ProgressBar
            achieved={achieved.calls}
            target={targets.calls}
            fillColor={theme.gold}
            trackColor={theme.surfaceVariant}
          />
        </View>

        {/* ─── Sales Revenue Card ─────────────────────────── */}
        <View style={[styles.targetCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.targetCardHeader}>
            <View style={styles.targetCardIcon}>
              <Ionicons name="cash-outline" size={20} color={theme.success} />
            </View>
            <Text style={[styles.targetCardTitle, { color: theme.text }]}>Sales Revenue</Text>
            <Text style={[styles.targetCardPct, { color: theme.gold }]}>{salesPct}%</Text>
          </View>
          <View style={styles.targetCardNumbers}>
            <Text style={[styles.achievedNumber, { color: theme.gold }]}>
              {formatCurrency(achieved.salesRevenue)}
            </Text>
            <Text style={[styles.targetSeparator, { color: theme.textTertiary }]}> / </Text>
            <Text style={[styles.targetNumber, { color: theme.textSecondary }]}>
              {formatCurrency(targets.salesRevenue)}
            </Text>
          </View>
          <ProgressBar
            achieved={achieved.salesRevenue}
            target={targets.salesRevenue}
            fillColor={theme.gold}
            trackColor={theme.surfaceVariant}
          />
        </View>

        {/* ─── Target vs Achievement Chart ─────────────────── */}
        <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.chartTitle, { color: theme.text }]}>Target vs Achievement</Text>

          {/* Calls bar */}
          <View style={styles.chartRow}>
            <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>Calls</Text>
            <View style={styles.chartBarsContainer}>
              <View style={styles.chartBarGroup}>
                <View style={[styles.chartBar, { backgroundColor: theme.gold, width: `${Math.min((achieved.calls / Math.max(targets.calls, 1)) * 100, 100)}%` }]} />
                <Text style={[styles.chartBarValue, { color: theme.gold }]}>{achieved.calls}</Text>
              </View>
              <View style={styles.chartBarGroup}>
                <View style={[styles.chartBar, { backgroundColor: theme.surfaceVariant, width: '100%' }]} />
                <Text style={[styles.chartBarValue, { color: theme.textTertiary }]}>{targets.calls}</Text>
              </View>
            </View>
          </View>

          {/* Visits, Meetings, Deals bars */}
          {[
            { label: "Visits", value: achieved.visits, color: theme.info },
            { label: "Meetings", value: achieved.meetings, color: theme.mauve },
            { label: "Deals", value: achieved.deals, color: theme.success },
          ].map(item => {
            const maxVal = Math.max(achieved.visits, achieved.meetings, achieved.deals, 1);
            return (
              <View key={item.label} style={styles.chartRow}>
                <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>{item.label}</Text>
                <View style={styles.chartBarsContainer}>
                  <View style={[styles.chartBar, { backgroundColor: item.color, width: `${Math.min((item.value / maxVal) * 100, 100)}%`, minWidth: item.value > 0 ? 20 : 0 }]} />
                  <Text style={[styles.chartBarValue, { color: item.color }]}>{item.value}</Text>
                </View>
              </View>
            );
          })}

          {/* Legend */}
          <View style={styles.chartLegend}>
            <View style={styles.chartLegendItem}>
              <View style={[styles.chartLegendDot, { backgroundColor: theme.gold }]} />
              <Text style={[styles.chartLegendText, { color: theme.textSecondary }]}>Achieved</Text>
            </View>
            <View style={styles.chartLegendItem}>
              <View style={[styles.chartLegendDot, { backgroundColor: theme.surfaceVariant }]} />
              <Text style={[styles.chartLegendText, { color: theme.textSecondary }]}>Target</Text>
            </View>
          </View>
        </View>

        {/* ─── Count Cards Row ────────────────────────────── */}
        <View style={styles.countCardsRow}>
          <View style={[styles.countCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="briefcase-outline" size={20} color={theme.success} />
            <Text style={[styles.countCardValue, { color: theme.text }]}>
              {formatNumber(achieved.deals)}
            </Text>
            <Text style={[styles.countCardLabel, { color: theme.textSecondary }]}>Deals</Text>
          </View>
          <View style={[styles.countCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="navigate-outline" size={20} color={theme.info} />
            <Text style={[styles.countCardValue, { color: theme.text }]}>
              {formatNumber(achieved.visits)}
            </Text>
            <Text style={[styles.countCardLabel, { color: theme.textSecondary }]}>Visits</Text>
          </View>
          <View style={[styles.countCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="people-outline" size={20} color={theme.mauve} />
            <Text style={[styles.countCardValue, { color: theme.text }]}>
              {formatNumber(achieved.meetings)}
            </Text>
            <Text style={[styles.countCardLabel, { color: theme.textSecondary }]}>Meetings</Text>
          </View>
          <View style={[styles.countCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.warning} />
            <Text style={[styles.countCardValue, { color: theme.text }]}>
              {formatNumber(achieved.remarks)}
            </Text>
            <Text style={[styles.countCardLabel, { color: theme.textSecondary }]}>Remarks</Text>
          </View>
        </View>

        {/* ─── Incentive Card ─────────────────────────────── */}
        <View style={[styles.incentiveCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.incentiveHeader}>
            <Ionicons name="diamond-outline" size={20} color={theme.gold} />
            <Text style={[styles.incentiveTitle, { color: theme.text }]}>Incentive Earned</Text>
          </View>
          <Text style={[styles.incentiveAmount, { color: theme.gold }]}>
            {formatCurrency(achieved.incentive)}
          </Text>
          <View style={styles.incentiveGrid}>
            <View style={styles.incentiveGridItem}>
              <Text style={[styles.incentiveGridValue, { color: theme.text }]}>
                {formatCurrency(achieved.salesRevenue)}
              </Text>
              <Text style={[styles.incentiveGridLabel, { color: theme.textTertiary }]}>Revenue</Text>
            </View>
            <View style={styles.incentiveGridItem}>
              <Text style={[styles.incentiveGridValue, { color: theme.text }]}>{achieved.deals}</Text>
              <Text style={[styles.incentiveGridLabel, { color: theme.textTertiary }]}>Deals</Text>
            </View>
            <View style={styles.incentiveGridItem}>
              <Text style={[styles.incentiveGridValue, { color: theme.text }]}>
                {formatCurrency(achieved.incentive)}
              </Text>
              <Text style={[styles.incentiveGridLabel, { color: theme.textTertiary }]}>Incentive</Text>
            </View>
            <View style={styles.incentiveGridItem}>
              <Text style={[styles.incentiveGridValue, { color: theme.text }]}>{achieved.calls}</Text>
              <Text style={[styles.incentiveGridLabel, { color: theme.textTertiary }]}>Calls</Text>
            </View>
          </View>
        </View>

        {/* ─── Today's Stats ──────────────────────────────── */}
        <View style={[styles.todayCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.todayHeader}>
            <Ionicons name="today-outline" size={18} color={theme.gold} />
            <Text style={[styles.todayTitle, { color: theme.text }]}>Today's Stats</Text>
          </View>
          {todayLoading ? (
            <ActivityIndicator size="small" color={theme.gold} style={{ marginVertical: 12 }} />
          ) : (
            <>
              <View style={styles.todayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.todayLabel, { color: theme.textSecondary }]}>
                    Calls Today
                  </Text>
                  <View style={styles.todayNumbers}>
                    <Text style={[styles.todayAchieved, { color: theme.gold }]}>
                      {todayStats?.calls ?? 0}
                    </Text>
                    <Text style={[styles.todayTarget, { color: theme.textTertiary }]}>
                      {" "}/ {todayStats?.dailyCallTarget ?? profile?.dailyCallTarget ?? 0}
                    </Text>
                  </View>
                  <ProgressBar
                    achieved={todayStats?.calls ?? 0}
                    target={todayStats?.dailyCallTarget ?? profile?.dailyCallTarget ?? 0}
                    fillColor={theme.gold}
                    trackColor={theme.surfaceVariant}
                  />
                </View>
              </View>
              <View style={[styles.todayMetricsRow, { borderTopColor: theme.divider }]}>
                <View style={styles.todayMetric}>
                  <Text style={[styles.todayMetricValue, { color: theme.text }]}>
                    {todayStats?.visits ?? 0}
                  </Text>
                  <Text style={[styles.todayMetricLabel, { color: theme.textTertiary }]}>
                    Visits
                  </Text>
                </View>
                <View style={[styles.todayMetricDivider, { backgroundColor: theme.divider }]} />
                <View style={styles.todayMetric}>
                  <Text style={[styles.todayMetricValue, { color: theme.text }]}>
                    {todayStats?.meetings ?? 0}
                  </Text>
                  <Text style={[styles.todayMetricLabel, { color: theme.textTertiary }]}>
                    Meetings
                  </Text>
                </View>
                <View style={[styles.todayMetricDivider, { backgroundColor: theme.divider }]} />
                <View style={styles.todayMetric}>
                  <Text style={[styles.todayMetricValue, { color: theme.text }]}>
                    {todayStats?.deals ?? 0}
                  </Text>
                  <Text style={[styles.todayMetricLabel, { color: theme.textTertiary }]}>
                    Deals
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ─── Activity Trend - Last 12 Months ──────────── */}
        {targetSeries && targetSeries.length > 0 && (
          <View style={[styles.trendCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.trendTitle, { color: theme.text }]}>Activity Trend — Last 12 Months</Text>

            {/* Chart area */}
            <View style={styles.trendChart}>
              {(() => {
                const sorted = [...targetSeries].sort((a, b) => {
                  const aDate = new Date(a.year, a.month - 1);
                  const bDate = new Date(b.year, b.month - 1);
                  return aDate.getTime() - bDate.getTime();
                });

                const maxCalls = Math.max(...sorted.map(t => t.callsAchieved ?? 0), 1);
                const maxDeals = Math.max(...sorted.map(t => t.dealsAchieved ?? 0), 1);

                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

                return (
                  <>
                    {/* Bars for calls with dots for deals */}
                    <View style={styles.trendBarsRow}>
                      {sorted.map((entry, idx) => {
                        const callPctBar = ((entry.callsAchieved ?? 0) / maxCalls) * 100;
                        const dealCount = entry.dealsAchieved ?? 0;
                        return (
                          <View key={idx} style={styles.trendBarCol}>
                            <Text style={[styles.trendBarValue, { color: theme.gold }]}>
                              {entry.callsAchieved ?? 0}
                            </Text>
                            <View style={[styles.trendBarTrack, { backgroundColor: theme.surfaceVariant }]}>
                              <View style={[styles.trendBarFill, { height: `${Math.max(callPctBar, 3)}%`, backgroundColor: theme.gold }]} />
                            </View>
                            {dealCount > 0 && (
                              <View style={[styles.trendDealDot, { backgroundColor: theme.success }]}>
                                <Text style={styles.trendDealDotText}>{dealCount}</Text>
                              </View>
                            )}
                            <Text style={[styles.trendMonthLabel, { color: theme.textTertiary }]}>
                              {monthNames[(entry.month - 1) % 12]}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                    {/* Legend */}
                    <View style={styles.trendLegend}>
                      <View style={styles.trendLegendItem}>
                        <View style={[styles.trendLegendDot, { backgroundColor: theme.gold }]} />
                        <Text style={[styles.trendLegendText, { color: theme.textSecondary }]}>Calls</Text>
                      </View>
                      <View style={styles.trendLegendItem}>
                        <View style={[styles.trendLegendDot, { backgroundColor: theme.success }]} />
                        <Text style={[styles.trendLegendText, { color: theme.textSecondary }]}>Deals</Text>
                      </View>
                    </View>
                  </>
                );
              })()}
            </View>
          </View>
        )}

        {/* ─── Team Targets Table (managers only) ─────────── */}
        {isManager && (
          <View style={styles.teamSection}>
            <View style={styles.teamSectionHeader}>
              <Ionicons name="people" size={18} color={theme.mauve} />
              <Text style={[styles.teamSectionTitle, { color: theme.text }]}>Team Targets</Text>
            </View>

            {teamLoading ? (
              <ActivityIndicator size="small" color={theme.gold} style={{ marginVertical: 20 }} />
            ) : !teamTargets || teamTargets.length === 0 ? (
              <View
                style={[
                  styles.teamEmptyCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <Text style={[styles.teamEmptyText, { color: theme.textSecondary }]}>
                  No team targets for this period
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Table header */}
                  <View
                    style={[
                      styles.tableHeaderRow,
                      { backgroundColor: theme.surfaceVariant, borderColor: theme.border },
                    ]}
                  >
                    <Text
                      style={[styles.tableHeaderCell, styles.tableNameCell, { color: theme.textSecondary }]}
                    >
                      Name
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableDataCell, { color: theme.textSecondary }]}>
                      Calls
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableDataCell, { color: theme.textSecondary }]}>
                      Sales
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableSmallCell, { color: theme.textSecondary }]}>
                      Deals
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableSmallCell, { color: theme.textSecondary }]}>
                      Visits
                    </Text>
                    <Text style={[styles.tableHeaderCell, styles.tableSmallCell, { color: theme.textSecondary }]}>
                      Meetings
                    </Text>
                  </View>

                  {/* Table rows */}
                  {teamTargets.map((tt, index) => {
                    const empName = tt.employee
                      ? `${tt.employee.firstName} ${tt.employee.lastName}`
                      : tt.employeeId.slice(0, 8);
                    const rowCallPct =
                      tt.callTarget > 0
                        ? Math.round((tt.callsAchieved / tt.callTarget) * 100)
                        : 0;
                    const rowSalesPct =
                      tt.salesTarget > 0
                        ? Math.round((tt.salesAchieved / tt.salesTarget) * 100)
                        : 0;

                    return (
                      <View
                        key={tt.id ?? `${tt.employeeId}-${index}`}
                        style={[
                          styles.tableRow,
                          {
                            backgroundColor: index % 2 === 0 ? theme.card : theme.surface,
                            borderColor: theme.cardBorder,
                          },
                        ]}
                      >
                        <View style={[styles.tableCell, styles.tableNameCell]}>
                          <Text style={[styles.tableCellName, { color: theme.text }]} numberOfLines={1}>
                            {empName}
                          </Text>
                          {tt.employee?.designation && (
                            <Text style={[styles.tableCellDesignation, { color: theme.textTertiary }]}>
                              {tt.employee.designation.replace(/_/g, " ")}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.tableCell, styles.tableDataCell]}>
                          <Text style={[styles.tableCellValue, { color: theme.text }]}>
                            {tt.callsAchieved}/{tt.callTarget}
                          </Text>
                          <ProgressBar
                            achieved={tt.callsAchieved}
                            target={tt.callTarget}
                            fillColor={theme.gold}
                            trackColor={theme.surfaceVariant}
                          />
                        </View>
                        <View style={[styles.tableCell, styles.tableDataCell]}>
                          <Text style={[styles.tableCellValue, { color: theme.text }]}>
                            {formatCurrency(tt.salesAchieved)}
                          </Text>
                          <Text style={[styles.tableCellSub, { color: theme.textTertiary }]}>
                            / {formatCurrency(tt.salesTarget)}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.tableSmallCell]}>
                          <Text style={[styles.tableCellValue, { color: theme.text }]}>
                            {tt.dealsAchieved}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.tableSmallCell]}>
                          <Text style={[styles.tableCellValue, { color: theme.text }]}>
                            {tt.visitsAchieved}
                          </Text>
                        </View>
                        <View style={[styles.tableCell, styles.tableSmallCell]}>
                          <Text style={[styles.tableCellValue, { color: theme.text }]}>
                            {tt.meetingsAchieved}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Period selector
  periodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Staff filter
  staffFilterContainer: {
    marginBottom: 14,
    zIndex: 10,
  },
  staffDropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  staffDropdownText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  staffDropdownList: {
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    maxHeight: 240,
    overflow: "hidden",
  },
  staffDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  staffDropdownItemText: {
    fontSize: 14,
    fontWeight: "500",
  },
  staffDropdownItemSub: {
    fontSize: 11,
    marginTop: 1,
  },

  fetchingIndicator: {
    alignItems: "center",
    marginBottom: 8,
  },

  // Target cards
  targetCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  targetCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  targetCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  targetCardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  targetCardPct: {
    fontSize: 18,
    fontWeight: "800",
  },
  targetCardNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 10,
  },
  achievedNumber: {
    fontSize: 22,
    fontWeight: "800",
  },
  targetSeparator: {
    fontSize: 16,
  },
  targetNumber: {
    fontSize: 16,
    fontWeight: "500",
  },

  // Progress bar
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },

  // Chart card
  chartCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  chartLabel: {
    width: 70,
    fontSize: 13,
    fontWeight: "500",
  },
  chartBarsContainer: {
    flex: 1,
    gap: 4,
  },
  chartBarGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartBar: {
    height: 14,
    borderRadius: 7,
    minWidth: 4,
  },
  chartBarValue: {
    fontSize: 12,
    fontWeight: "700",
  },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  chartLegendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chartLegendText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Incentive card
  incentiveCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  incentiveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  incentiveTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  incentiveAmount: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 14,
  },
  incentiveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  incentiveGridItem: {
    width: "50%",
    paddingVertical: 8,
    alignItems: "center",
  },
  incentiveGridValue: {
    fontSize: 16,
    fontWeight: "700",
  },
  incentiveGridLabel: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },

  // Count cards
  countCardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  countCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  countCardValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  countCardLabel: {
    fontSize: 11,
    fontWeight: "500",
  },

  // Today's stats
  todayCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  todayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  todayTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  todayRow: {
    marginBottom: 12,
  },
  todayLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  todayNumbers: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 8,
  },
  todayAchieved: {
    fontSize: 28,
    fontWeight: "800",
  },
  todayTarget: {
    fontSize: 16,
    fontWeight: "500",
  },
  todayMetricsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 12,
  },
  todayMetric: {
    flex: 1,
    alignItems: "center",
  },
  todayMetricValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  todayMetricLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  todayMetricDivider: {
    width: 1,
    height: "100%",
  },

  // Activity Trend
  trendCard: { borderRadius: 14, borderWidth: 1, padding: 16, marginBottom: 14 },
  trendTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  trendChart: {},
  trendBarsRow: { flexDirection: "row", alignItems: "flex-end", height: 140, gap: 2, marginTop: 12 },
  trendBarCol: { flex: 1, alignItems: "center" },
  trendBarValue: { fontSize: 8, fontWeight: "600", marginBottom: 2 },
  trendBarTrack: { width: "75%", height: 100, borderRadius: 4, overflow: "hidden", justifyContent: "flex-end" },
  trendBarFill: { width: "100%", borderRadius: 4 },
  trendDealDot: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 2 },
  trendDealDotText: { color: "#fff", fontSize: 8, fontWeight: "700" },
  trendMonthLabel: { fontSize: 8, marginTop: 2 },
  trendLegend: { flexDirection: "row", gap: 16, justifyContent: "center", marginTop: 8 },
  trendLegendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  trendLegendDot: { width: 8, height: 8, borderRadius: 4 },
  trendLegendText: { fontSize: 11 },

  // Team section
  teamSection: {
    marginTop: 4,
  },
  teamSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  teamSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  teamEmptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  teamEmptyText: {
    fontSize: 14,
  },

  // Table
  tableHeaderRow: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  tableCell: {
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tableNameCell: {
    width: 120,
  },
  tableDataCell: {
    width: 100,
  },
  tableSmallCell: {
    width: 70,
    alignItems: "center",
  },
  tableCellName: {
    fontSize: 13,
    fontWeight: "600",
  },
  tableCellDesignation: {
    fontSize: 10,
    marginTop: 1,
  },
  tableCellValue: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  tableCellSub: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 1,
  },
});

export default TargetsScreen;
