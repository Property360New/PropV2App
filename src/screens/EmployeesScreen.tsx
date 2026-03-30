import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetScopeEmployeesQuery,
  useGetEmployeeDetailQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeactivateEmployeeMutation,
  useReactivateEmployeeMutation,
} from "../store/hierarchy.api";
import type { Designation, ManagedEmployee, ScopeEmployee } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

const DESIGNATIONS: { value: Designation; label: string }[] = [
  { value: "ADMIN", label: "Admin" },
  { value: "VP_SALES", label: "VP Sales" },
  { value: "GM", label: "General Manager" },
  { value: "DGM", label: "Dy. General Manager" },
  { value: "AREA_MANAGER", label: "Area Manager" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "TEAM_LEAD", label: "Team Lead" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive" },
  { value: "SALES_COORDINATOR", label: "Sales Coordinator" },
];

const DESIGNATION_COLORS: Record<Designation, { color: string; bg: string; darkBg: string }> = {
  ADMIN: { color: "#9B59B6", bg: "#F0E4F6", darkBg: "#2E1F3D" },
  VP_SALES: { color: "#E74C3C", bg: "#FADBD8", darkBg: "#3D1F1F" },
  GM: { color: "#C8922A", bg: "#F5E6C8", darkBg: "#3D3020" },
  DGM: { color: "#E67E22", bg: "#FAE5D3", darkBg: "#3D2E1F" },
  AREA_MANAGER: { color: "#16A085", bg: "#D5F5E3", darkBg: "#1F3D30" },
  SALES_MANAGER: { color: "#2980B9", bg: "#D6EAF8", darkBg: "#1A2E3D" },
  TEAM_LEAD: { color: "#8E44AD", bg: "#E8D8F0", darkBg: "#2E1F3D" },
  SALES_EXECUTIVE: { color: "#27AE60", bg: "#D4EFDF", darkBg: "#1F3D2A" },
  SALES_COORDINATOR: { color: "#3498DB", bg: "#D6EAF8", darkBg: "#1F2E3D" },
};

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  designation: Designation;
  reportingManagerId: string;
  birthday: string;
  marriageAnniversary: string;
  dailyCallTarget: string;
  monthlySalesTarget: string;
}

const INITIAL_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  phone: "",
  designation: "SALES_EXECUTIVE",
  reportingManagerId: "",
  birthday: "",
  marriageAnniversary: "",
  dailyCallTarget: "",
  monthlySalesTarget: "",
};

function EmployeeDetailLoader({
  employeeId,
  employees,
  onLoaded,
}: {
  employeeId: string;
  employees: ScopeEmployee[];
  onLoaded: (emp: ManagedEmployee) => void;
}) {
  const { data, isLoading } = useGetEmployeeDetailQuery(employeeId, { skip: !employeeId });
  const { theme } = useTheme();

  React.useEffect(() => {
    if (data) onLoaded(data);
  }, [data]);

  if (isLoading) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <ActivityIndicator size="small" color={theme.gold} />
      </View>
    );
  }
  return null;
}

