import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  StyleSheet,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../lib/theme";
import { useAppSelector } from "../store";
import {
  useGetTabCountsQuery,
  useGetFreshLeadsQuery,
  useGetLeadsByStatusQuery,
  useCreateLeadMutation,
  useAddQueryMutation,
  useAddRemarkMutation,
  useAssignLeadMutation,
  useBulkAssignMutation,
  useDeleteLeadMutation,
} from "../store/leads.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import { useGetProjectsDropdownQuery } from "../store/projects.api";
import { useRenderTemplateMutation } from "../store/whatsapp.api";
import { useImportLeadsMutation, useLazyDownloadTemplateQuery, useGetImportHistoryQuery } from "../store/bulk-import.api";
import type { ImportResult } from "../store/bulk-import.api";
import * as DocumentPicker from "expo-document-picker";
import { StatusBadge } from "../components/common/StatusBadge";
import { PaginationBar } from "../components/common/PaginationBar";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import type { Lead, LeadStatus, LeadQuery } from "../types";
import type { CreateQueryBody } from "../store/leads.api";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

// ─── Constants ───────────────────────────────────────────────
const STATUS_TABS_ROW1: LeadStatus[] = [
  "FRESH", "FOLLOW_UP", "VISIT_DONE", "MEETING_DONE", "RINGING", "CALL_BACK", "NOT_INTERESTED",
];
 
const STATUS_TABS_ROW2: LeadStatus[] = [
  "DEAL_DONE",  "MEETING_DONE", "HOT_PROSPECT", "SUSPECT", "SWITCH_OFF", "WRONG_NUMBER",
];
 
// Keep STATUS_TABS as a flat union for any logic that still needs the full list:
const STATUS_TABS: LeadStatus[] = [...STATUS_TABS_ROW1, ...STATUS_TABS_ROW2];

const STATUS_LABELS: Record<string, string> = {
  FRESH: "Fresh", FOLLOW_UP: "Follow Up", VISIT_DONE: "Visit Done",
  MEETING_DONE: "Meeting Done", RINGING: "Ringing", CALL_BACK: "Call Back",
  DEAL_DONE: "Deal Done", NOT_INTERESTED: "Not Interested", HOT_PROSPECT: "Hot Prospect",
  SUSPECT: "Suspect", SWITCH_OFF: "Switch Off", WRONG_NUMBER: "Wrong Number",
};

const PAGE_SIZE = 20;

// ─── Main component ─────────────────────────────────────────
export const LeadsScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const employee = useAppSelector((s) => s.auth.employee);

  const [activeTab, setActiveTab] = useState<LeadStatus>("FRESH");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [queryLeadId, setQueryLeadId] = useState<string>("");
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [pageSize, setPageSize] = useState(20);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(searchText);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchText]);

  const tabCountParams = useMemo(() => ({
    search: debouncedSearch || undefined,
    assignedToId: staffFilter || undefined,
  }), [debouncedSearch, staffFilter]);

  const { data: tabCounts } = useGetTabCountsQuery(tabCountParams);
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();

  const leadQueryParams = useMemo(() => ({
  page, limit: pageSize,   // <-- was PAGE_SIZE
  search: debouncedSearch || undefined,
  assignedToId: staffFilter || undefined,
}), [page, pageSize, debouncedSearch, staffFilter]);

  const isFresh = activeTab === "FRESH";

  const { data: freshData, isLoading: freshLoading, isFetching: freshFetching } =
    useGetFreshLeadsQuery(leadQueryParams, { skip: !isFresh });

  const { data: statusData, isLoading: statusLoading, isFetching: statusFetching } =
    useGetLeadsByStatusQuery({ status: activeTab, ...leadQueryParams }, { skip: isFresh });

  const leadsData = isFresh ? freshData : statusData;
  const isLoading = isFresh ? freshLoading : statusLoading;
  const isFetching = isFresh ? freshFetching : statusFetching;

  const leads = leadsData?.data ?? [];
  const _rawMeta =
  (leadsData as any)?.meta ??
  (leadsData as any)?.pagination ??
  null;
 
