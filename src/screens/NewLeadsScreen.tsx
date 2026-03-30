import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { StatusBadge } from "../components/common/StatusBadge";
import { PaginationBar } from "../components/common/PaginationBar";
import { EmptyState } from "../components/common/EmptyState";
import { useGetAllLeadsQuery } from "../store/leads.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import { useGetProfileQuery } from "../store/auth.api";
import type { Lead } from "../types";
import DateTimePicker from "@react-native-community/datetimepicker";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

const MANAGER_DESIGNATIONS = [
  "TEAM_LEAD",
  "SALES_MANAGER",
  "AREA_MANAGER",
  "DGM",
  "GM",
  "VP_SALES",
  "ADMIN",
];

interface LeadCardProps {
  lead: Lead;
  onPress: () => void;
}

const LeadCard: React.FC<LeadCardProps> = ({ lead, onPress }) => {
  const { theme } = useTheme();
  const latestStatus = lead.latestQuery?.status || lead.queries?.[0]?.status || "FRESH";
  const assignedName = lead.assignedTo
    ? [lead.assignedTo.firstName, lead.assignedTo.lastName].filter(Boolean).join(" ")
    : "Unassigned";

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.leadCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
    >
      <View style={styles.leadCardTop}>
        <View style={styles.leadInfo}>
          <Text style={[styles.leadName, { color: theme.text }]} numberOfLines={1}>
            {lead.name}
          </Text>
          <View style={styles.phoneRow}>
            <Ionicons name="call-outline" size={13} color={theme.textTertiary} />
            <Text style={[styles.leadPhone, { color: theme.textSecondary }]}>
              {lead.phone}
            </Text>
          </View>
        </View>
        <StatusBadge status={latestStatus} small />
      </View>

      <View style={[styles.leadCardBottom, { borderTopColor: theme.divider }]}>
        {lead.source && (
          <View style={styles.metaItem}>
            <Ionicons name="megaphone-outline" size={13} color={theme.textTertiary} />
            <Text style={[styles.metaText, { color: theme.textTertiary }]} numberOfLines={1}>
              {lead.source}
            </Text>
          </View>
        )}
        <View style={styles.metaItem}>
          <Ionicons name="person-outline" size={13} color={theme.textTertiary} />
          <Text style={[styles.metaText, { color: theme.textTertiary }]} numberOfLines={1}>
            {assignedName}
          </Text>
        </View>
        <View style={styles.metaItem}>
    <Ionicons name="calendar-outline" size={13} color={theme.textTertiary} />
    <Text style={[styles.metaText, { color: theme.textTertiary }]}>
      {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
    </Text>
  </View>
      </View>
    </TouchableOpacity>
  );
};