export default function EmployeesScreen() {
  const { theme, isDark } = useTheme();
  const { data: employees = [], isLoading, refetch } = useGetScopeEmployeesQuery();
  const [createEmployee, { isLoading: isCreating }] = useCreateEmployeeMutation();
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [deactivateEmployee] = useDeactivateEmployeeMutation();
  const [reactivateEmployee] = useReactivateEmployeeMutation();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDetail, setEditDetail] = useState<ManagedEmployee | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [showDesignationPicker, setShowDesignationPicker] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [showAnniversaryPicker, setShowAnniversaryPicker] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, ManagedEmployee>>({});
  const [loadingDetailId, setLoadingDetailId] = useState<string | null>(null);

  const updateField = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setEditDetail(null);
    setForm(INITIAL_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((id: string) => {
    setEditingId(id);
    setLoadingDetailId(id);
    setModalVisible(true);
  }, []);

  const handleDetailLoaded = useCallback(
    (emp: ManagedEmployee) => {
      setDetailCache((prev) => ({ ...prev, [emp.id]: emp }));
      setEditDetail(emp);
      setLoadingDetailId(null);
      setForm({
        firstName: emp.firstName,
        lastName: emp.lastName ?? "",
        email: emp.user?.email ?? "",
        password: "",
        phone: emp.phone ?? "",
        designation: emp.designation,
        reportingManagerId: emp.reportingManagerId ?? "",
        birthday: emp.birthday ?? "",
        marriageAnniversary: emp.marriageAnniversary ?? "",
        dailyCallTarget: emp.dailyCallTarget?.toString() ?? "",
        monthlySalesTarget: emp.monthlySalesTarget?.toString() ?? "",
      });
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (!form.firstName.trim()) {
      Alert.alert("Validation", "First name is required.");
      return;
    }
    if (!form.email.trim()) {
      Alert.alert("Validation", "Email is required.");
      return;
    }
    if (!editingId && !form.password.trim()) {
      Alert.alert("Validation", "Password is required for new employees.");
      return;
    }

    const body: Record<string, unknown> = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim() || undefined,
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      designation: form.designation,
      reportingManagerId: form.reportingManagerId || undefined,
      birthday: form.birthday || undefined,
      marriageAnniversary: form.marriageAnniversary || undefined,
      dailyCallTarget: form.dailyCallTarget ? parseInt(form.dailyCallTarget, 10) : undefined,
      monthlySalesTarget: form.monthlySalesTarget
        ? parseInt(form.monthlySalesTarget, 10)
        : undefined,
    };

    if (form.password.trim()) {
      body.password = form.password.trim();
    }

    try {
      if (editingId) {
        await updateEmployee({ id: editingId, body }).unwrap();
        Alert.alert("Success", "Employee updated successfully.");
      } else {
        body.password = form.password.trim();
        await createEmployee(body as any).unwrap();
        Alert.alert("Success", "Employee created successfully.");
      }
      setModalVisible(false);
      setForm(INITIAL_FORM);
      setEditingId(null);
      setEditDetail(null);
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message ?? "Something went wrong.");
    }
  }, [form, editingId, createEmployee, updateEmployee]);

  const handleToggleActive = useCallback(
    async (id: string, isCurrentlyActive: boolean) => {
      const action = isCurrentlyActive ? "deactivate" : "reactivate";
      Alert.alert(
        `${isCurrentlyActive ? "Deactivate" : "Reactivate"} Employee`,
        `Are you sure you want to ${action} this employee?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Confirm",
            style: isCurrentlyActive ? "destructive" : "default",
            onPress: async () => {
              try {
                if (isCurrentlyActive) {
                  await deactivateEmployee(id).unwrap();
                } else {
                  await reactivateEmployee(id).unwrap();
                }
                setDetailCache((prev) => {
                  const copy = { ...prev };
                  if (copy[id]) {
                    copy[id] = { ...copy[id], isActive: !isCurrentlyActive };
                  }
                  return copy;
                });
              } catch (err: any) {
                Alert.alert("Error", err?.data?.message ?? "Something went wrong.");
              }
            },
          },
        ]
      );
    },
    [deactivateEmployee, reactivateEmployee]
  );

  const handleDateChange = useCallback(
    (field: "birthday" | "marriageAnniversary") =>
      (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (field === "birthday") setShowBirthdayPicker(false);
        else setShowAnniversaryPicker(false);
        if (selectedDate) {
          const iso = selectedDate.toISOString().split("T")[0];
          updateField(field, iso);
        }
      },
    [updateField]
  );

  const getDesignationLabel = useCallback((d: Designation) => {
    return DESIGNATIONS.find((x) => x.value === d)?.label ?? d;
  }, []);

  const renderEmployeeCard = useCallback(
    ({ item }: { item: ScopeEmployee }) => {
      const cached = detailCache[item.id];
      const desColor = DESIGNATION_COLORS[item.designation];
      const isActive = cached?.isActive ?? true;

      return (
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.card,
              borderColor: theme.cardBorder,
            },
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.nameRow}>
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: isActive ? theme.success : theme.danger },
                ]}
              />
              <Text style={[styles.employeeName, { color: theme.text }]}>
                {item.firstName} {item.lastName}
              </Text>
            </View>
            <View
              style={[
                styles.designationBadge,
                { backgroundColor: isDark ? desColor.darkBg : desColor.bg },
              ]}
            >
              <Text style={[styles.designationText, { color: desColor.color }]}>
                {getDesignationLabel(item.designation)}
              </Text>
            </View>
          </View>

          {cached && (
            <View style={styles.cardDetails}>
              {cached.user?.email && (
                <View style={styles.detailRow}>
                  <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {cached.user.email}
                  </Text>
                </View>
              )}
              {cached.phone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    {cached.phone}
                  </Text>
                </View>
              )}
              {cached.reportingManager && (
                <View style={styles.detailRow}>
                  <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.detailText, { color: theme.textSecondary }]}>
                    Reports to: {cached.reportingManager.firstName}{" "}
                    {cached.reportingManager.lastName}
                  </Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <Ionicons
                  name={isActive ? "checkmark-circle" : "close-circle"}
                  size={14}
                  color={isActive ? theme.success : theme.danger}
                />
                <Text
                  style={[
                    styles.detailText,
                    { color: isActive ? theme.success : theme.danger },
                  ]}
                >
                  {isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          )}

          <EmployeeDetailLoader
            employeeId={item.id}
            employees={employees}
            onLoaded={(emp) =>
              setDetailCache((prev) => ({ ...prev, [emp.id]: emp }))
            }
          />

          <View style={[styles.cardActions, { borderTopColor: theme.divider }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
              onPress={() => openEdit(item.id)}
            >
              <Ionicons name="create-outline" size={16} color={theme.gold} />
              <Text style={[styles.actionBtnText, { color: theme.gold }]}>Edit</Text>
            </TouchableOpacity>
            {cached && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  {
                    backgroundColor: cached.isActive
                      ? theme.dangerLight
                      : theme.successLight,
                  },
                ]}
                onPress={() => handleToggleActive(item.id, cached.isActive)}
              >
                <Ionicons
                  name={cached.isActive ? "close-circle-outline" : "checkmark-circle-outline"}
                  size={16}
                  color={cached.isActive ? theme.danger : theme.success}
                />
                <Text
                  style={[
                    styles.actionBtnText,
                    { color: cached.isActive ? theme.danger : theme.success },
                  ]}
                >
                  {cached.isActive ? "Deactivate" : "Reactivate"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    },
    [theme, isDark, detailCache, employees, openEdit, handleToggleActive, getDesignationLabel]
  );

  if (isLoading) return <LoadingScreen message="Loading employees..." />;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScreenHeader
  title="Employees"
  rightAction={
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TutorialButton videoUrl={TUTORIALS.addEmployee} label="" />
      <TouchableOpacity onPress={openCreate} style={styles.headerBtn}>
        <Ionicons name="add-circle" size={26} color={theme.headerText} />
      </TouchableOpacity>
    </View>
  }
/>

      <FlatList
        data={employees}
        keyExtractor={(item) => item.id}
        renderItem={renderEmployeeCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No employees found"
            subtitle="Tap + to create a new employee"
          />
        }
        refreshing={isLoading}
        onRefresh={refetch}
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          setEditingId(null);
          setEditDetail(null);
          setLoadingDetailId(null);
        }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingId ? "Edit Employee" : "Create Employee"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  setEditingId(null);
                  setEditDetail(null);
                  setLoadingDetailId(null);
                }}
              >
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {loadingDetailId ? (
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size="large" color={theme.gold} />
                <EmployeeDetailLoader
                  employeeId={loadingDetailId}
                  employees={employees}
                  onLoaded={handleDetailLoaded}
                />
              </View>
            ) : (
              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  First Name *
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
                  value={form.firstName}
                  onChangeText={(v) => updateField("firstName", v)}
                  placeholder="First name"
                  placeholderTextColor={theme.placeholder}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Last Name</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  value={form.lastName}
                  onChangeText={(v) => updateField("lastName", v)}
                  placeholder="Last name"
                  placeholderTextColor={theme.placeholder}
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Email *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  value={form.email}
                  onChangeText={(v) => updateField("email", v)}
                  placeholder="Email"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Password {editingId ? "(leave blank to keep)" : "*"}
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
                  value={form.password}
                  onChangeText={(v) => updateField("password", v)}
                  placeholder={editingId ? "Leave blank to keep current" : "Password"}
                  placeholderTextColor={theme.placeholder}
                  secureTextEntry
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                      color: theme.text,
                    },
                  ]}
                  value={form.phone}
                  onChangeText={(v) => updateField("phone", v)}
                  placeholder="Phone number"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="phone-pad"
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Designation *
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pickerBtn,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  onPress={() => setShowDesignationPicker(true)}
                >
                  <Text style={{ color: theme.text }}>
                    {getDesignationLabel(form.designation)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <Modal
                  visible={showDesignationPicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowDesignationPicker(false)}
                >
                  <TouchableOpacity
                    style={[styles.pickerOverlay, { backgroundColor: theme.overlay }]}
                    activeOpacity={1}
                    onPress={() => setShowDesignationPicker(false)}
                  >
                    <View
                      style={[styles.pickerModal, { backgroundColor: theme.card }]}
                    >
                      <Text style={[styles.pickerTitle, { color: theme.text }]}>
                        Select Designation
                      </Text>
                      <ScrollView>
                        {DESIGNATIONS.map((d) => (
                          <TouchableOpacity
                            key={d.value}
                            style={[
                              styles.pickerOption,
                              { borderBottomColor: theme.divider },
                              form.designation === d.value && {
                                backgroundColor: theme.goldLight,
                              },
                            ]}
                            onPress={() => {
                              updateField("designation", d.value);
                              setShowDesignationPicker(false);
                            }}
                          >
                            <Text
                              style={[
                                styles.pickerOptionText,
                                { color: theme.text },
                                form.designation === d.value && { color: theme.gold },
                              ]}
                            >
                              {d.label}
                            </Text>
                            {form.designation === d.value && (
                              <Ionicons name="checkmark" size={20} color={theme.gold} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Reporting Manager
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pickerBtn,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  onPress={() => setShowManagerPicker(true)}
                >
                  <Text
                    style={{
                      color: form.reportingManagerId ? theme.text : theme.placeholder,
                    }}
                  >
                    {form.reportingManagerId
                      ? (() => {
                          const mgr = employees.find(
                            (e) => e.id === form.reportingManagerId
                          );
                          return mgr
                            ? `${mgr.firstName} ${mgr.lastName}`
                            : "Select manager";
                        })()
                      : "Select manager"}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <Modal
                  visible={showManagerPicker}
                  transparent
                  animationType="fade"
                  onRequestClose={() => setShowManagerPicker(false)}
                >
                  <TouchableOpacity
                    style={[styles.pickerOverlay, { backgroundColor: theme.overlay }]}
                    activeOpacity={1}
                    onPress={() => setShowManagerPicker(false)}
                  >
                    <View
                      style={[styles.pickerModal, { backgroundColor: theme.card }]}
                    >
                      <Text style={[styles.pickerTitle, { color: theme.text }]}>
                        Select Reporting Manager
                      </Text>
                      <ScrollView>
                        <TouchableOpacity
                          style={[
                            styles.pickerOption,
                            { borderBottomColor: theme.divider },
                            !form.reportingManagerId && {
                              backgroundColor: theme.goldLight,
                            },
                          ]}
                          onPress={() => {
                            updateField("reportingManagerId", "");
                            setShowManagerPicker(false);
                          }}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              { color: theme.textSecondary, fontStyle: "italic" },
                            ]}
                          >
                            None
                          </Text>
                        </TouchableOpacity>
                        {employees
                          .filter((e) => e.id !== editingId)
                          .map((e) => (
                            <TouchableOpacity
                              key={e.id}
                              style={[
                                styles.pickerOption,
                                { borderBottomColor: theme.divider },
                                form.reportingManagerId === e.id && {
                                  backgroundColor: theme.goldLight,
                                },
                              ]}
                              onPress={() => {
                                updateField("reportingManagerId", e.id);
                                setShowManagerPicker(false);
                              }}
                            >
                              <View>
                                <Text
                                  style={[
                                    styles.pickerOptionText,
                                    { color: theme.text },
                                    form.reportingManagerId === e.id && {
                                      color: theme.gold,
                                    },
                                  ]}
                                >
                                  {e.firstName} {e.lastName}
                                </Text>
                                <Text
                                  style={{
                                    fontSize: 11,
                                    color: theme.textTertiary,
                                    marginTop: 2,
                                  }}
                                >
                                  {getDesignationLabel(e.designation)}
                                </Text>
                              </View>
                              {form.reportingManagerId === e.id && (
                                <Ionicons name="checkmark" size={20} color={theme.gold} />
                              )}
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    </View>
                  </TouchableOpacity>
                </Modal>

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Birthday</Text>
                <TouchableOpacity
                  style={[
                    styles.pickerBtn,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  onPress={() => setShowBirthdayPicker(true)}
                >
                  <Text
                    style={{ color: form.birthday ? theme.text : theme.placeholder }}
                  >
                    {form.birthday || "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {showBirthdayPicker && (
                  <DateTimePicker
                    value={form.birthday ? new Date(form.birthday) : new Date()}
                    mode="date"
                    display="default"
                    onChange={handleDateChange("birthday")}
                    maximumDate={new Date()}
                  />
                )}

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Marriage Anniversary
                </Text>
                <TouchableOpacity
                  style={[
                    styles.pickerBtn,
                    {
                      backgroundColor: theme.inputBg,
                      borderColor: theme.inputBorder,
                    },
                  ]}
                  onPress={() => setShowAnniversaryPicker(true)}
                >
                  <Text
                    style={{
                      color: form.marriageAnniversary ? theme.text : theme.placeholder,
                    }}
                  >
                    {form.marriageAnniversary || "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
                {showAnniversaryPicker && (
                  <DateTimePicker
                    value={
                      form.marriageAnniversary
                        ? new Date(form.marriageAnniversary)
                        : new Date()
                    }
                    mode="date"
                    display="default"
                    onChange={handleDateChange("marriageAnniversary")}
                    maximumDate={new Date()}
                  />
                )}

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Daily Call Target
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
                  value={form.dailyCallTarget}
                  onChangeText={(v) => updateField("dailyCallTarget", v.replace(/[^0-9]/g, ""))}
                  placeholder="e.g. 50"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                />

                <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
                  Monthly Sales Target
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
                  value={form.monthlySalesTarget}
                  onChangeText={(v) =>
                    updateField("monthlySalesTarget", v.replace(/[^0-9]/g, ""))
                  }
                  placeholder="e.g. 5"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="number-pad"
                />

                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    { backgroundColor: theme.gold, opacity: isCreating || isUpdating ? 0.6 : 1 },
                  ]}
                  onPress={handleSubmit}
                  disabled={isCreating || isUpdating}
                >
                  {isCreating || isUpdating ? (
                    <ActivityIndicator size="small" color={theme.textInverse} />
                  ) : (
                    <Text style={[styles.submitBtnText, { color: theme.textInverse }]}>
                      {editingId ? "Update Employee" : "Create Employee"}
                    </Text>
                  )}
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    paddingBottom: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 8,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  designationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  designationText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDetails: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 6,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailText: {
    fontSize: 13,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 8,
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
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
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  pickerBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
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
  submitBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
