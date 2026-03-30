import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  RefreshControl,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { PaginationBar } from "../components/common/PaginationBar";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { StatusBadge } from "../components/common/StatusBadge";
import {
  useGetCustomersQuery,
  useGetCustomerDetailQuery,
  useUpdateDealDetailsMutation,
} from "../store/customers.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import type { Customer } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const formatCurrency = (amount: number | null): string => {
  if (amount == null) return "-";
  return "\u20B9" + amount.toLocaleString("en-IN");
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const EMPTY_DEAL_FORM = {
  leadActualSlab: "",
  discount: "",
  actualRevenue: "",
  incentiveSlab: "",
  salesRevenue: "",
  incentiveAmount: "",
  dealValue: "",
  incentiveNote: "",
};

export const CustomersScreen: React.FC = () => {
  const { theme, isDark } = useTheme();

  // Filters
  const [search, setSearch] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [page, setPage] = useState(1);

  // Expanded customer
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Deal edit modal
  const [dealModalVisible, setDealModalVisible] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);
  const [dealForm, setDealForm] = useState(EMPTY_DEAL_FORM);

  const queryParams: Record<string, unknown> = { page, limit: 20 };
  if (search.trim()) queryParams.search = search.trim();
  if (staffFilter) queryParams.assignedToId = staffFilter;

  const { data, isLoading, isFetching, refetch } = useGetCustomersQuery(queryParams as any);
  const { data: staffList } = useGetScopeEmployeesQuery();
  const [updateDealDetails, { isLoading: isUpdatingDeal }] = useUpdateDealDetailsMutation();

  // Fetch detail for expanded customer
  const { data: expandedDetail } = useGetCustomerDetailQuery(expandedId!, {
    skip: !expandedId,
  });

  const customers = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const openDealModal = (customer: Customer, queryId: string) => {
  setSelectedCustomerId(customer.id);
  setSelectedQueryId(queryId);
  // Web stores deal details in customer.deals[], matched by queryId
  const deal: any = (customer as any).deals?.find((d: any) => d.queryId === queryId);
  setDealForm({
    leadActualSlab:  deal?.leadActualSlab?.toString()  ?? "",
    discount:        deal?.discount?.toString()        ?? "",
    actualRevenue:   deal?.actualRevenue?.toString()   ?? "",
    incentiveSlab:   deal?.incentiveSlab?.toString()   ?? "",
    salesRevenue:    deal?.salesRevenue?.toString()    ?? "",
    incentiveAmount: deal?.incentiveAmount?.toString() ?? "",
    dealValue:       deal?.dealValue?.toString()       ?? "",
    incentiveNote:   deal?.incentiveNote               ?? "",
  });
  setDealModalVisible(true);
};

  const handleUpdateDeal = async () => {
    if (!selectedCustomerId || !selectedQueryId) return;

    const body: Record<string, unknown> = {};
    if (dealForm.leadActualSlab) body.leadActualSlab = parseFloat(dealForm.leadActualSlab);
    if (dealForm.discount) body.discount = parseFloat(dealForm.discount);
    if (dealForm.actualRevenue) body.actualRevenue = parseFloat(dealForm.actualRevenue);
    if (dealForm.incentiveSlab) body.incentiveSlab = parseFloat(dealForm.incentiveSlab);
    if (dealForm.salesRevenue) body.salesRevenue = parseFloat(dealForm.salesRevenue);
    if (dealForm.incentiveAmount) body.incentiveAmount = parseFloat(dealForm.incentiveAmount);
    if (dealForm.dealValue) body.dealValue = parseFloat(dealForm.dealValue);
    body.incentiveNote = dealForm.incentiveNote.trim() || null;

    try {
      await updateDealDetails({
        id: selectedCustomerId,
        queryId: selectedQueryId,
        body,
      }).unwrap();
      setDealModalVisible(false);
      setSelectedCustomerId(null);
      setSelectedQueryId(null);
      setDealForm(EMPTY_DEAL_FORM);
    } catch {
      Alert.alert("Error", "Failed to update deal details.");
    }
  };

  const renderDealQuery = (
    customer: Customer,
    query: { id: string; status: string; callStatus: string; remark: string | null; dealDoneDate: string | null; createdAt: string }
  ) => (
    <View
      key={query.id}
      style={[styles.queryCard, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
    >
      <View style={styles.queryHeader}>
        <StatusBadge status={query.status} small />
        <Text style={[styles.queryDate, { color: theme.textTertiary }]}>
          {formatDate(query.createdAt)}
        </Text>
      </View>
      {query.remark && (
        <Text style={[styles.queryRemark, { color: theme.textSecondary }]} numberOfLines={2}>
          {query.remark}
        </Text>
      )}
      {query.dealDoneDate && (
        <View style={styles.queryRow}>
          <Text style={[styles.queryLabel, { color: theme.textTertiary }]}>Deal Done:</Text>
          <Text style={[styles.queryValue, { color: theme.success }]}>
            {formatDate(query.dealDoneDate)}
          </Text>
        </View>
      )}
      {(() => {
  const deal: any = (customer as any).deals?.find((d: any) => d.queryId === query.id);
  const dealValue = deal?.dealValue ?? null;
  return dealValue != null ? (
    <View style={styles.queryRow}>
      <Text style={[styles.queryLabel, { color: theme.textTertiary }]}>Closing:</Text>
      <Text style={[styles.queryValue, { color: theme.gold }]}>
        {formatCurrency(dealValue)}
      </Text>
    </View>
  ) : null;
})()}
      <TouchableOpacity
        onPress={() => openDealModal(customer, query.id)}
        style={[styles.editDealBtn, { backgroundColor: theme.goldLight }]}
      >
        <Ionicons name="create-outline" size={14} color={theme.gold} />
        <Text style={[styles.editDealBtnText, { color: theme.gold }]}>Edit Deal Details</Text>
      </TouchableOpacity>
    </View>
  );

  const renderCustomerItem = useCallback(
    ({ item }: { item: Customer }) => {
      const isExpanded = expandedId === item.id;
      const detail = isExpanded ? expandedDetail : null;
      const customerToShow = isExpanded && detail ? detail : item;

      return (
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <TouchableOpacity
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
            style={styles.cardHeader}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardName, { color: theme.text }]}>{item.name}</Text>
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={13} color={theme.textTertiary} />
                <Text style={[styles.contactText, { color: theme.textSecondary }]}>
                  {item.phone}
                </Text>
              </View>
              {item.email && (
                <View style={styles.contactRow}>
                  <Ionicons name="mail-outline" size={13} color={theme.textTertiary} />
                  <Text style={[styles.contactText, { color: theme.textSecondary }]}>
                    {item.email}
                  </Text>
                </View>
              )}
              {item.source && (
                <View style={styles.contactRow}>
                  <Ionicons name="globe-outline" size={13} color={theme.textTertiary} />
                  <Text style={[styles.contactText, { color: theme.textSecondary }]}>
                    {item.source}
                  </Text>
                </View>
              )}
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.textTertiary}
            />
          </TouchableOpacity>

          {/* Deal Summary Chips */}
          <View style={styles.chipRow}>
            {(() => {
  const deals: any[] = (item as any).deals ?? [];
  const totalDealValue = deals.reduce((s, d) => s + Number(d.dealValue ?? 0), 0);
  const totalIncentive = deals.reduce((s, d) => s + Number(d.incentiveAmount ?? 0), 0);
  return (
    <>
      {totalDealValue > 0 && (
        <View style={[styles.chip, { backgroundColor: theme.goldLight }]}>
          <Text style={[styles.chipText, { color: theme.gold }]}>
            Deal: {formatCurrency(totalDealValue)}
          </Text>
        </View>
      )}
      {totalIncentive > 0 && (
        <View style={[styles.chip, { backgroundColor: theme.successLight }]}>
          <Text style={[styles.chipText, { color: theme.success }]}>
            Incentive: {formatCurrency(totalIncentive)}
          </Text>
        </View>
      )}
    </>
  );
})()}
          </View>

          {/* Expanded Detail */}
          {isExpanded && (
            <View style={[styles.expandedSection, { borderTopColor: theme.divider }]}>
              {/* Assigned To */}
              {customerToShow.assignedTo && (
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={14} color={theme.textTertiary} />
                  <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>
                    Assigned to:
                  </Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {customerToShow.assignedTo.firstName} {customerToShow.assignedTo.lastName ?? ""}
                    {customerToShow.assignedTo.designation
                      ? ` (${customerToShow.assignedTo.designation.replace(/_/g, " ")})`
                      : ""}
                  </Text>
                </View>
              )}

              {/* Lead Source */}
              {customerToShow.lead?.source && (
                <View style={styles.detailRow}>
                  <Ionicons name="analytics-outline" size={14} color={theme.textTertiary} />
                  <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Source:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {customerToShow.lead.source}
                  </Text>
                </View>
              )}

              {/* Project */}
              {customerToShow.lead?.project && (
                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={14} color={theme.textTertiary} />
                  <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Project:</Text>
                  <Text style={[styles.detailValue, { color: theme.text }]}>
                    {customerToShow.lead.project.name}
                  </Text>
                </View>
              )}

              {/* Deal financial details - fall back to first DEAL_DONE query if top-level fields are null */}
              {(() => {
                const deals: any[] = (customerToShow as any).deals ?? [];
const financials = {
  leadActualSlab:  deals.reduce((s, d) => s + Number(d.leadActualSlab  ?? 0), 0) || null,
  discount:        deals.reduce((s, d) => s + Number(d.discount        ?? 0), 0) || null,
  actualRevenue:   deals.reduce((s, d) => s + Number(d.actualRevenue   ?? 0), 0) || null,
  incentiveSlab:   deals[0]?.incentiveSlab ?? null, // slab is per-deal, show first
  salesRevenue:    deals.reduce((s, d) => s + Number(d.salesRevenue    ?? 0), 0) || null,
  incentiveAmount: deals.reduce((s, d) => s + Number(d.incentiveAmount ?? 0), 0) || null,
};
                return (
                  <View style={[styles.financialGrid, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Actual Slab</Text>
                      <Text style={[styles.financialValue, { color: theme.text }]}>
                        {financials.leadActualSlab != null ? formatCurrency(financials.leadActualSlab) : "-"}
                      </Text>
                    </View>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Discount</Text>
                      <Text style={[styles.financialValue, { color: theme.text }]}>
                        {financials.discount != null ? formatCurrency(financials.discount) : "-"}
                      </Text>
                    </View>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Revenue</Text>
                      <Text style={[styles.financialValue, { color: theme.text }]}>
                        {financials.actualRevenue != null ? formatCurrency(financials.actualRevenue) : "-"}
                      </Text>
                    </View>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Sales Rev.</Text>
                      <Text style={[styles.financialValue, { color: theme.text }]}>
                        {financials.salesRevenue != null ? formatCurrency(financials.salesRevenue) : "-"}
                      </Text>
                    </View>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Incentive Slab</Text>
                      <Text style={[styles.financialValue, { color: theme.text }]}>
                        {financials.incentiveSlab != null ? `${financials.incentiveSlab}%` : "-"}
                      </Text>
                    </View>
                    <View style={styles.financialItem}>
                      <Text style={[styles.financialLabel, { color: theme.textTertiary }]}>Incentive Amt</Text>
                      <Text style={[styles.financialValue, { color: theme.success }]}>
                        {financials.incentiveAmount != null ? formatCurrency(financials.incentiveAmount) : "-"}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {((customerToShow as any).deals?.[0]?.incentiveNote) ? (
                <View style={[styles.noteBox, { backgroundColor: theme.warningLight, borderColor: theme.warning }]}>
                  <Ionicons name="document-text-outline" size={14} color={theme.warning} />
                  <Text style={[styles.noteText, { color: theme.text }]}>
                    {customerToShow.incentiveNote}
                  </Text>
                </View>
              ) : null}

              {/* Deal Queries */}
              {customerToShow.lead?.queries && customerToShow.lead.queries.length > 0 && (
                <View style={styles.queriesSection}>
                  <Text style={[styles.queriesTitle, { color: theme.textSecondary }]}>
                    Deal Queries ({customerToShow.lead.queries.length})
                  </Text>
                  {customerToShow.lead.queries.map((q) =>
                    renderDealQuery(customerToShow, q)
                  )}
                </View>
              )}
            </View>
          )}
        </View>
      );
    },
    [expandedId, expandedDetail, theme, isDark]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader title="Customers" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.targetCustomers} />}/>
        <LoadingScreen message="Loading customers..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Customers" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.targetCustomers} />}/>

      {/* Search & Staff Filter */}
      <View style={styles.filterSection}>
        <View style={[styles.searchRow, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
          <Ionicons name="search-outline" size={18} color={theme.placeholder} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              setPage(1);
            }}
            placeholder="Search customers..."
            placeholderTextColor={theme.placeholder}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Staff Filter */}
        {staffList && staffList.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowStaffPicker(true)}
            style={[
              styles.staffFilterBtn,
              {
                backgroundColor: staffFilter ? theme.mauve : theme.surfaceVariant,
                borderColor: staffFilter ? theme.mauve : theme.border,
              },
            ]}
          >
            <Ionicons
              name="people-outline"
              size={16}
              color={staffFilter ? "#FFFFFF" : theme.textSecondary}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: "600",
                color: staffFilter ? "#FFFFFF" : theme.textSecondary,
                marginLeft: 6,
              }}
              numberOfLines={1}
            >
              {staffFilter
                ? (() => {
                    const emp = staffList.find((s) => s.id === staffFilter);
                    return emp ? `${emp.firstName} ${emp.lastName ?? ""}`.trim() : "Staff";
                  })()
                : "Filter by Staff"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={14}
              color={staffFilter ? "#FFFFFF" : theme.textSecondary}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {customers.length === 0 && !isFetching ? (
        <EmptyState
          icon="people-outline"
          title="No customers found"
          subtitle="Customers will appear here once deals are closed"
        />
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(item) => item.id}
          renderItem={renderCustomerItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={refetch}
              tintColor={theme.gold}
              colors={[theme.gold]}
            />
          }
        />
      )}

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <PaginationBar
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
        />
      )}

      {/* Staff Picker Modal */}
      <Modal visible={showStaffPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setShowStaffPicker(false)}
        >
          <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
            <Text
              style={[styles.pickerTitle, { color: theme.text, borderBottomColor: theme.divider }]}
            >
              Filter by Staff
            </Text>
            <ScrollView style={styles.pickerScroll}>
              <TouchableOpacity
                onPress={() => {
                  setStaffFilter("");
                  setShowStaffPicker(false);
                  setPage(1);
                }}
                style={[
                  styles.pickerOption,
                  {
                    borderBottomColor: theme.divider,
                    backgroundColor: staffFilter === "" ? theme.goldLight : "transparent",
                  },
                ]}
              >
                <Text style={[styles.pickerOptionText, { color: theme.textSecondary }]}>
                  All Staff
                </Text>
                {staffFilter === "" && (
                  <Ionicons name="checkmark" size={18} color={theme.gold} />
                )}
              </TouchableOpacity>
              {(staffList ?? []).map((emp) => (
                <TouchableOpacity
                  key={emp.id}
                  onPress={() => {
                    setStaffFilter(emp.id);
                    setShowStaffPicker(false);
                    setPage(1);
                  }}
                  style={[
                    styles.pickerOption,
                    {
                      borderBottomColor: theme.divider,
                      backgroundColor: staffFilter === emp.id ? theme.goldLight : "transparent",
                    },
                  ]}
                >
                  <View>
                    <Text
                      style={[
                        styles.pickerOptionText,
                        { color: staffFilter === emp.id ? theme.gold : theme.text },
                      ]}
                    >
                      {emp.firstName} {emp.lastName ?? ""}
                    </Text>
                    <Text style={[{ fontSize: 11, color: theme.textTertiary, marginTop: 1 }]}>
                      {emp.designation.replace(/_/g, " ")}
                    </Text>
                  </View>
                  {staffFilter === emp.id && (
                    <Ionicons name="checkmark" size={18} color={theme.gold} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Deal Edit Modal */}
      <Modal visible={dealModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Deal Details</Text>
              <TouchableOpacity onPress={() => setDealModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Actual Slab
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.leadActualSlab}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, leadActualSlab: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Discount</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.discount}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, discount: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Actual Revenue
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.actualRevenue}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, actualRevenue: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Incentive Slab
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.incentiveSlab}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, incentiveSlab: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Sales Revenue
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.salesRevenue}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, salesRevenue: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                    Incentive Amt
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: theme.inputBg,
                        borderColor: theme.inputBorder,
                        color: theme.text,
                      },
                    ]}
                    value={dealForm.incentiveAmount}
                    onChangeText={(t) => setDealForm((f) => ({ ...f, incentiveAmount: t }))}
                    placeholder="0"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Deal Value</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={dealForm.dealValue}
                onChangeText={(t) => setDealForm((f) => ({ ...f, dealValue: t }))}
                placeholder="0"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Incentive Note
              </Text>
              <TextInput
                style={[
                  styles.input,
                  styles.textArea,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={dealForm.incentiveNote}
                onChangeText={(t) => setDealForm((f) => ({ ...f, incentiveNote: t }))}
                placeholder="Notes about incentive..."
                placeholderTextColor={theme.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={{ height: 16 }} />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity
                onPress={() => setDealModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleUpdateDeal}
                disabled={isUpdatingDeal}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: isUpdatingDeal ? theme.textTertiary : theme.gold,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  {isUpdatingDeal ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  staffFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  contactText: {
    fontSize: 13,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  expandedSection: {
    borderTopWidth: 1,
    padding: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  financialGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  financialItem: {
    width: "48%",
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  financialValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    flex: 1,
  },
  queriesSection: {
    marginTop: 8,
  },
  queriesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  queryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  queryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  queryDate: {
    fontSize: 11,
  },
  queryRemark: {
    fontSize: 13,
    marginBottom: 4,
  },
  queryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  queryLabel: {
    fontSize: 12,
  },
  queryValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  editDealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  editDealBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Picker Modal
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerContainer: {
    width: "80%",
    maxHeight: "60%",
    borderRadius: 16,
    overflow: "hidden",
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: "700",
    padding: 16,
    borderBottomWidth: 1,
  },
  pickerScroll: {
    maxHeight: 350,
  },
  pickerOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerOptionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // Deal Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  textArea: {
    minHeight: 72,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalFooter: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    borderTopWidth: 1,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default CustomersScreen;
