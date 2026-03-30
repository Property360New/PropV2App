import React, { useState, useCallback, useMemo } from "react";
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
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { PaginationBar } from "../components/common/PaginationBar";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetExpensesQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} from "../store/expenses.api";
import type { Expense, ExpenseCategory, ExpenseSubCategory } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

const CATEGORIES: { label: string; value: ExpenseCategory | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Personal", value: "PERSONAL" },
  { label: "Office", value: "OFFICE" },
];

export const SUBCATEGORIES: Record<string, { value: string; label: string; color: string }[]> = {
  PERSONAL: [
    { value: "FAMILY", label: "Family", color: "#007BFF" },
    { value: "GROCERY", label: "Grocery", color: "#007BFF" },
    { value: "VEGETABLES_FRUITS", label: "Vegetables & Fruits", color: "#28A745" },
    { value: "MAINTENANCE", label: "Maintenance", color: "#17A2B8" },
    { value: "RECHARGE", label: "Recharge", color: "#FFC107" },
    { value: "IGL", label: "IGL", color: "#6F42C1" },
    { value: "CLOTHS", label: "Cloths", color: "#DC3545" },
    { value: "MEDICAL", label: "Medical", color: "#28A745" },
    { value: "EMI", label: "EMI", color: "#343A40" },
    { value: "MAID", label: "Maid", color: "#F08080" },
    { value: "VEHICLE", label: "Vehicle", color: "#17A2B8" },
    { value: "GIFTS", label: "Gifts", color: "#007BFF" },
    { value: "TRAVELS", label: "Travels", color: "#FF6F61" },
    { value: "INVESTMENT", label: "Investment", color: "#6610F2" },
    { value: "LIC", label: "LIC", color: "#6C757D" },
    { value: "PERSONAL_OTHER", label: "Other", color: "#343A40" },
  ],
  OFFICE: [
    { value: "SALARY", label: "Salary", color: "#4CAF50" },
    { value: "MARKETING", label: "Marketing", color: "#FF9800" },
    { value: "INCENTIVE", label: "Incentive", color: "#FF5722" },
    { value: "STATIONERY", label: "Stationery", color: "#7b61ff" },
    { value: "MISCELLANEOUS", label: "Miscellaneous", color: "#9E9E9E" },
    { value: "MOBILE_RECHARGE", label: "Mobile Recharge", color: "#FF4081" },
    { value: "WIFI_RECHARGE", label: "WiFi Recharge", color: "#3F51B5" },
    { value: "OFFICE_EXPENSE", label: "Office Expense", color: "#00BCD4" },
    { value: "CONVEYANCE", label: "Conveyance", color: "#8BC34A" },
    { value: "ELECTRICITY", label: "Electricity", color: "#FFC107" },
    { value: "OFFICE_MAINTENANCE", label: "Maintenance", color: "#9C27B0" },
    { value: "OFFICE_OTHER", label: "Other", color: "#607D8B" },
  ],
};

function getSubCategoryInfo(subCategory?: string) {
  if (!subCategory) return null;
  for (const subs of Object.values(SUBCATEGORIES)) {
    const found = subs.find((s) => s.value === subCategory);
    if (found) return found;
  }
  return null;
}

type DateRangeKey = "TODAY" | "THIS_WEEK" | "THIS_MONTH" | "CUSTOM";

const DATE_RANGES: { label: string; value: DateRangeKey }[] = [
  { label: "Today", value: "TODAY" },
  { label: "This Week", value: "THIS_WEEK" },
  { label: "This Month", value: "THIS_MONTH" },
  { label: "Custom", value: "CUSTOM" },
];

const formatCurrency = (amount: number): string => {
  return "\u20B9" + amount.toLocaleString("en-IN");
};

const formatDate = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const getStartOfDay = (d: Date): Date => {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
};

const getDateRange = (key: DateRangeKey): { startDate?: string; endDate?: string } => {
  const now = new Date();
  if (key === "TODAY") {
    const iso = getStartOfDay(now).toISOString();
    return { startDate: iso, endDate: now.toISOString() };
  }
  if (key === "THIS_WEEK") {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { startDate: getStartOfDay(monday).toISOString(), endDate: now.toISOString() };
  }
  if (key === "THIS_MONTH") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: first.toISOString(), endDate: now.toISOString() };
  }
  return {};
};