const meta = _rawMeta
  ? {
      page:       _rawMeta.page       ?? page,
      limit:      _rawMeta.limit      ?? PAGE_SIZE,
      total:      _rawMeta.total      ?? 0,
      totalPages: _rawMeta.totalPages ?? 1,
    }
  : { page, limit: PAGE_SIZE, total: 0, totalPages: 1 };

  const [renderTemplate] = useRenderTemplateMutation();
  const [deleteLead] = useDeleteLeadMutation();

  const handleTabChange = useCallback((tab: LeadStatus) => {
    setActiveTab(tab);
    setPage(1);
    setSelectedLeads(new Set());
    setBulkMode(false);
  }, []);

  const handleCall = useCallback((phone: string) => { Linking.openURL(`tel:${phone}`); }, []);

  const handleWhatsApp = useCallback(async (lead: Lead) => {
    try {
      const result = await renderTemplate({ leadId: lead.id }).unwrap();
      if (result?.whatsappUrl) { Linking.openURL(result.whatsappUrl); return; }
    } catch {}
    Linking.openURL(`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`);
  }, [renderTemplate]);

  const handleOpenQuery = useCallback((leadId: string) => {
    setQueryLeadId(leadId);
    setShowQueryModal(true);
  }, []);

  const handleToggleSelect = useCallback((leadId: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      next.has(leadId) ? next.delete(leadId) : next.add(leadId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedLeads(selectedLeads.size === leads.length ? new Set() : new Set(leads.map((l) => l.id)));
  }, [leads, selectedLeads.size]);

  const handleDeleteLead = useCallback((leadId: string, name: string) => {
    Alert.alert("Delete Lead", `Are you sure you want to delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await deleteLead(leadId).unwrap();
          Alert.alert("Success", "Lead deleted successfully");
        } catch { Alert.alert("Error", "Failed to delete lead"); }
      }},
    ]);
  }, [deleteLead]);

  const handleLeadPress = useCallback((lead: Lead) => {
  navigation.navigate("LeadDetail", {
    leadId: lead.id,
    // lead.latestQuery here comes from the list API response, which IS
    // filtered by the active tab status — this is the correct "current tab query"
    highlightedQueryId: (lead as any).highlightedQueryId ?? lead.latestQuery?.id,
  });
}, [navigation]);

  // ── FIX 1: Tab shrink bug ─────────────────────────────────
  // The ScrollView's `style` prop with maxHeight causes height
  // recalculation when content changes between FRESH (longer list =
  // different intrinsic height) and other tabs. Fix: use a fixed
  // height container instead of maxHeight on the ScrollView itself.
  const renderTabItem = useCallback((tab: LeadStatus) => {
    const isActive = activeTab === tab;
    const count = tabCounts?.[tab] ?? 0;
    return (
      <TouchableOpacity
        key={tab}
        onPress={() => handleTabChange(tab)}
        style={[
          styles.tab,
          {
            backgroundColor: isActive ? theme.gold : theme.surfaceVariant,
            borderColor: isActive ? theme.gold : theme.border,
          },
        ]}
      >
        <Text
          style={[styles.tabText, { color: isActive ? "#FFFFFF" : theme.textSecondary }]}
          numberOfLines={1}
        >
          {STATUS_LABELS[tab]}
        </Text>
        <View style={[styles.tabBadge, { backgroundColor: isActive ? "rgba(255,255,255,0.3)" : theme.border }]}>
          <Text style={[styles.tabBadgeText, { color: isActive ? "#FFFFFF" : theme.textTertiary }]}>
            {count}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [activeTab, tabCounts, theme, handleTabChange]);

  const getLatestRemark = (lead: Lead): string => {
    const q = lead.latestQuery ?? lead.queries?.[0];
    return q?.remark || "";
  };

  const getFollowUpDate = (lead: Lead): string | null => {
    const q = lead.latestQuery ?? lead.queries?.[0];
    return q?.followUpDate ?? null;
  };

  const renderLeadCard = useCallback(({ item: lead }: { item: Lead }) => {
    const isSelected = selectedLeads.has(lead.id);
    const latestRemark = getLatestRemark(lead);
    const followUpDate = getFollowUpDate(lead);
    const latestStatus = lead.latestQuery?.status ?? activeTab;
    const assignedName = lead.assignedTo
      ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
      : "Unassigned";

    return (
      <TouchableOpacity
        onPress={() => handleLeadPress(lead)}
        onLongPress={() => { if (!bulkMode) { setBulkMode(true); setSelectedLeads(new Set([lead.id])); } }}
        activeOpacity={0.7}
        style={[styles.card, {
          backgroundColor: theme.card,
          borderColor: isSelected ? theme.gold : theme.cardBorder,
          borderWidth: isSelected ? 2 : 1,
        }]}
      >
        <View style={styles.cardHeader}>
          {bulkMode && (
            <TouchableOpacity onPress={() => handleToggleSelect(lead.id)} style={styles.checkbox}>
              <Ionicons
                name={isSelected ? "checkbox" : "square-outline"}
                size={22}
                color={isSelected ? theme.gold : theme.textTertiary}
              />
            </TouchableOpacity>
          )}
          <View style={styles.cardHeaderInfo}>
            <Text style={[styles.leadName, { color: theme.text }]} numberOfLines={1}>{lead.name}</Text>
            {/* <Text style={[styles.leadPhone, { color: theme.textSecondary }]}>{lead.phone}</Text> */}
          </View>
          <TouchableOpacity
            onPress={() => handleDeleteLead(lead.id, lead.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={theme.danger} />
          </TouchableOpacity>
        </View>

        <View style={styles.badgeRow}>
          {lead.source && (
            <View style={[styles.sourceBadge, { backgroundColor: theme.infoLight }]}>
              <Text style={[styles.sourceBadgeText, { color: theme.info }]}>{lead.source}</Text>
            </View>
          )}
          <StatusBadge status={latestStatus} small />
        </View>

        <View style={styles.cardMeta}>
          <Ionicons name="person-outline" size={13} color={theme.textTertiary} />
          <Text style={[styles.metaText, { color: theme.textSecondary }]} numberOfLines={1}>{assignedName}</Text>
        </View>

        <View style={styles.cardMeta}>
  <Ionicons name="call-outline" size={13} color={theme.textTertiary} />
  <Text style={[styles.metaText, { color: theme.textSecondary }]}>
    {lead.totalCalls ?? 0} call{(lead.totalCalls ?? 0) !== 1 ? "s" : ""}
  </Text>
  {lead.lastCalledAt && (
    <>
      <Text style={[styles.metaText, { color: theme.textTertiary }]}>·</Text>
      <Ionicons name="time-outline" size={13} color={theme.textTertiary} />
      <Text style={[styles.metaText, { color: theme.textTertiary }]}>
        Last: {new Date(lead.lastCalledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
      </Text>
    </>
  )}
</View>

        {latestRemark ? (
          <Text style={[styles.remarkText, { color: theme.textTertiary }]} numberOfLines={2}>{latestRemark}</Text>
        ) : null}

        {followUpDate && (
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={13} color={theme.warning} />
            <Text style={[styles.metaText, { color: theme.warning }]}>
              Follow-up: {new Date(followUpDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </Text>
          </View>
        )}

        <View style={[styles.actionRow, { borderTopColor: theme.divider }]}>
          <TouchableOpacity
            onPress={() => handleCall(lead.phone)}
            style={[styles.actionBtn, { backgroundColor: theme.successLight }]}
          >
            <Ionicons name="call" size={16} color={theme.success} />
            <Text style={[styles.actionBtnText, { color: theme.success }]}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleWhatsApp(lead)}
            style={[styles.actionBtn, { backgroundColor: isDark ? "#1A3D2A" : "#DCF8C6" }]}
          >
            <Ionicons name="logo-whatsapp" size={16} color={theme.whatsappGreen} />
            <Text style={[styles.actionBtnText, { color: theme.whatsappGreen }]}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleOpenQuery(lead.id)}
            style={[styles.actionBtn, { backgroundColor: theme.goldLight }]}
          >
            <Ionicons name="chatbox-outline" size={16} color={theme.gold} />
            <Text style={[styles.actionBtnText, { color: theme.gold }]}>Query</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }, [selectedLeads, bulkMode, activeTab, theme, isDark, handleLeadPress, handleCall, handleWhatsApp, handleOpenQuery, handleToggleSelect, handleDeleteLead]);

  const staffFilterLabel = useMemo(() => {
    if (!staffFilter) return "All Staff";
    const emp = scopeEmployees?.find((e) => e.id === staffFilter);
    return emp ? `${emp.firstName} ${emp.lastName}` : "All Staff";
  }, [staffFilter, scopeEmployees]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Lead Bank"
        rightAction={
          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.headerBtn}>
            <TutorialButton videoUrl={TUTORIALS.leads} />
          </TouchableOpacity>
        }
      />

      {/* ── FIX: Wrap ScrollView in a fixed-height container ─────────────
          The bug: `maxHeight` on a ScrollView causes RN to re-measure
          height when the content count changes (e.g. FRESH has more/fewer
          items than other tabs), causing the tab bar to shrink.
          Fix: give the outer View an explicit height so the ScrollView
          always has a stable parent bounds to fill.                       */}
      <View style={{ backgroundColor: theme.card }}>
  {/* Row 1 */}
  <View style={[styles.tabScrollContainer]}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollContent}
    >
      {STATUS_TABS_ROW1.map(renderTabItem)}
    </ScrollView>
  </View>
 
  {/* Row 2 */}
  <View style={[styles.tabScrollContainer, styles.tabScrollContainerRow2]}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabScroll}
      contentContainerStyle={styles.tabScrollContent}
    >
      {STATUS_TABS_ROW2.map(renderTabItem)}
    </ScrollView>
  </View>
 
  {/* Pagination sits immediately below the status strips */}
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
</View>

      {/* Search + Staff Filter */}
      <View style={[styles.filterRow, { backgroundColor: theme.card, borderBottomColor: theme.divider }]}>
  <View style={[styles.searchInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
    <Ionicons name="search" size={16} color={theme.placeholder} />
    <TextInput
      placeholder="Search leads..."
      placeholderTextColor={theme.placeholder}
      value={searchText}
      onChangeText={setSearchText}
      style={[styles.searchTextInput, { color: theme.text }]}
    />
    {searchText.length > 0 && (
      <TouchableOpacity onPress={() => setSearchText("")}>
        <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    )}
  </View>
 
  {/* Employee dropdown — shown for ALL users, exactly like the web page */}
  <TouchableOpacity
    onPress={() => setShowStaffDropdown(true)}
    style={[styles.staffBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
  >
    <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
    <Text style={[styles.staffBtnText, { color: theme.textSecondary }]} numberOfLines={1}>
      {staffFilterLabel}
    </Text>
    <Ionicons name="chevron-down" size={14} color={theme.textTertiary} />
  </TouchableOpacity>
</View>

      {/* Bulk actions bar */}
      {bulkMode && (
        <View style={[styles.bulkBar, { backgroundColor: theme.goldLight, borderBottomColor: theme.divider }]}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.bulkCheck}>
            <Ionicons
              name={selectedLeads.size === leads.length && leads.length > 0 ? "checkbox" : "square-outline"}
              size={20}
              color={theme.gold}
            />
            <Text style={[styles.bulkText, { color: theme.text }]}>{selectedLeads.size} selected</Text>
          </TouchableOpacity>
          <View style={styles.bulkActions}>
            <TouchableOpacity
              onPress={() => {
                if (selectedLeads.size === 0) { Alert.alert("Select Leads", "Please select at least one lead"); return; }
                setShowBulkAssignModal(true);
              }}
              style={[styles.bulkBtn, { backgroundColor: theme.gold }]}
            >
              <Ionicons name="person-add-outline" size={16} color="#FFFFFF" />
              <Text style={styles.bulkBtnText}>Assign</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setBulkMode(false); setSelectedLeads(new Set()); }}
              style={[styles.bulkBtn, { backgroundColor: theme.danger }]}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
              <Text style={styles.bulkBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* List */}
      {isLoading ? (
        <LoadingScreen message="Loading leads..." />
      ) : leads.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title="No leads found"
          subtitle={debouncedSearch ? "Try adjusting your search" : `No ${STATUS_LABELS[activeTab]} leads`}
        />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={renderLeadCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            isFetching && !isLoading
              ? <ActivityIndicator color={theme.gold} style={{ paddingVertical: 16 }} />
              : null
          }
        />
      )}

      <TouchableOpacity
        onPress={() => setShowBulkImportModal(true)}
        style={[styles.fabSmall, { backgroundColor: theme.gold, bottom: 82 }]}
      >
        <Ionicons name="cloud-upload-outline" size={22} color="#FFFFFF" />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => setShowCreateModal(true)}
        style={[styles.fab, { backgroundColor: theme.gold }]}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <StaffFilterModal
        visible={showStaffDropdown}
        onClose={() => setShowStaffDropdown(false)}
        employees={scopeEmployees ?? []}
        selected={staffFilter}
        onSelect={(id) => { setStaffFilter(id); setShowStaffDropdown(false); setPage(1); }}
      />
      <CreateLeadModal visible={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <QueryModal
        visible={showQueryModal}
        leadId={queryLeadId}
        onClose={() => { setShowQueryModal(false); setQueryLeadId(""); }}
      />
      <BulkAssignModal
        visible={showBulkAssignModal}
        onClose={() => setShowBulkAssignModal(false)}
        leadIds={Array.from(selectedLeads)}
        onDone={() => { setShowBulkAssignModal(false); setBulkMode(false); setSelectedLeads(new Set()); }}
      />
      <BulkImportModal visible={showBulkImportModal} onClose={() => setShowBulkImportModal(false)} />
    </View>
  );
};

// ─── Staff Filter Modal ──────────────────────────────────────
interface StaffFilterModalProps {
  visible: boolean; onClose: () => void;
  employees: Array<{ id: string; firstName: string; lastName: string; designation: string }>;
  selected: string; onSelect: (id: string) => void;
}

const StaffFilterModal: React.FC<StaffFilterModalProps> = ({ visible, onClose, employees, selected, onSelect }) => {
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) => e.firstName.toLowerCase().includes(q) || e.lastName.toLowerCase().includes(q));
  }, [employees, search]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: "70%" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Filter by Staff</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
          </View>
          <View style={[styles.searchInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginHorizontal: 16, marginBottom: 8 }]}>
            <Ionicons name="search" size={16} color={theme.placeholder} />
            <TextInput
              placeholder="Search staff..."
              placeholderTextColor={theme.placeholder}
              value={search}
              onChangeText={setSearch}
              style={[styles.searchTextInput, { color: theme.text }]}
            />
          </View>
          <FlatList
            data={[{ id: "", firstName: "All", lastName: "Staff", designation: "" }, ...filtered]}
            keyExtractor={(item) => item.id || "__all__"}
            renderItem={({ item }) => {
              const isActive = item.id === selected;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.id)}
                  style={[styles.dropdownItem, { backgroundColor: isActive ? theme.goldLight : "transparent" }]}
                >
                  <Text style={[styles.dropdownItemText, { color: isActive ? theme.gold : theme.text, fontWeight: isActive ? "700" : "400" }]}>
                    {item.firstName} {item.lastName}
                  </Text>
                  {item.designation ? (
                    <Text style={[styles.dropdownItemSub, { color: theme.textTertiary }]}>
                      {item.designation.replace(/_/g, " ")}
                    </Text>
                  ) : null}
                  {isActive && <Ionicons name="checkmark" size={18} color={theme.gold} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Create Lead Modal ───────────────────────────────────────
interface CreateLeadModalProps { visible: boolean; onClose: () => void; }

const CreateLeadModal: React.FC<CreateLeadModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const [createLead, { isLoading }] = useCreateLeadMutation();
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", source: "" });
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const SOURCE_OPTIONS = ["Website","Facebook","Instagram","Google","Referral","Walk-in","99acres","MagicBricks","Housing.com","JustDial","OLX","Other"];

  const resetForm = () => setForm({ name: "", phone: "", email: "", address: "", source: "" });

  const handleSubmit = async () => {
    if (!form.name.trim()) { Alert.alert("Validation", "Name is required"); return; }
    if (!form.phone.trim()) { Alert.alert("Validation", "Phone is required"); return; }
    try {
      const body: any = { name: form.name.trim(), phone: form.phone.trim() };
      if (form.email) body.email = form.email.trim();
      if (form.address) body.address = form.address.trim();
      if (form.source) body.source = form.source;
      await createLead(body).unwrap();
      Alert.alert("Success", "Lead created successfully");
      resetForm();
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || "Failed to create lead");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create Lead</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <FormInput label="Name *" value={form.name} onChangeText={(v) => setForm((p) => ({ ...p, name: v }))} placeholder="Lead name" />
              <FormInput label="Phone *" value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} placeholder="Phone number" keyboardType="phone-pad" />
              <FormInput label="Email" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} placeholder="Email address" keyboardType="email-address" />
              <FormInput label="Address" value={form.address} onChangeText={(v) => setForm((p) => ({ ...p, address: v }))} placeholder="Address" multiline />
              <PickerField label="Source" value={form.source} placeholder="Select source" onPress={() => setShowSourcePicker(true)} />
              <OptionPickerModal
                visible={showSourcePicker} title="Select Source"
                options={SOURCE_OPTIONS.map((s) => ({ label: s, value: s }))}
                selected={form.source}
                onSelect={(v) => { setForm((p) => ({ ...p, source: v })); setShowSourcePicker(false); }}
                onClose={() => setShowSourcePicker(false)}
              />
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Create</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Query Modal (Web-identical) ─────────────────────────────
// Mirrors the web QueryModal logic exactly:
// - STATUS_OPTIONS (same list, same order)
// - DETAILED_STATUSES gate
// - Lead Type → BHK/Unit options change
// - Budget with unit selector (Thousands/Lakhs/Crore)
// - Blocked transition warning
// - All date fields, visit/meeting done by pickers
// - Deal done fields: closingAmount, unitNo
// - Not Interested: reason field
// - Project picker from DB + custom entry option

interface QueryModalProps { visible: boolean; leadId: string; onClose: () => void; }

// Mirrors web STATUS_OPTIONS order exactly
const QUERY_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "RINGING",        label: "Ringing"                  },
  { value: "SWITCH_OFF",     label: "Switch Off"               },
  { value: "WRONG_NUMBER",   label: "Wrong Number"             },
  { value: "CALL_BACK",      label: "Call Back"                },
  { value: "FOLLOW_UP",      label: "Follow Up / Call Picked"  },
  { value: "VISIT_DONE",     label: "Visit Done"               },
  { value: "MEETING_DONE",   label: "Meeting Done"             },
  { value: "HOT_PROSPECT",   label: "Hot Prospect"             },
  { value: "SUSPECT",        label: "Suspect"                  },
  { value: "NOT_INTERESTED", label: "Not Interested"           },
  { value: "DEAL_DONE",      label: "Deal Done"                },
];

const DETAILED_STATUSES: LeadStatus[] = [
  "FOLLOW_UP","VISIT_DONE","MEETING_DONE","DEAL_DONE","HOT_PROSPECT","SUSPECT",
];

const ADVANCED_STATUSES: LeadStatus[] = ["FOLLOW_UP","DEAL_DONE","MEETING_DONE","VISIT_DONE"];
const SIMPLE_STATUSES:   LeadStatus[] = ["RINGING","CALL_BACK","WRONG_NUMBER","SWITCH_OFF"];

const LEAD_TYPE_OPTIONS = [
  { value: "RENT",        label: "Rent Lead"        },
  { value: "RESIDENTIAL", label: "Residential Lead" },
  { value: "COMMERCIAL",  label: "Commercial Lead"  },
];

const RESIDENTIAL_BHK = [
  "2 BHK","2 BHK + Study","3 BHK","3 BHK + Study",
  "3 BHK + Servant","3 BHK + Servant + Store",
  "4 BHK","4 BHK + Study","4 BHK + Servant","4 BHK + Store",
];
const COMMERCIAL_UNITS = [
  "Office Space","Studio App","Society Shop","Retail Shop",
  "Industrial Land","Commercial Land",
];

const FURNISHING_OPTIONS = [
  { value: "RAW_FLAT",       label: "Raw Flat"        },
  { value: "SEMI_FURNISHED", label: "Semi Furnished"  },
  { value: "FULLY_FURNISHED",label: "Fully Furnished" },
];

const BUDGET_UNIT_OPTIONS = [
  { value: "thousands", label: "Thousands" },
  { value: "lakhs",     label: "Lakhs"     },
  { value: "crore",     label: "Crore"     },
];

const LOCATION_OPTIONS = [
  "Noida Extension","Yamuna Expressway","Noida Expressway","Sector 62","Other",
];

const PURPOSE_OPTIONS = [
  { value: "Rental Income", label: "Rental Income" },
  { value: "Appreciation",  label: "Appreciation"  },
  { value: "Self Use",      label: "Self Use"       },
];

function isBlockedTransition(from: LeadStatus | undefined, to: LeadStatus): boolean {
  if (!from) return false;
  return ADVANCED_STATUSES.includes(from) && SIMPLE_STATUSES.includes(to);
}

function getBhkOptions(leadType: string): string[] {
  return leadType === "COMMERCIAL" ? COMMERCIAL_UNITS : RESIDENTIAL_BHK;
}

type QueryFormState = {
  status: LeadStatus;
  remark: string;
  leadType: string;
  bhk: string; size: string; floor: string; location: string; purpose: string;
  furnishingType: string; projectName: string; customProject: string; showCustomProject: boolean;
  budgetMin: string; budgetMax: string; budgetUnit: string;
  followUpDate: string; expVisitDate: string; visitDate: string;
  shiftingDate: string; meetingDate: string; dealDoneDate: string;
  visitDoneById: string; meetingDoneById: string;
  closingAmount: string; unitNo: string; reason: string;
};

const emptyQueryForm = (): QueryFormState => ({
  status: "FOLLOW_UP", remark: "",
  leadType: "RESIDENTIAL", bhk: "", size: "", floor: "",
  location: "", purpose: "", furnishingType: "", projectName: "",
  customProject: "", showCustomProject: false,
  budgetMin: "", budgetMax: "", budgetUnit: "lakhs",
  followUpDate: "", expVisitDate: "", visitDate: "",
  shiftingDate: "", meetingDate: "", dealDoneDate: "",
  visitDoneById: "", meetingDoneById: "",
  closingAmount: "", unitNo: "", reason: "",
});

export const QueryModal: React.FC<QueryModalProps> = ({ visible, leadId, onClose }) => {
  const { theme } = useTheme();
  const [addQuery, { isLoading }] = useAddQueryMutation();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const { data: dbProjects } = useGetProjectsDropdownQuery();

  const [form, setForm] = useState<QueryFormState>(emptyQueryForm());

  // Date picker states
  const [showFollowUpPicker,  setShowFollowUpPicker]  = useState(false);
  const [showExpVisitPicker,  setShowExpVisitPicker]  = useState(false);
  const [showVisitDatePicker, setShowVisitDatePicker] = useState(false);
  const [showMeetingPicker,   setShowMeetingPicker]   = useState(false);
  const [showDealDatePicker,  setShowDealDatePicker]  = useState(false);
  const [showShiftingPicker,  setShowShiftingPicker]  = useState(false);

  // Picker modal states
  const [showStatusPicker,    setShowStatusPicker]    = useState(false);
  const [showLeadTypePicker,  setShowLeadTypePicker]  = useState(false);
  const [showBhkPicker,       setShowBhkPicker]       = useState(false);
  const [showFurnishingPicker,setShowFurnishingPicker]= useState(false);
  const [showProjectPicker,   setShowProjectPicker]   = useState(false);
  const [showLocationPicker,  setShowLocationPicker]  = useState(false);
  const [showPurposePicker,   setShowPurposePicker]   = useState(false);
  const [showBudgetUnitPicker,setShowBudgetUnitPicker]= useState(false);
  const [showVisitByPicker,   setShowVisitByPicker]   = useState(false);
  const [showMeetingByPicker, setShowMeetingByPicker] = useState(false);

  const set = <K extends keyof QueryFormState>(key: K, val: QueryFormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  // Reset form when modal opens
  useEffect(() => {
    if (visible) setForm(emptyQueryForm());
  }, [visible]);

  // Clear detailed fields when switching to non-detailed status (mirrors web)
  useEffect(() => {
    if (!DETAILED_STATUSES.includes(form.status)) {
      setForm((f) => ({
        ...f,
        leadType: "RESIDENTIAL", bhk: "", size: "", floor: "",
        location: "", purpose: "", furnishingType: "", projectName: "",
        customProject: "", showCustomProject: false,
        budgetMin: "", budgetMax: "", budgetUnit: "lakhs",
        expVisitDate: "", visitDate: "", shiftingDate: "", meetingDate: "",
        closingAmount: "", unitNo: "", reason: "",
      }));
    }
  }, [form.status]);

  const showDetailed    = DETAILED_STATUSES.includes(form.status);
  const isCommercial    = form.leadType === "COMMERCIAL";
  const isRent          = form.leadType === "RENT";
  const showDealFields  = form.status === "DEAL_DONE";
  const showReasonField = form.status === "NOT_INTERESTED";
  const isBlocked       = isBlockedTransition(undefined, form.status); // new query — no prior status

  // Build project options matching web (DB projects + custom)
  const projectOptions = useMemo(() => {
    const db = (dbProjects ?? []).map((p: any) => ({
      label: p.product ? `${p.name} (${p.product})` : p.name,
      value: p.name,
    }));
    return [...db, { label: "+ Add Custom Name", value: "__CUSTOM__" }];
  }, [dbProjects]);

  const empOptions = useMemo(() =>
    (scopeEmployees ?? []).map((e: any) => ({
      label: `${e.firstName} ${e.lastName ?? ""}`.trim(),
      value: e.id,
    })), [scopeEmployees]);

  const handleSubmit = async () => {
    try {
      const n = (s: string) => (s ? parseFloat(s) : undefined);
      const d = (s: string) => s || undefined;

      const body: CreateQueryBody = {
        status: form.status,
        projectName: ""
      };
      if (form.remark) body.remark = form.remark;

      if (showDetailed) {
        if (form.leadType) body.leadType = form.leadType;
        if (form.bhk) body.bhk = form.bhk;
        if (form.size) body.size = n(form.size);
        if (form.floor) body.floor = form.floor;
        if (isCommercial && form.location) body.location = form.location;
        if (isCommercial && form.purpose) body.purpose = form.purpose;
        if (form.furnishingType) body.furnishingType = form.furnishingType;
        if (form.budgetMin) body.budgetMin = n(form.budgetMin);
        if (form.budgetMax) body.budgetMax = n(form.budgetMax);
        if (form.budgetUnit) body.budgetUnit = form.budgetUnit;
        if (form.followUpDate) body.followUpDate = d(form.followUpDate);
        if (form.expVisitDate) body.expVisitDate = d(form.expVisitDate);
        if (form.status === "VISIT_DONE" && form.visitDate) body.visitDate = d(form.visitDate);
        if (form.status === "VISIT_DONE" && form.visitDoneById) body.visitDoneById = form.visitDoneById;
        if (form.status === "MEETING_DONE" && form.meetingDate) body.meetingDate = d(form.meetingDate);
        if (form.status === "MEETING_DONE" && form.meetingDoneById) body.meetingDoneById = form.meetingDoneById;
        if (isRent && form.shiftingDate) body.shiftingDate = d(form.shiftingDate);
        if (showDealFields && form.closingAmount) body.closingAmount = n(form.closingAmount);
        if (showDealFields && form.unitNo) body.unitNo = form.unitNo;
        if (showDealFields && form.dealDoneDate) body.dealDoneDate = d(form.dealDoneDate);
        if (showReasonField && form.reason) body.reason = form.reason;
        // Project: use customProject if custom mode, else projectName
        const finalProject = form.showCustomProject ? form.customProject : form.projectName;
        if (finalProject) body.projectName = finalProject;
      } else {
        // Simple statuses
        if (form.status === "CALL_BACK" && form.followUpDate) body.followUpDate = d(form.followUpDate);
        if (showReasonField && form.reason) body.reason = form.reason;
      }

      await addQuery({ leadId, body }).unwrap();
      Alert.alert("Success", "Query added successfully");
      onClose();
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message || "Failed to add query");
    }
  };

  const statusLabel = QUERY_STATUS_OPTIONS.find((s) => s.value === form.status)?.label || form.status;
  const bhkLabel = getBhkOptions(form.leadType).includes(form.bhk) ? form.bhk : "";
  const projectDisplayValue = form.showCustomProject
    ? form.customProject
    : projectOptions.find((p) => p.value === form.projectName)?.label ?? "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            {/* Header */}
            <View style={[styles.queryModalHeader, { backgroundColor: theme.mauveDark ?? "#1A0F2E" }]}>
              <View>
                <Text style={styles.queryModalTitle}>Add New Query</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.queryModalClose}>
                <Ionicons name="close" size={18} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

              {/* ── Status ── */}
              <SectionLabel label="Status" required theme={theme} />
              <PickerField
                value={statusLabel}
                placeholder="Select status"
                onPress={() => setShowStatusPicker(true)}
              />
              <OptionPickerModal
                visible={showStatusPicker} title="Select Status"
                options={QUERY_STATUS_OPTIONS}
                selected={form.status}
                onSelect={(v) => { set("status", v as LeadStatus); setShowStatusPicker(false); }}
                onClose={() => setShowStatusPicker(false)}
              />

              {/* ── Simple statuses ── */}
              {!showDetailed && (
                <>
                  {form.status === "CALL_BACK" && (
                    <>
                      <SectionLabel label="Callback Date" theme={theme} />
                      <DatePickerRow
                        value={form.followUpDate} placeholder="Select date"
                        onPress={() => setShowFollowUpPicker(true)} theme={theme}
                      />
                      {showFollowUpPicker && (
                        <DateTimePicker
                          value={form.followUpDate ? new Date(form.followUpDate) : new Date()}
                          mode="date" display="default"
                          onChange={(_, d) => { setShowFollowUpPicker(false); if (d) set("followUpDate", d.toISOString().split("T")[0]); }}
                        />
                      )}
                    </>
                  )}
                  {showReasonField && (
                    <FormInput label="Reason" value={form.reason} onChangeText={(v) => set("reason", v)} placeholder="Enter reason..." />
                  )}
                  <FormInput label="Remark" value={form.remark} onChangeText={(v) => set("remark", v)} placeholder="Enter any notes..." multiline />
                </>
              )}

              {/* ── Detailed statuses ── */}
              {showDetailed && (
                <>
                  {/* Lead Interest */}
                  <SectionHeader label="Lead Interest" theme={theme} />

                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <SectionLabel label="Lead Type" theme={theme} />
                      <PickerField
                        value={LEAD_TYPE_OPTIONS.find((o) => o.value === form.leadType)?.label ?? ""}
                        placeholder="Select type"
                        onPress={() => setShowLeadTypePicker(true)}
                      />
                    </View>
                    <View style={{ width: 10 }} />
                    <View style={{ flex: 1 }}>
                      <SectionLabel label={isCommercial ? "Unit Type" : "BHK"} theme={theme} />
                      <PickerField
                        value={bhkLabel}
                        placeholder="Select..."
                        onPress={() => setShowBhkPicker(true)}
                      />
                    </View>
                  </View>

                  <OptionPickerModal
                    visible={showLeadTypePicker} title="Lead Type"
                    options={LEAD_TYPE_OPTIONS}
                    selected={form.leadType}
                    onSelect={(v) => { set("leadType", v); set("bhk", ""); setShowLeadTypePicker(false); }}
                    onClose={() => setShowLeadTypePicker(false)}
                  />
                  <OptionPickerModal
                    visible={showBhkPicker} title={isCommercial ? "Unit Type" : "Select BHK"}
                    options={getBhkOptions(form.leadType).map((b) => ({ label: b, value: b }))}
                    selected={form.bhk}
                    onSelect={(v) => { set("bhk", v); setShowBhkPicker(false); }}
                    onClose={() => setShowBhkPicker(false)}
                  />

                  {/* Project */}
                  <SectionLabel label="Project" theme={theme} />
                  <PickerField
                    value={projectDisplayValue}
                    placeholder="Select project..."
                    onPress={() => {
                      if (form.showCustomProject) {
                        set("showCustomProject", false);
                        set("customProject", "");
                        set("projectName", "");
                      } else {
                        setShowProjectPicker(true);
                      }
                    }}
                  />
                  {form.showCustomProject && (
                    <View style={{ marginBottom: 12 }}>
                      <FormInput
                        value={form.customProject}
                        onChangeText={(v) => { set("customProject", v); set("projectName", v); }}
                        placeholder="Enter project name..."
                      />
                    </View>
                  )}
                  <OptionPickerModal
                    visible={showProjectPicker} title="Select Project"
                    options={projectOptions}
                    selected={form.projectName}
                    onSelect={(v) => {
                      if (v === "__CUSTOM__") {
                        set("showCustomProject", true);
                        set("projectName", "");
                        setShowProjectPicker(false);
                      } else {
                        set("projectName", v);
                        set("showCustomProject", false);
                        setShowProjectPicker(false);
                      }
                    }}
                    onClose={() => setShowProjectPicker(false)}
                  />

                  {/* Furnishing / Floor / Size / Location / Purpose */}
                  <View style={styles.twoCol}>
                    {!isCommercial && (
                      <View style={{ flex: 1 }}>
                        <SectionLabel label="Furnishing" theme={theme} />
                        <PickerField
                          value={FURNISHING_OPTIONS.find((o) => o.value === form.furnishingType)?.label ?? ""}
                          placeholder="Select..."
                          onPress={() => setShowFurnishingPicker(true)}
                        />
                      </View>
                    )}
                    {!isCommercial && <View style={{ width: 10 }} />}
                    {!isCommercial && (
                      <View style={{ flex: 1 }}>
                        <FormInput label="Floor" value={form.floor} onChangeText={(v) => set("floor", v)} placeholder="e.g. 5th floor" />
                      </View>
                    )}
                    {form.leadType === "RESIDENTIAL" && (
                      <>
                        <View style={{ width: 10 }} />
                        <View style={{ flex: 1 }}>
                          <FormInput label="Size (sqft)" value={form.size} onChangeText={(v) => set("size", v)} placeholder="e.g. 1200" keyboardType="numeric" />
                        </View>
                      </>
                    )}
                  </View>

                  <OptionPickerModal
                    visible={showFurnishingPicker} title="Furnishing Type"
                    options={FURNISHING_OPTIONS}
                    selected={form.furnishingType}
                    onSelect={(v) => { set("furnishingType", v); setShowFurnishingPicker(false); }}
                    onClose={() => setShowFurnishingPicker(false)}
                  />

                  {isCommercial && (
                    <View style={styles.twoCol}>
                      <View style={{ flex: 1 }}>
                        <SectionLabel label="Location" theme={theme} />
                        <PickerField
                          value={form.location}
                          placeholder="Select..."
                          onPress={() => setShowLocationPicker(true)}
                        />
                      </View>
                      <View style={{ width: 10 }} />
                      <View style={{ flex: 1 }}>
                        <SectionLabel label="Purpose" theme={theme} />
                        <PickerField
                          value={PURPOSE_OPTIONS.find((o) => o.value === form.purpose)?.label ?? ""}
                          placeholder="Select..."
                          onPress={() => setShowPurposePicker(true)}
                        />
                      </View>
                    </View>
                  )}
                  <OptionPickerModal
                    visible={showLocationPicker} title="Location"
                    options={LOCATION_OPTIONS.map((l) => ({ label: l, value: l }))}
                    selected={form.location}
                    onSelect={(v) => { set("location", v); setShowLocationPicker(false); }}
                    onClose={() => setShowLocationPicker(false)}
                  />
                  <OptionPickerModal
                    visible={showPurposePicker} title="Purpose"
                    options={PURPOSE_OPTIONS}
                    selected={form.purpose}
                    onSelect={(v) => { set("purpose", v); setShowPurposePicker(false); }}
                    onClose={() => setShowPurposePicker(false)}
                  />

                  {/* Budget */}
                  <SectionHeader label="Budget" theme={theme} />
                  <View style={styles.budgetRow}>
                    <View style={{ flex: 1 }}>
                      <FormInput value={form.budgetMin} onChangeText={(v) => set("budgetMin", v)} placeholder="Min" keyboardType="numeric" />
                    </View>
                    <Text style={[styles.budgetDash, { color: theme.textTertiary }]}>–</Text>
                    <View style={{ flex: 1 }}>
                      <FormInput value={form.budgetMax} onChangeText={(v) => set("budgetMax", v)} placeholder="Max" keyboardType="numeric" />
                    </View>
                    <TouchableOpacity
                      onPress={() => setShowBudgetUnitPicker(true)}
                      style={[styles.unitToggle, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}
                    >
                      <Text style={[styles.unitToggleText, { color: theme.gold }]}>
                        {BUDGET_UNIT_OPTIONS.find((o) => o.value === form.budgetUnit)?.label ?? "Lakhs"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <OptionPickerModal
                    visible={showBudgetUnitPicker} title="Budget Unit"
                    options={BUDGET_UNIT_OPTIONS}
                    selected={form.budgetUnit}
                    onSelect={(v) => { set("budgetUnit", v); setShowBudgetUnitPicker(false); }}
                    onClose={() => setShowBudgetUnitPicker(false)}
                  />

                  {/* Dates */}
                  <SectionHeader label="Dates" theme={theme} />
                  <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                      <SectionLabel label="Follow-up Date" theme={theme} />
                      <DatePickerRow value={form.followUpDate} placeholder="Select date" onPress={() => setShowFollowUpPicker(true)} theme={theme} />
                    </View>
                    <View style={{ width: 10 }} />
                    <View style={{ flex: 1 }}>
                      <SectionLabel label="Expected Visit" theme={theme} />
                      <DatePickerRow value={form.expVisitDate} placeholder="Select date" onPress={() => setShowExpVisitPicker(true)} theme={theme} />
                    </View>
                  </View>
                  {showFollowUpPicker && (
                    <DateTimePicker
                      value={form.followUpDate ? new Date(form.followUpDate) : new Date()}
                      mode="date" display="default"
                      onChange={(_, d) => { setShowFollowUpPicker(false); if (d) set("followUpDate", d.toISOString().split("T")[0]); }}
                    />
                  )}
                  {showExpVisitPicker && (
                    <DateTimePicker
                      value={form.expVisitDate ? new Date(form.expVisitDate) : new Date()}
                      mode="date" display="default"
                      onChange={(_, d) => { setShowExpVisitPicker(false); if (d) set("expVisitDate", d.toISOString().split("T")[0]); }}
                    />
                  )}
                  {isRent && (
                    <>
                      <SectionLabel label="Shifting Date" theme={theme} />
                      <DatePickerRow value={form.shiftingDate} placeholder="Select date" onPress={() => setShowShiftingPicker(true)} theme={theme} />
                      {showShiftingPicker && (
                        <DateTimePicker
                          value={form.shiftingDate ? new Date(form.shiftingDate) : new Date()}
                          mode="date" display="default"
                          onChange={(_, d) => { setShowShiftingPicker(false); if (d) set("shiftingDate", d.toISOString().split("T")[0]); }}
                        />
                      )}
                    </>
                  )}

                  {/* Visit Done details */}
                  {form.status === "VISIT_DONE" && (
                    <>
                      <SectionHeader label="Visit Details" theme={theme} />
                      <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                          <SectionLabel label="Visit Done Date" theme={theme} />
                          <DatePickerRow value={form.visitDate} placeholder="Select date" onPress={() => setShowVisitDatePicker(true)} theme={theme} />
                        </View>
                        <View style={{ width: 10 }} />
                        <View style={{ flex: 1 }}>
                          <SectionLabel label="Visit Done With" theme={theme} />
                          <PickerField
                            value={empOptions.find((e) => e.value === form.visitDoneById)?.label ?? ""}
                            placeholder="Select staff..."
                            onPress={() => setShowVisitByPicker(true)}
                          />
                        </View>
                      </View>
                      {showVisitDatePicker && (
                        <DateTimePicker
                          value={form.visitDate ? new Date(form.visitDate) : new Date()}
                          mode="date" display="default"
                          onChange={(_, d) => { setShowVisitDatePicker(false); if (d) set("visitDate", d.toISOString().split("T")[0]); }}
                        />
                      )}
                      <OptionPickerModal
                        visible={showVisitByPicker} title="Visit Done With"
                        options={empOptions} selected={form.visitDoneById}
                        onSelect={(v) => { set("visitDoneById", v); setShowVisitByPicker(false); }}
                        onClose={() => setShowVisitByPicker(false)}
                      />
                    </>
                  )}

                  {/* Meeting Done details */}
                  {form.status === "MEETING_DONE" && (
                    <>
                      <SectionHeader label="Meeting Details" theme={theme} />
                      <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                          <SectionLabel label="Meeting Done Date" theme={theme} />
                          <DatePickerRow value={form.meetingDate} placeholder="Select date" onPress={() => setShowMeetingPicker(true)} theme={theme} />
                        </View>
                        <View style={{ width: 10 }} />
                        <View style={{ flex: 1 }}>
                          <SectionLabel label="Meeting Done With" theme={theme} />
                          <PickerField
                            value={empOptions.find((e) => e.value === form.meetingDoneById)?.label ?? ""}
                            placeholder="Select staff..."
                            onPress={() => setShowMeetingByPicker(true)}
                          />
                        </View>
                      </View>
                      {showMeetingPicker && (
                        <DateTimePicker
                          value={form.meetingDate ? new Date(form.meetingDate) : new Date()}
                          mode="date" display="default"
                          onChange={(_, d) => { setShowMeetingPicker(false); if (d) set("meetingDate", d.toISOString().split("T")[0]); }}
                        />
                      )}
                      <OptionPickerModal
                        visible={showMeetingByPicker} title="Meeting Done With"
                        options={empOptions} selected={form.meetingDoneById}
                        onSelect={(v) => { set("meetingDoneById", v); setShowMeetingByPicker(false); }}
                        onClose={() => setShowMeetingByPicker(false)}
                      />
                    </>
                  )}

                  {/* Deal Done fields */}
                  {showDealFields && (
                    <>
                      <SectionHeader label="Deal Details" theme={theme} />
                      <View style={styles.twoCol}>
                        <View style={{ flex: 1 }}>
                          <FormInput label="Closing Amount" value={form.closingAmount} onChangeText={(v) => set("closingAmount", v)} placeholder="Amount" keyboardType="numeric" />
                        </View>
                        <View style={{ width: 10 }} />
                        <View style={{ flex: 1 }}>
                          <FormInput label="Unit No" value={form.unitNo} onChangeText={(v) => set("unitNo", v)} placeholder="e.g. Tower A – 501" />
                        </View>
                      </View>
                      <SectionLabel label="Deal Done Date" theme={theme} />
                      <DatePickerRow value={form.dealDoneDate} placeholder="Select date" onPress={() => setShowDealDatePicker(true)} theme={theme} />
                      {showDealDatePicker && (
                        <DateTimePicker
                          value={form.dealDoneDate ? new Date(form.dealDoneDate) : new Date()}
                          mode="date" display="default"
                          onChange={(_, d) => { setShowDealDatePicker(false); if (d) set("dealDoneDate", d.toISOString().split("T")[0]); }}
                        />
                      )}
                    </>
                  )}

                  {/* Not Interested reason */}
                  {showReasonField && (
                    <FormInput label="Reason" value={form.reason} onChangeText={(v) => set("reason", v)} placeholder="Enter reason..." />
                  )}

                  {/* Remark / Notes */}
                  <SectionHeader label="Remarks" theme={theme} />
                  <FormInput label="Remark / Notes" value={form.remark} onChangeText={(v) => set("remark", v)} placeholder="Enter any notes..." multiline />
                </>
              )}

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}
              >
                {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Save Query</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Small helper components ─────────────────────────────────

const SectionHeader: React.FC<{ label: string; theme: any }> = ({ label, theme }) => (
  <View style={[styles.sectionHeaderRow, { borderBottomColor: theme.border }]}>
    <Text style={[styles.sectionHeaderText, { color: theme.textSecondary }]}>{label}</Text>
  </View>
);

const SectionLabel: React.FC<{ label: string; required?: boolean; theme: any }> = ({ label, required, theme }) => (
  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
    {label}{required ? " *" : ""}
  </Text>
);

const DatePickerRow: React.FC<{ value: string; placeholder: string; onPress: () => void; theme: any }> = ({ value, placeholder, onPress, theme }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginBottom: 12 }]}
  >
    <Text style={{ color: value ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>
      {value || placeholder}
    </Text>
    <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
  </TouchableOpacity>
);

// ─── Bulk Assign Modal ───────────────────────────────────────
interface BulkAssignModalProps {
  visible: boolean; onClose: () => void; leadIds: string[]; onDone: () => void;
}

const BulkAssignModal: React.FC<BulkAssignModalProps> = ({ visible, onClose, leadIds, onDone }) => {
  const { theme } = useTheme();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const [bulkAssign, { isLoading }] = useBulkAssignMutation();
  const [selectedEmployee, setSelectedEmployee] = useState("");

  const handleAssign = async () => {
    if (!selectedEmployee) { Alert.alert("Validation", "Please select a staff member"); return; }
    try {
      await bulkAssign({ leadIds, assignedToId: selectedEmployee }).unwrap();
      Alert.alert("Success", `${leadIds.length} lead(s) assigned successfully`);
      setSelectedEmployee("");
      onDone();
    } catch { Alert.alert("Error", "Failed to assign leads"); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: "60%" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Assign {leadIds.length} Lead(s)</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
          </View>
          <FlatList
            data={scopeEmployees ?? []}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const isActive = item.id === selectedEmployee;
              return (
                <TouchableOpacity
                  onPress={() => setSelectedEmployee(item.id)}
                  style={[styles.dropdownItem, { backgroundColor: isActive ? theme.goldLight : "transparent" }]}
                >
                  <Text style={[styles.dropdownItemText, { color: isActive ? theme.gold : theme.text, fontWeight: isActive ? "700" : "400" }]}>
                    {item.firstName} {item.lastName}
                  </Text>
                  <Text style={[styles.dropdownItemSub, { color: theme.textTertiary }]}>{item.designation.replace(/_/g, " ")}</Text>
                  {isActive && <Ionicons name="checkmark" size={18} color={theme.gold} />}
                </TouchableOpacity>
              );
            }}
          />
          <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
            <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
              <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAssign} disabled={isLoading} style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}>
              {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Assign</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Reusable form components ─────────────────────────────────
interface FormInputProps {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "phone-pad" | "email-address" | "numeric";
  multiline?: boolean;
}

const FormInput: React.FC<FormInputProps> = ({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.formGroup}>
      {label && <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>}
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={theme.placeholder} keyboardType={keyboardType} multiline={multiline}
        style={[styles.textInput, {
          backgroundColor: theme.inputBg, borderColor: theme.inputBorder,
          color: theme.text, minHeight: multiline ? 72 : 42,
          textAlignVertical: multiline ? "top" : "center",
        }]}
      />
    </View>
  );
};

interface PickerFieldProps {
  label?: string; value: string; placeholder: string; onPress: () => void;
}

const PickerField: React.FC<PickerFieldProps> = ({ label, value, placeholder, onPress }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.formGroup}>
      {label && <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>}
      <TouchableOpacity
        onPress={onPress}
        style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
      >
        <Text style={{ color: value ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    </View>
  );
};

interface OptionPickerModalProps {
  visible: boolean; title: string;
  options: Array<{ label: string; value: string }>;
  selected: string; onSelect: (value: string) => void; onClose: () => void;
}

const OptionPickerModal: React.FC<OptionPickerModalProps> = ({ visible, title, options, selected, onSelect, onClose }) => {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
        <View style={[styles.modalContent, { backgroundColor: theme.card, maxHeight: "60%" }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isActive = item.value === selected;
              return (
                <TouchableOpacity
                  onPress={() => onSelect(item.value)}
                  style={[styles.dropdownItem, { backgroundColor: isActive ? theme.goldLight : "transparent" }]}
                >
                  <Text style={{ color: isActive ? theme.gold : theme.text, fontWeight: isActive ? "700" : "400", fontSize: 15, flex: 1 }}>
                    {item.label}
                  </Text>
                  {isActive && <Ionicons name="checkmark" size={18} color={theme.gold} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

// ─── Bulk Import Modal ────────────────────────────────────────
interface BulkImportModalProps { visible: boolean; onClose: () => void; }

const BulkImportModal: React.FC<BulkImportModalProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const [importLeads, { isLoading: isImporting }] = useImportLeadsMutation();
  const [triggerDownload, { isFetching: isDownloading }] = useLazyDownloadTemplateQuery();
  const { data: importHistory, isLoading: historyLoading } = useGetImportHistoryQuery();

  const [activeTab, setActiveTab] = useState<"upload" | "history">("upload");
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string } | null>(null);
  const [assignedToId, setAssignedToId] = useState("");
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"],
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setSelectedFile({ uri: asset.uri, name: asset.name });
        setImportResult(null);
      }
    } catch { Alert.alert("Error", "Failed to pick file"); }
  };

  const handleImport = async () => {
    if (!selectedFile) { Alert.alert("Validation", "Please select a file first"); return; }
    try {
      const result = await importLeads({ fileUri: selectedFile.uri, fileName: selectedFile.name, assignedToId: assignedToId || undefined }).unwrap();
      setImportResult(result);
    } catch (err: any) { Alert.alert("Error", err?.data?.message || "Import failed"); }
  };

  const handleClose = () => {
    setSelectedFile(null); setAssignedToId(""); setImportResult(null); setActiveTab("upload"); onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Bulk Import</Text>
              <TouchableOpacity onPress={handleClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <View style={[styles.importTabRow, { borderBottomColor: theme.divider }]}>
              {(["upload","history"] as const).map((t) => (
                <TouchableOpacity
                  key={t} onPress={() => setActiveTab(t)}
                  style={[styles.importTab, activeTab === t && { borderBottomColor: theme.gold, borderBottomWidth: 2 }]}
                >
                  <Text style={[styles.importTabText, { color: activeTab === t ? theme.gold : theme.textSecondary }]}>
                    {t === "upload" ? "Upload" : "History"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {activeTab === "upload" ? (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <TouchableOpacity onPress={() => triggerDownload()} disabled={isDownloading}
                  style={[styles.importActionBtn, { backgroundColor: theme.infoLight, borderColor: theme.info }]}>
                  {isDownloading ? <ActivityIndicator color={theme.info} size="small" /> : <Ionicons name="download-outline" size={18} color={theme.info} />}
                  <Text style={[styles.importActionBtnText, { color: theme.info }]}>Download Template</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePickFile}
                  style={[styles.importActionBtn, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
                  <Ionicons name="document-outline" size={18} color={theme.gold} />
                  <Text style={[styles.importActionBtnText, { color: theme.gold }]}>Select File</Text>
                </TouchableOpacity>
                {selectedFile && (
                  <View style={[styles.selectedFileBox, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <Ionicons name="document-attach-outline" size={16} color={theme.textSecondary} />
                    <Text style={[styles.selectedFileName, { color: theme.text }]} numberOfLines={1}>{selectedFile.name}</Text>
                    <TouchableOpacity onPress={() => { setSelectedFile(null); setImportResult(null); }}>
                      <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                )}
                <PickerField
                  label="Auto-assign to (optional)"
                  value={scopeEmployees?.find((e: any) => e.id === assignedToId) ? `${scopeEmployees.find((e: any) => e.id === assignedToId)!.firstName} ${scopeEmployees.find((e: any) => e.id === assignedToId)!.lastName}` : ""}
                  placeholder="Select staff"
                  onPress={() => setShowAssignPicker(true)}
                />
                <OptionPickerModal
                  visible={showAssignPicker} title="Auto-assign To"
                  options={[{ label: "None", value: "" }, ...(scopeEmployees ?? []).map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))]}
                  selected={assignedToId}
                  onSelect={(v) => { setAssignedToId(v); setShowAssignPicker(false); }}
                  onClose={() => setShowAssignPicker(false)}
                />
                {importResult && (
                  <View style={[styles.importResultBox, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <Text style={[styles.importResultTitle, { color: theme.text }]}>Import Result</Text>
                    {[["Total:", importResult.total, theme.text],["Created:", importResult.created, theme.success],["Skipped:", importResult.skipped, theme.warning],["Failed:", importResult.failed, theme.danger]].map(([l, v, c]) => (
                      <View key={String(l)} style={styles.importResultRow}>
                        <Text style={[styles.importResultLabel, { color: theme.textSecondary }]}>{l}</Text>
                        <Text style={[styles.importResultValue, { color: c as string }]}>{String(v)}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ height: 24 }} />
              </ScrollView>
            ) : (
              historyLoading ? <ActivityIndicator color={theme.gold} style={{ paddingVertical: 32 }} /> : (
                <FlatList
                  data={importHistory ?? []}
                  keyExtractor={(item: any) => item.id}
                  contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}
                  ListEmptyComponent={<Text style={{ color: theme.textTertiary, textAlign: "center", paddingVertical: 32, fontSize: 14 }}>No import history found</Text>}
                  renderItem={({ item }: any) => (
                    <View style={[styles.historyItem, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.historyFileName, { color: theme.text }]} numberOfLines={1}>{item.fileName}</Text>
                        <Text style={[styles.historyDate, { color: theme.textTertiary }]}>
                          {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </Text>
                      </View>
                      <View style={styles.historyCounts}>
                        <Text style={[styles.historyCount, { color: theme.success }]}>{item.successRows} ok</Text>
                        <Text style={[styles.historyCount, { color: theme.danger }]}>{item.failedRows} fail</Text>
                      </View>
                    </View>
                  )}
                />
              )
            )}
            {activeTab === "upload" && (
              <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
                <TouchableOpacity onPress={handleClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                  <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleImport} disabled={isImporting || !selectedFile}
                  style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isImporting || !selectedFile ? 0.6 : 1 }]}>
                  {isImporting ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Import</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Styles ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBtn: { padding: 4 },

  // ── FIX: explicit height container for tabs ──────────────
  // This prevents the ScrollView from collapsing when switching
  // between FRESH (which triggers a re-layout) and other tabs.
  tabScrollContainer: {
    height: 52,             // exact height: paddingVertical 8 top+8 bottom + pill ~36
    overflow: "hidden",
  },
  tabScroll: { flex: 1 },
  tabScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: "center",  // keeps pills vertically centred
  },
  tab: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, gap: 6,
    // Explicit height keeps pill stable regardless of content
    height: 36,
  },
  tabText: { fontSize: 13, fontWeight: "600" },
  tabBadge: { minWidth: 20, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center", paddingHorizontal: 5 },
  tabBadgeText: { fontSize: 10, fontWeight: "700" },

  filterRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  searchInput: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 38, gap: 6 },
  searchTextInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  staffBtn: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, height: 38, gap: 4, maxWidth: 150 },
  staffBtnText: { fontSize: 12, flex: 1 },

  bulkBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  bulkCheck: { flexDirection: "row", alignItems: "center", gap: 6 },
  bulkText: { fontSize: 13, fontWeight: "600" },
  bulkActions: { flexDirection: "row", gap: 8 },
  bulkBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, gap: 4 },
  bulkBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },

  listContent: { paddingHorizontal: 12, paddingVertical: 8, paddingBottom: 80 },

  card: { borderRadius: 12, padding: 14, marginBottom: 10 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: { paddingTop: 2 },
  cardHeaderInfo: { flex: 1 },
  leadName: { fontSize: 16, fontWeight: "700" },
  leadPhone: { fontSize: 13, marginTop: 1 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  sourceBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  sourceBadgeText: { fontSize: 11, fontWeight: "600" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  metaText: { fontSize: 12, flex: 1 },
  remarkText: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  actionRow: { flexDirection: "row", marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 8 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 7, borderRadius: 8, gap: 4 },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  fab: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  fabSmall: { position: "absolute", right: 20, width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { paddingHorizontal: 16 },
  modalFooter: { flexDirection: "row", padding: 16, gap: 12, borderTopWidth: 1 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
  tabScrollContainerRow2: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",   // subtle divider between the two rows
  },

  // Query modal header (dark, matches web)
  queryModalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
  },
  queryModalTitle: { fontSize: 17, fontWeight: "800", color: "#FFFFFF", fontFamily: undefined },
  queryModalClose: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, width: 32, height: 32, justifyContent: "center", alignItems: "center" },

  // Section header (mirrors web SectionHeader style)
  sectionHeaderRow: { borderBottomWidth: 1, marginTop: 20, marginBottom: 12, paddingBottom: 6 },
  sectionHeaderText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8 },

  // Two-column layout
  twoCol: { flexDirection: "row", alignItems: "flex-start" },

  formGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 11, fontWeight: "700", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  pickerBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 42, flexDirection: "row", alignItems: "center" },

  dropdownItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, gap: 8 },
  dropdownItemText: { fontSize: 15, flex: 1 },
  dropdownItemSub: { fontSize: 12 },

  budgetRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  budgetDash: { fontSize: 16, fontWeight: "600" },
  unitToggle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  unitToggleText: { fontSize: 13, fontWeight: "700" },

  sectionDivider: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  importTabRow: { flexDirection: "row", borderBottomWidth: 1 },
  importTab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  importTabText: { fontSize: 14, fontWeight: "600" },
  importActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12, gap: 8 },
  importActionBtnText: { fontSize: 14, fontWeight: "600" },
  selectedFileBox: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: 8, borderWidth: 1, marginBottom: 12, gap: 8 },
  selectedFileName: { flex: 1, fontSize: 13 },
  importResultBox: { padding: 14, borderRadius: 10, borderWidth: 1, marginTop: 4 },
  importResultTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  importResultRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  importResultLabel: { fontSize: 13 },
  importResultValue: { fontSize: 13, fontWeight: "700" },
  historyItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
  historyFileName: { fontSize: 14, fontWeight: "600" },
  historyDate: { fontSize: 12, marginTop: 2 },
  historyCounts: { alignItems: "flex-end", gap: 2 },
  historyCount: { fontSize: 12, fontWeight: "600" },
});