export const NewLeadsScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { data: profile } = useGetProfileQuery();

  const isManager = useMemo(
    () => profile ? MANAGER_DESIGNATIONS.includes(profile.designation) : false,
    [profile]
  );

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedStaffId, setSelectedStaffId] = useState<string | undefined>(undefined);
  const [showStaffFilter, setShowStaffFilter] = useState(false);
  const [filterMode, setFilterMode] = useState<"assigned" | "created">("assigned");
  const [pageSize, setPageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDateFromPicker, setShowDateFromPicker] = useState(false);
  const [showDateToPicker, setShowDateToPicker] = useState(false);

  const { data: scopeEmployees } = useGetScopeEmployeesQuery(undefined, { skip: !isManager });

  const {
    data: leadsResponse,
    isLoading,
    isFetching,
    refetch,
  } = useGetAllLeadsQuery({
    page,
    limit: pageSize,
    search: debouncedSearch || undefined,
    dateFrom: dateFrom || undefined,    // ADD
    dateTo: dateTo || undefined,        // ADD
    ...(selectedStaffId
      ? filterMode === "assigned"
        ? { assignedToId: selectedStaffId }
        : { createdById: selectedStaffId }
      : {}),
  });

  // Debounce search
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearch = useCallback(
    (text: string) => {
      setSearch(text);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        setDebouncedSearch(text);
        setPage(1);
      }, 500);
    },
    []
  );

  const leads = leadsResponse?.data || [];
  const meta = leadsResponse?.meta || { page: 1, totalPages: 1, total: 0, limit: 20 };

  const handleLeadPress = useCallback(
    (leadId: string) => {
      navigation.navigate("LeadDetail", { leadId });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: Lead }) => (
      <LeadCard lead={item} onPress={() => handleLeadPress(item.id)} />
    ),
    [handleLeadPress]
  );

  const selectedStaffName = useMemo(() => {
    if (!selectedStaffId || !scopeEmployees) return "All Staff";
    const emp = scopeEmployees.find((e) => e.id === selectedStaffId);
    return emp ? [emp.firstName, emp.lastName].filter(Boolean).join(" ") : "All Staff";
  }, [selectedStaffId, scopeEmployees]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="All Leads" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.newLeads} />}/>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputWrapper, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <Ionicons name="search-outline" size={18} color={theme.placeholder} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search leads by name or phone..."
            placeholderTextColor={theme.placeholder}
            value={search}
            onChangeText={handleSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Staff Filter */}
        {isManager && (
          <TouchableOpacity
            onPress={() => setShowStaffFilter(!showStaffFilter)}
            style={[styles.filterBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
          >
            <Ionicons name="filter-outline" size={16} color={theme.mauve} />
            <Text style={[styles.filterBtnText, { color: theme.mauve }]} numberOfLines={1}>
              {selectedStaffName}
            </Text>
            <Ionicons
              name={showStaffFilter ? "chevron-up" : "chevron-down"}
              size={14}
              color={theme.mauve}
            />
          </TouchableOpacity>
        )}

        {/* Date range filter */}
        <View style={styles.dateRow}>
          <TouchableOpacity
            onPress={() => setShowDateFromPicker(true)}
            style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: dateFrom ? theme.gold : theme.inputBorder }]}
          >
            <Ionicons name="calendar-outline" size={14} color={dateFrom ? theme.gold : theme.textTertiary} />
            <Text style={[styles.dateBtnText, { color: dateFrom ? theme.text : theme.placeholder }]}>
              {dateFrom || "From date"}
            </Text>
            {dateFrom && (
              <TouchableOpacity onPress={() => { setDateFrom(""); setPage(1); }}>
                <Ionicons name="close-circle" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <Text style={[styles.dateSep, { color: theme.textTertiary }]}>→</Text>

          <TouchableOpacity
            onPress={() => setShowDateToPicker(true)}
            style={[styles.dateBtn, { backgroundColor: theme.inputBg, borderColor: dateTo ? theme.gold : theme.inputBorder }]}
          >
            <Ionicons name="calendar-outline" size={14} color={dateTo ? theme.gold : theme.textTertiary} />
            <Text style={[styles.dateBtnText, { color: dateTo ? theme.text : theme.placeholder }]}>
              {dateTo || "To date"}
            </Text>
            {dateTo && (
              <TouchableOpacity onPress={() => { setDateTo(""); setPage(1); }}>
                <Ionicons name="close-circle" size={14} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>

        {showDateFromPicker && (
          <DateTimePicker
            value={dateFrom ? new Date(dateFrom) : new Date()}
            mode="date" display="default"
            onChange={(_, d) => {
              setShowDateFromPicker(false);
              if (d) { setDateFrom(d.toISOString().split("T")[0]); setPage(1); }
            }}
          />
        )}
        {showDateToPicker && (
          <DateTimePicker
            value={dateTo ? new Date(dateTo) : new Date()}
            mode="date" display="default"
            onChange={(_, d) => {
              setShowDateToPicker(false);
              if (d) { setDateTo(d.toISOString().split("T")[0]); setPage(1); }
            }}
          />
        )}
      </View>

      {/* Staff Filter Dropdown */}
      {showStaffFilter && isManager && scopeEmployees && (
        <View style={[styles.filterDropdown, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => {
              setSelectedStaffId(undefined);
              setFilterMode("assigned");
              setShowStaffFilter(false);
              setPage(1);
            }}
            style={[
              styles.filterItem,
              !selectedStaffId && { backgroundColor: theme.goldLight },
            ]}
          >
            <Text style={[styles.filterItemText, { color: !selectedStaffId ? theme.goldDark : theme.text }]}>
              All Staff
            </Text>
          </TouchableOpacity>
          {scopeEmployees.map((emp) => (
            <TouchableOpacity
              key={emp.id}
              onPress={() => {
                setSelectedStaffId(emp.id);
                setShowStaffFilter(false);
                setPage(1);
              }}
              style={[
                styles.filterItem,
                selectedStaffId === emp.id && { backgroundColor: theme.goldLight },
              ]}
            >
              <Text
                style={[
                  styles.filterItemText,
                  { color: selectedStaffId === emp.id ? theme.goldDark : theme.text },
                ]}
                numberOfLines={1}
              >
                {[emp.firstName, emp.lastName].filter(Boolean).join(" ")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filter Mode Tabs */}
      {selectedStaffId && (
        <View style={[styles.filterModeRow, { backgroundColor: theme.background }]}>
          <TouchableOpacity
            onPress={() => { setFilterMode("assigned"); setPage(1); }}
            style={[styles.filterModeBtn, { backgroundColor: filterMode === "assigned" ? theme.gold : theme.surfaceVariant }]}
          >
            <Text style={[styles.filterModeBtnText, { color: filterMode === "assigned" ? "#FFFFFF" : theme.textSecondary }]}>
              Assigned To
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setFilterMode("created"); setPage(1); }}
            style={[styles.filterModeBtn, { backgroundColor: filterMode === "created" ? theme.gold : theme.surfaceVariant }]}
          >
            <Text style={[styles.filterModeBtnText, { color: filterMode === "created" ? "#FFFFFF" : theme.textSecondary }]}>
              Created By
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Leads List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading leads...
          </Text>
        </View>
      ) : leads.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No Leads Found"
          subtitle={search ? "Try adjusting your search criteria." : "No leads are available."}
        />
      ) : (
        <>
          {/* Pagination above list */}
          {meta.total > 0 && (
            <PaginationBar
              inline
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              pageSize={pageSize}
              pageSizes={[10, 20, 50, 100]}
              onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            />
          )}
          <FlatList
            data={leads}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor={theme.gold}
                colors={[theme.gold]}
              />
            }
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: 44,
  },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
    alignSelf: "flex-start",
  },
  filterBtnText: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: 160,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 5,
  },
  dateBtnText: {
    flex: 1,
    fontSize: 12,
  },
  dateSep: {
    fontSize: 13,
  },
  filterDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    marginHorizontal: 16,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    maxHeight: 240,
  },
  filterModeRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterModeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  filterModeBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterItemText: {
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 8,
  },
  leadCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  leadCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 14,
  },
  leadInfo: {
    flex: 1,
    marginRight: 10,
  },
  leadName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  leadPhone: {
    fontSize: 13,
  },
  leadCardBottom: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    maxWidth: 120,
  },
});

export default NewLeadsScreen;