const EMPTY_FORM = {
  category: "PERSONAL" as ExpenseCategory,
  subCategory: "",
  title: "",
  amount: "",
  description: "",
  expenseDate: new Date(),
};

export const ExpensesScreen: React.FC = () => {
  const { theme, isDark } = useTheme();

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | "ALL">("ALL");
  const [dateRangeKey, setDateRangeKey] = useState<DateRangeKey>("THIS_MONTH");
  const [customStart, setCustomStart] = useState<Date>(new Date());
  const [customEnd, setCustomEnd] = useState<Date>(new Date());
  const [showCustomStartPicker, setShowCustomStartPicker] = useState(false);
  const [showCustomEndPicker, setShowCustomEndPicker] = useState(false);
  const [page, setPage] = useState(1);
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>("ALL");

  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showExpenseDatePicker, setShowExpenseDatePicker] = useState(false);

  // Build query params
  const queryParams = useMemo(() => {
  const params: Record<string, unknown> = { page, limit: 20 };
  if (categoryFilter !== "ALL") params.category = categoryFilter;
  if (subCategoryFilter !== "ALL") params.subCategory = subCategoryFilter;  // ADD
  if (dateRangeKey === "CUSTOM") {
    params.startDate = getStartOfDay(customStart).toISOString();
    params.endDate = customEnd.toISOString();
  } else {
    const range = getDateRange(dateRangeKey);
    if (range.startDate) params.startDate = range.startDate;
    if (range.endDate) params.endDate = range.endDate;
  }
  return params;
}, [page, categoryFilter, subCategoryFilter, dateRangeKey, customStart, customEnd]);

  const { data, isLoading, isFetching, refetch } = useGetExpensesQuery(queryParams as any);
  const [createExpense, { isLoading: isCreating }] = useCreateExpenseMutation();
  const [deleteExpense] = useDeleteExpenseMutation();

  const expenses = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1, totalAmount: 0 };

  const handleCreateExpense = async () => {
    if (!form.title.trim()) {
  Alert.alert("Validation", "Title is required.");
  return;
}
if (!form.subCategory) {
  Alert.alert("Validation", "Please select a sub-category.");
  return;
}
const amt = parseFloat(form.amount);
if (isNaN(amt) || amt <= 0) {
  Alert.alert("Validation", "Please enter a valid amount.");
  return;
}
    try {
      await createExpense({
  category: form.category,
  subCategory: form.subCategory as ExpenseSubCategory,  // cast, guarded by validation below
  title: form.title.trim(),
  amount: amt,
  description: form.description.trim() || undefined,
  expenseDate: form.expenseDate.toISOString(),
}).unwrap();
      setModalVisible(false);
      setForm(EMPTY_FORM);
    } catch {
      Alert.alert("Error", "Failed to create expense. Please try again.");
    }
  };

  const handleDelete = (expense: Expense) => {
    Alert.alert(
      "Delete Expense",
      `Are you sure you want to delete "${expense.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpense(expense.id).unwrap();
            } catch {
              Alert.alert("Error", "Failed to delete expense.");
            }
          },
        },
      ]
    );
  };

  const renderExpenseItem = useCallback(
    ({ item }: { item: Expense }) => (
      <Pressable
        onLongPress={() => handleDelete(item)}
        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: theme.text }]}>{item.title}</Text>
            <Text style={[styles.cardDate, { color: theme.textTertiary }]}>
              {formatDate(item.expenseDate)}
            </Text>
          </View>
          <Text style={[styles.cardAmount, { color: theme.gold }]}>
            {formatCurrency(item.amount)}
          </Text>
        </View>
        <View style={styles.cardBody}>
  <View style={[styles.categoryBadge, {
    backgroundColor: item.category === "PERSONAL" ? theme.infoLight : theme.successLight,
  }]}>
    <Text style={[styles.categoryBadgeText, {
      color: item.category === "PERSONAL" ? theme.info : theme.success,
    }]}>
      {item.category === "PERSONAL" ? "Personal" : "Office"}
    </Text>
  </View>

  {/* ADD: subcategory badge */}
  {item.subCategory && (() => {
    const sub = getSubCategoryInfo(item.subCategory);
    return sub ? (
      <View style={[styles.categoryBadge, { backgroundColor: `${sub.color}18` }]}>
        <Text style={[styles.categoryBadgeText, { color: sub.color }]}>{sub.label}</Text>
      </View>
    ) : null;
  })()}

  {item.description ? (
    <Text style={[styles.cardDescription, { color: theme.textSecondary }]} numberOfLines={2}>
      {item.description}
    </Text>
  ) : null}
</View>
        <TouchableOpacity
          onPress={() => handleDelete(item)}
          style={[styles.deleteBtn, { backgroundColor: theme.dangerLight }]}
          hitSlop={8}
        >
          <Ionicons name="trash-outline" size={16} color={theme.danger} />
        </TouchableOpacity>
      </Pressable>
    ),
    [theme, isDark]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader title="Expenses" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.expenses} />}/>
        <LoadingScreen message="Loading expenses..." />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Expenses" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.expenses} />}/>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
          <Text style={[styles.summaryLabel, { color: theme.gold }]}>Total Amount</Text>
          <Text style={[styles.summaryValue, { color: theme.gold }]}>
            {formatCurrency(meta.totalAmount ?? 0)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Total Entries</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{meta.total}</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Showing</Text>
          <Text style={[styles.summaryValue, { color: theme.text }]}>{expenses.length}</Text>
        </View>
      </View>

      {/* Category Filter */}
      <View style={styles.filterRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            onPress={() => {
              setCategoryFilter(cat.value);
              setSubCategoryFilter("ALL");
              setPage(1);
            }}
            style={[
              styles.filterChip,
              {
                backgroundColor: categoryFilter === cat.value ? theme.gold : theme.surfaceVariant,
                borderColor: categoryFilter === cat.value ? theme.gold : theme.border,
              },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                {
                  color: categoryFilter === cat.value ? theme.textInverse : theme.textSecondary,
                },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subcategory filter — only when a category is selected */}
{categoryFilter !== "ALL" && (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.dateFilterRow}
  >
    <TouchableOpacity
      onPress={() => { setSubCategoryFilter("ALL"); setPage(1); }}
      style={[
        styles.dateChip,
        {
          backgroundColor: subCategoryFilter === "ALL" ? theme.mauve : theme.surfaceVariant,
          borderColor: subCategoryFilter === "ALL" ? theme.mauve : theme.border,
        },
      ]}
    >
      <Text style={[styles.dateChipText, { color: subCategoryFilter === "ALL" ? "#fff" : theme.textSecondary }]}>
        All
      </Text>
    </TouchableOpacity>
    {SUBCATEGORIES[categoryFilter].map((sub) => {
      const active = subCategoryFilter === sub.value;
      return (
        <TouchableOpacity
          key={sub.value}
          onPress={() => { setSubCategoryFilter(sub.value); setPage(1); }}
          style={[
            styles.dateChip,
            {
              backgroundColor: active ? sub.color : theme.surfaceVariant,
              borderColor: active ? sub.color : theme.border,
            },
          ]}
        >
          <Text style={[styles.dateChipText, { color: active ? "#fff" : theme.textSecondary }]}>
            {sub.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
)}

      {/* Date Range Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dateFilterRow}
      >
        {DATE_RANGES.map((dr) => (
          <TouchableOpacity
            key={dr.value}
            onPress={() => {
              setDateRangeKey(dr.value);
              setPage(1);
            }}
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
                {
                  color: dateRangeKey === dr.value ? "#FFFFFF" : theme.textSecondary,
                },
              ]}
            >
              {dr.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Custom Date Pickers */}
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
          <Text style={[{ color: theme.textTertiary, marginHorizontal: 6 }]}>to</Text>
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
            if (d) {
              setCustomStart(d);
              setPage(1);
            }
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
            if (d) {
              setCustomEnd(d);
              setPage(1);
            }
          }}
        />
      )}

      {/* List */}
      {expenses.length === 0 && !isFetching ? (
        <EmptyState
          icon="receipt-outline"
          title="No expenses found"
          subtitle="Tap the + button to add your first expense"
        />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={renderExpenseItem}
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

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.gold }]}
        onPress={() => {
          setForm(EMPTY_FORM);
          setModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Create Expense Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>New Expense</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category Picker */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Category</Text>
              <View style={styles.categoryPickerRow}>
                {(["PERSONAL", "OFFICE"] as ExpenseCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setForm((f) => ({ ...f, category: cat, subCategory: "" }))}
                    style={[
                      styles.categoryPickerBtn,
                      {
                        backgroundColor: form.category === cat ? theme.gold : theme.surfaceVariant,
                        borderColor: form.category === cat ? theme.gold : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: form.category === cat ? theme.textInverse : theme.text,
                        fontWeight: "600",
                        fontSize: 14,
                      }}
                    >
                      {cat === "PERSONAL" ? "Personal" : "Office"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Subcategory picker */}
{form.category && SUBCATEGORIES[form.category] && (
  <>
    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Sub-category *</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {SUBCATEGORIES[form.category].map((sub) => {
          const active = form.subCategory === sub.value;
          return (
            <TouchableOpacity
              key={sub.value}
              onPress={() => setForm((f) => ({ ...f, subCategory: sub.value }))}
              style={[
                styles.dateChip,
                {
                  backgroundColor: active ? sub.color : theme.surfaceVariant,
                  borderColor: active ? sub.color : theme.border,
                },
              ]}
            >
              <Text style={[styles.dateChipText, { color: active ? "#fff" : theme.textSecondary }]}>
                {sub.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  </>
)}

              {/* Title */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Title *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={form.title}
                onChangeText={(t) => setForm((f) => ({ ...f, title: t }))}
                placeholder="Expense title"
                placeholderTextColor={theme.placeholder}
              />

              {/* Amount */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Amount *</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                    color: theme.text,
                  },
                ]}
                value={form.amount}
                onChangeText={(t) => setForm((f) => ({ ...f, amount: t }))}
                placeholder="0.00"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />

              {/* Description */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description</Text>
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
                value={form.description}
                onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
                placeholder="Optional description"
                placeholderTextColor={theme.placeholder}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              {/* Expense Date */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Expense Date</Text>
              <TouchableOpacity
                onPress={() => setShowExpenseDatePicker(true)}
                style={[
                  styles.input,
                  styles.dateInput,
                  {
                    backgroundColor: theme.inputBg,
                    borderColor: theme.inputBorder,
                  },
                ]}
              >
                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                <Text style={[{ color: theme.text, marginLeft: 8, fontSize: 14 }]}>
                  {formatDate(form.expenseDate.toISOString())}
                </Text>
              </TouchableOpacity>

              {showExpenseDatePicker && (
                <DateTimePicker
                  value={form.expenseDate}
                  mode="date"
                  display="default"
                  onChange={(_: DateTimePickerEvent, d?: Date) => {
                    setShowExpenseDatePicker(false);
                    if (d) setForm((f) => ({ ...f, expenseDate: d }));
                  }}
                />
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCreateExpense}
                disabled={isCreating}
                style={[
                  styles.modalBtn,
                  styles.modalBtnPrimary,
                  { backgroundColor: isCreating ? theme.textTertiary : theme.gold },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  {isCreating ? "Creating..." : "Create"}
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
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  dateFilterRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    gap: 8,
  },
  dateChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  dateChipText: {
    fontSize: 11,
    fontWeight: "600",
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
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
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    position: "relative",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardDate: {
    fontSize: 12,
    marginTop: 2,
  },
  cardAmount: {
    fontSize: 17,
    fontWeight: "700",
  },
  cardBody: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 13,
    flex: 1,
  },
  deleteBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
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
    paddingTop: 12,
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
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryPickerRow: {
    flexDirection: "row",
    gap: 10,
  },
  categoryPickerBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
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
  modalBtnPrimary: {},
  modalBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});

export default ExpensesScreen;
