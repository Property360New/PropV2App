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
  Switch,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { PaginationBar } from "../components/common/PaginationBar";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetInventoryQuery,
  useCreateInventoryMutation,
  useUpdateInventoryMutation,
  useDeleteInventoryMutation,
  useToggleInventoryStatusMutation,
} from "../store/inventory.api";
import { useGetProjectsDropdownQuery } from "../store/projects.api";
import { useGetProfileQuery } from "../store/auth.api";
import type { InventoryItem, InventoryType, InventorySubType, BHKType, FurnishingType } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// ── Constants ────────────────────────────────────────────────────

const INVENTORY_TYPES: { label: string; value: InventoryType | "ALL" }[] = [
  { label: "All", value: "ALL" },
  { label: "Residential", value: "RESIDENTIAL" },
  { label: "Commercial", value: "COMMERCIAL" },
];

// Subtypes grouped by parent type — kept in sync with type selection
const SUB_TYPE_MAP: Record<InventoryType, { value: InventorySubType; label: string }[]> = {
  RESIDENTIAL: [
    { value: "RENT_RESIDENTIAL", label: "Rent Residential" },
    { value: "RESALE_RESIDENTIAL", label: "Resale Residential" },
  ],
  COMMERCIAL: [
    { value: "RENT_COMMERCIAL", label: "Rent Commercial" },
    { value: "RESALE_COMMERCIAL", label: "Resale Commercial" },
  ],
};

const ALL_SUB_TYPES = [...SUB_TYPE_MAP.RESIDENTIAL, ...SUB_TYPE_MAP.COMMERCIAL];

const BHK_OPTIONS: { label: string; value: BHKType }[] = [
  { label: "2 BHK", value: "TWO_BHK" },
  { label: "2 BHK+Study", value: "TWO_BHK_STUDY" },
  { label: "3 BHK", value: "THREE_BHK" },
  { label: "3 BHK+Study", value: "THREE_BHK_STUDY" },
  { label: "3 BHK+Servant", value: "THREE_BHK_SERVANT" },
  { label: "3 BHK+Store", value: "THREE_BHK_STORE" },
  { label: "4 BHK", value: "FOUR_BHK" },
  { label: "4 BHK+Study", value: "FOUR_BHK_STUDY" },
  { label: "4 BHK+Servant", value: "FOUR_BHK_SERVANT" },
  { label: "4 BHK+Store", value: "FOUR_BHK_STORE" },
];

const FURNISHING_OPTIONS: { label: string; value: FurnishingType }[] = [
  { label: "Raw Flat", value: "RAW_FLAT" },
  { label: "Semi Furnished", value: "SEMI_FURNISHED" },
  { label: "Fully Furnished", value: "FULLY_FURNISHED" },
];

const FACING_OPTIONS = [
  "East", "West", "North", "South",
  "North-East", "North-West", "South-East", "South-West",
];

const STATUS_OPTIONS: { label: string; value: "true" | "false" | "" }[] = [
  { label: "All", value: "" },
  { label: "Active", value: "true" },
  { label: "Inactive", value: "false" },
];

// ── Helpers ───────────────────────────────────────────────────────

const formatCurrency = (amount: number | null): string => {
  if (!amount) return "—";
  return "\u20B9" + amount.toLocaleString("en-IN");
};

const formatBHK = (bhk: BHKType | null | undefined): string => {
  if (!bhk) return "—";
  return BHK_OPTIONS.find((b) => b.value === bhk)?.label ?? bhk;
};

const formatSubType = (st: InventorySubType | null | undefined): string => {
  if (!st) return "—";
  return ALL_SUB_TYPES.find((s) => s.value === st)?.label ?? st;
};

const formatFurnishing = (f: string | null | undefined): string => {
  if (!f) return "—";
  return FURNISHING_OPTIONS.find((o) => o.value === f)?.label ?? f;
};

// ── Filter State ─────────────────────────────────────────────────

interface Filters {
  inventoryType: InventoryType | "ALL";
  inventorySubType: InventorySubType | "";
  bhk: BHKType | "";
  projectId: string;
  isActive: "true" | "false" | "";
  minDemand: string;
  maxDemand: string;
}

const DEFAULT_FILTERS: Filters = {
  inventoryType: "ALL",
  inventorySubType: "",
  bhk: "",
  projectId: "",
  isActive: "true",
  minDemand: "",
  maxDemand: "",
};

// ── Form State ───────────────────────────────────────────────────

interface FormState {
  ownerName: string;
  ownerPhone: string;
  ownerEmail: string;
  inventoryType: InventoryType;
  inventorySubType: InventorySubType;
  projectId: string;
  unitNo: string;
  towerNo: string;
  bhk: BHKType | "";
  size: string;
  facing: string;
  floor: string;
  demand: string;
  hasTenant: boolean;
  hasParking: boolean;
  furnishingType: FurnishingType | "";
}

const EMPTY_FORM: FormState = {
  ownerName: "",
  ownerPhone: "",
  ownerEmail: "",
  inventoryType: "RESIDENTIAL",
  inventorySubType: "RENT_RESIDENTIAL",
  projectId: "",
  unitNo: "",
  towerNo: "",
  bhk: "",
  size: "",
  facing: "",
  floor: "",
  demand: "",
  hasTenant: false,
  hasParking: false,
  furnishingType: "",
};

// ── Main Screen ───────────────────────────────────────────────────

export const InventoryScreen: React.FC = () => {
  const { theme, isDark } = useTheme();

  // Filters
  const [pendingFilters, setPendingFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Picker modals for filter panel
  const [filterSubTypePicker, setFilterSubTypePicker] = useState(false);
  const [filterBhkPicker, setFilterBhkPicker] = useState(false);
  const [filterProjectPicker, setFilterProjectPicker] = useState(false);
  const [filterStatusPicker, setFilterStatusPicker] = useState(false);

  // Create/Edit Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Form picker modals
  const [showFormSubTypePicker, setShowFormSubTypePicker] = useState(false);
  const [showFormBhkPicker, setShowFormBhkPicker] = useState(false);
  const [showFormFacingPicker, setShowFormFacingPicker] = useState(false);
  const [showFormProjectPicker, setShowFormProjectPicker] = useState(false);
  const [showFormFurnishingPicker, setShowFormFurnishingPicker] = useState(false);

  // Profile & permissions
  const { data: profile } = useGetProfileQuery();
  const canEdit =
    profile?.designation === "ADMIN" || profile?.permissions?.canEditInventory;

  // Query params
  const queryParams = useMemo(() => {
    const params: Record<string, unknown> = { page, limit: 20 };
    if (appliedFilters.inventoryType !== "ALL") params.inventoryType = appliedFilters.inventoryType;
    if (appliedFilters.inventorySubType) params.inventorySubType = appliedFilters.inventorySubType;
    if (appliedFilters.bhk) params.bhk = appliedFilters.bhk;
    if (appliedFilters.projectId) params.projectId = appliedFilters.projectId;
    if (appliedFilters.isActive) params.isActive = appliedFilters.isActive;
    if (appliedFilters.minDemand) params.minDemand = parseFloat(appliedFilters.minDemand);
    if (appliedFilters.maxDemand) params.maxDemand = parseFloat(appliedFilters.maxDemand);
    if (search.trim()) params.search = search.trim();
    return params;
  }, [page, appliedFilters, search]);

  const { data, isLoading, isFetching, refetch } = useGetInventoryQuery(queryParams as any);
  const { data: projects } = useGetProjectsDropdownQuery();
  const [createInventory, { isLoading: isCreating }] = useCreateInventoryMutation();
  const [updateInventory, { isLoading: isUpdating }] = useUpdateInventoryMutation();
  const [deleteInventory] = useDeleteInventoryMutation();
  const [toggleInventoryStatus] = useToggleInventoryStatusMutation();

  const items = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, page: 1, limit: 20, totalPages: 1 };

  // Active filter badge count — default "true" for isActive doesn't count
  const activeFilterCount = Object.entries(appliedFilters).filter(([k, v]) => {
    if (k === "inventoryType") return v !== "ALL";
    if (k === "isActive") return v !== "true";
    return v !== "";
  }).length;

  // ── Filter helpers ──

  const handleApplyFilters = () => {
    setAppliedFilters(pendingFilters);
    setPage(1);
    setShowFilterPanel(false);
  };

  const handleResetFilters = () => {
    setPendingFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const handleFilterTypeChange = (type: InventoryType | "ALL") => {
    if (type === "ALL") {
      setPendingFilters((f) => ({ ...f, inventoryType: "ALL", inventorySubType: "" }));
    } else {
      setPendingFilters((f) => ({
        ...f,
        inventoryType: type,
        inventorySubType: "",
      }));
    }
  };

  const availableFilterSubTypes =
    pendingFilters.inventoryType !== "ALL"
      ? SUB_TYPE_MAP[pendingFilters.inventoryType as InventoryType]
      : ALL_SUB_TYPES;

  // ── Search ──

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  // ── CRUD ──

  const openCreateModal = () => {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      ownerName: item.ownerName,
      ownerPhone: item.ownerPhone,
      ownerEmail: item.ownerEmail ?? "",
      inventoryType: item.inventoryType,
      inventorySubType: item.inventorySubType,
      projectId: item.projectId ?? "",
      unitNo: item.unitNo ?? "",
      towerNo: item.towerNo ?? "",
      bhk: item.bhk ?? "",
      size: item.size?.toString() ?? "",
      facing: item.facing ?? "",
      floor: item.floor ?? "",
      demand: item.demand?.toString() ?? "",
      hasTenant: item.hasTenant,
      hasParking: item.hasParking,
      furnishingType: (item.furnishingType as FurnishingType | "") ?? "",
    });
    setModalVisible(true);
  };

  // When form type changes, auto-select the first valid subtype
  const handleFormTypeChange = (type: InventoryType) => {
    setForm((f) => ({
      ...f,
      inventoryType: type,
      inventorySubType: SUB_TYPE_MAP[type][0].value,
    }));
  };

  const handleSubmit = async () => {
    if (!form.ownerName.trim()) {
      Alert.alert("Validation", "Owner name is required.");
      return;
    }
    if (!form.ownerPhone.trim()) {
      Alert.alert("Validation", "Owner phone is required.");
      return;
    }

    const body: any = {
      ownerName: form.ownerName.trim(),
      ownerPhone: form.ownerPhone.trim(),
      ownerEmail: form.ownerEmail.trim() || undefined,
      inventoryType: form.inventoryType,
      inventorySubType: form.inventorySubType,
      projectId: form.projectId || undefined,
      unitNo: form.unitNo.trim() || undefined,
      towerNo: form.towerNo.trim() || undefined,
      bhk: form.bhk || undefined,
      size: form.size ? parseFloat(form.size) : undefined,
      facing: form.facing || undefined,
      floor: form.floor.trim() || undefined,
      demand: form.demand ? parseFloat(form.demand) : undefined,
      hasTenant: form.hasTenant,
      hasParking: form.hasParking,
      furnishingType: form.furnishingType || undefined,
    };

    try {
      if (editingItem) {
        await updateInventory({ id: editingItem.id, body }).unwrap();
      } else {
        await createInventory(body).unwrap();
      }
      setModalVisible(false);
      setForm(EMPTY_FORM);
      setEditingItem(null);
    } catch {
      Alert.alert("Error", `Failed to ${editingItem ? "update" : "create"} inventory.`);
    }
  };

  const handleDelete = (item: InventoryItem) => {
    Alert.alert(
      "Delete Inventory",
      `Delete inventory for "${item.ownerName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteInventory(item.id).unwrap();
            } catch {
              Alert.alert("Error", "Failed to delete inventory item.");
            }
          },
        },
      ]
    );
  };

  const handleToggleStatus = async (item: InventoryItem) => {
    try {
      await toggleInventoryStatus({ id: item.id, isActive: !item.isActive }).unwrap();
    } catch {
      Alert.alert("Error", "Failed to update status.");
    }
  };

  // ── PDF ──

  const generatePdfAndShare = async (item: InventoryItem) => {
  // Load logo
  let logoBase64: string | undefined;
  try {
    const asset = Asset.fromModule(require('../assets/property360jpg.jpg'));
    await asset.downloadAsync();
    if (asset.localUri) {
      logoBase64 = await FileSystem.readAsStringAsync(asset.localUri, {
        encoding: 'base64',
      });
    }
  } catch {
    // falls back gracefully
  }

  const projectName = item.project?.name ?? "N/A";

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 24px; color: #1A0F2E; background: #fff; }
  h1 { font-size: 22px; color: #1A0F2E; margin-bottom: 4px; }
  h2 { font-size: 14px; color: #9B5E8A; margin-top: 20px; margin-bottom: 8px; border-bottom: 2px solid #C9A8C0; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 13px; }
  th, td { padding: 7px 10px; text-align: left; border-bottom: 1px solid #E8D8E4; }
  th { background: #F5F0F5; color: #666; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  .amount { text-align: right; font-weight: 600; }
  .highlight-row td { font-weight: 700; background: #F5E6C8; color: #1A0F2E; border-top: 2px solid #C8922A; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; background: #F5E6C8; color: #A67820; margin-right: 6px; }
  .badge-res { background: #E3F0FF; color: #1a6bbf; }
  .badge-com { background: #FFF3E0; color: #e67e22; }
  .badge-active { background: #e8f8ef; color: #27ae60; }
  .badge-inactive { background: #fdecea; color: #e74c3c; }
  .footer {
    margin-top: 28px;
    background: #5B184E;
    padding: 14px 20px 10px;
    text-align: center;
    border-radius: 8px;
  }
  .footer-logo-img { height: 48px; object-fit: contain; margin-bottom: 6px; display: block; margin-left: auto; margin-right: auto; }
  .footer-logo-placeholder { font-size: 18px; font-weight: 800; color: #ffffff; letter-spacing: 1px; margin-bottom: 6px; }
  .footer-address { font-size: 10px; color: #D2B9E1; margin-bottom: 8px; }
  .footer-quote { font-size: 13px; font-style: italic; color: #D2B9E1; }
</style>
</head>
<body>

  <h1>Inventory Details</h1>
  <div class="meta">
    <span class="badge ${item.inventoryType === 'RESIDENTIAL' ? 'badge-res' : 'badge-com'}">
      ${item.inventoryType === 'RESIDENTIAL' ? 'Residential' : 'Commercial'}
    </span>
    <span class="badge">${formatSubType(item.inventorySubType)}</span>
    ${item.bhk ? `<span class="badge">${formatBHK(item.bhk)}</span>` : ''}
    ${item.size ? `<span class="badge">${item.size} sq.ft.</span>` : ''}
    <span class="badge ${item.isActive ? 'badge-active' : 'badge-inactive'}">
      ${item.isActive ? 'Active' : 'Inactive'}
    </span>
  </div>

  <h2>Owner Details</h2>
  <table>
    <tr><th>Field</th><th class="amount">Value</th></tr>
    <tr><td>Owner Name</td><td class="amount">${item.ownerName}</td></tr>
    ${item.unitNo ? `<tr><td>Unit No</td><td class="amount">${item.unitNo}</td></tr>` : ''}
    ${item.towerNo ? `<tr><td>Tower No</td><td class="amount">${item.towerNo}</td></tr>` : ''}
    ${item.floor ? `<tr><td>Floor</td><td class="amount">${item.floor}</td></tr>` : ''}
  </table>

  <h2>Property Details</h2>
  <table>
    <tr><th>Field</th><th class="amount">Value</th></tr>
    <tr><td>Project</td><td class="amount">${projectName}</td></tr>
    ${item.bhk ? `<tr><td>BHK</td><td class="amount">${formatBHK(item.bhk)}</td></tr>` : ''}
    ${item.size != null ? `<tr><td>Size</td><td class="amount">${item.size} sq.ft.</td></tr>` : ''}
    ${item.facing ? `<tr><td>Facing</td><td class="amount">${item.facing}</td></tr>` : ''}
    ${item.furnishingType ? `<tr><td>Furnishing</td><td class="amount">${formatFurnishing(item.furnishingType)}</td></tr>` : ''}
    <tr><td>Has Tenant</td><td class="amount">${item.hasTenant ? 'Yes' : 'No'}</td></tr>
    <tr><td>Has Parking</td><td class="amount">${item.hasParking ? 'Yes' : 'No'}</td></tr>
    ${item.demand != null ? `<tr class="highlight-row"><td>Demand Price</td><td class="amount">${formatCurrency(item.demand)}</td></tr>` : ''}
  </table>

  <div class="footer">
    ${logoBase64
      ? `<img src="data:image/jpeg;base64,${logoBase64}" class="footer-logo-img" />`
      : `<div class="footer-logo-placeholder">PROPERTY 360</div>`
    }
    <div class="footer-address">
      Property 360 Degree Pvt Ltd : Office no: 543, Tower 3, Golden I Techzone 4 Greater Noida West 201306 , M: 9873280984
    </div>
    <div class="footer-quote">
      &ldquo;Don&rsquo;t wait to buy real estate, buy real estate and wait.&rdquo;
    </div>
  </div>

</body>
</html>`;

  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `${item.ownerName} — Inventory`,
        UTI: "com.adobe.pdf",
      });
    } else {
      await Share.share({ url: uri });
    }
  } catch {
    Alert.alert("Error", "Failed to generate PDF.");
  }
};

  // ── Picker Renderer (standalone Modal — for filter pickers rendered at root) ──

  const renderPickerModal = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { label: string; value: string }[],
    selected: string,
    onSelect: (val: string) => void,
    allowClear?: boolean
  ) => (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.pickerTitle, { color: theme.text, borderBottomColor: theme.divider }]}>
            {title}
          </Text>
          <ScrollView style={styles.pickerScroll}>
            {allowClear && (
              <TouchableOpacity
                onPress={() => { onSelect(""); onClose(); }}
                style={[styles.pickerOption, {
                  borderBottomColor: theme.divider,
                  backgroundColor: selected === "" ? theme.goldLight : "transparent",
                }]}
              >
                <Text style={[styles.pickerOptionText, { color: theme.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
            )}
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { onSelect(opt.value); onClose(); }}
                style={[styles.pickerOption, {
                  borderBottomColor: theme.divider,
                  backgroundColor: selected === opt.value ? theme.goldLight : "transparent",
                }]}
              >
                <Text style={[styles.pickerOptionText, {
                  color: selected === opt.value ? theme.gold : theme.text,
                }]}>
                  {opt.label}
                </Text>
                {selected === opt.value && (
                  <Ionicons name="checkmark" size={18} color={theme.gold} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Inline Picker Overlay (absolute — for use INSIDE the form Modal to avoid nested Modal issues) ──

  const renderInlinePicker = (
    visible: boolean,
    onClose: () => void,
    title: string,
    options: { label: string; value: string }[],
    selected: string,
    onSelect: (val: string) => void,
    allowClear?: boolean
  ) => {
    if (!visible) return null;
    return (
      <TouchableOpacity
        style={styles.inlinePickerOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.pickerContainer, { backgroundColor: theme.card }]}>
          <Text style={[styles.pickerTitle, { color: theme.text, borderBottomColor: theme.divider }]}>
            {title}
          </Text>
          <ScrollView style={styles.pickerScroll}>
            {allowClear && (
              <TouchableOpacity
                onPress={() => { onSelect(""); onClose(); }}
                style={[styles.pickerOption, {
                  borderBottomColor: theme.divider,
                  backgroundColor: selected === "" ? theme.goldLight : "transparent",
                }]}
              >
                <Text style={[styles.pickerOptionText, { color: theme.textSecondary }]}>Clear</Text>
              </TouchableOpacity>
            )}
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                onPress={() => { onSelect(opt.value); onClose(); }}
                style={[styles.pickerOption, {
                  borderBottomColor: theme.divider,
                  backgroundColor: selected === opt.value ? theme.goldLight : "transparent",
                }]}
              >
                <Text style={[styles.pickerOptionText, {
                  color: selected === opt.value ? theme.gold : theme.text,
                }]}>
                  {opt.label}
                </Text>
                {selected === opt.value && (
                  <Ionicons name="checkmark" size={18} color={theme.gold} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Card Renderer ──

  const renderItem = useCallback(
    ({ item }: { item: InventoryItem }) => (
      <View style={[
        styles.card,
        { backgroundColor: theme.card, borderColor: theme.cardBorder, opacity: item.isActive ? 1 : 0.65 },
      ]}>
        <View style={styles.cardRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardName, { color: theme.text }]}>{item.ownerName}</Text>
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={13} color={theme.textTertiary} />
              <Text style={[styles.cardPhone, { color: theme.textSecondary }]}>{item.ownerPhone}</Text>
            </View>
          </View>

          <View style={styles.badgesRow}>
            {/* Status badge */}
            <View style={[styles.statusBadge, {
              backgroundColor: item.isActive ? theme.successLight : theme.dangerLight,
            }]}>
              <Text style={{ fontSize: 10, fontWeight: "700", color: item.isActive ? theme.success : theme.danger }}>
                {item.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
            {/* Type badge */}
            <View style={[styles.typeBadge, {
              backgroundColor: item.inventoryType === "RESIDENTIAL"
                ? theme.infoLight
                : theme.warningLight,
            }]}>
              <Text style={{ fontSize: 11, fontWeight: "600", color: item.inventoryType === "RESIDENTIAL" ? theme.info : theme.warning }}>
                {item.inventoryType === "RESIDENTIAL" ? "Residential" : "Commercial"}
              </Text>
            </View>
          </View>
        </View>

        {/* Sub-type label */}
        {item.inventorySubType && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
            <Text style={{ fontSize: 11, color: theme.textTertiary, fontWeight: "500" }}>
              {formatSubType(item.inventorySubType)}
            </Text>
          </View>
        )}

        <View style={[styles.detailsGrid, { borderTopColor: theme.divider }]}>
          {item.project && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Project</Text>
              <Text style={[styles.detailValue, { color: theme.text }]} numberOfLines={1}>
                {item.project.name}
              </Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>BHK</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{formatBHK(item.bhk)}</Text>
          </View>
          {item.size != null && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Size</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{item.size} sq.ft.</Text>
            </View>
          )}
          {item.demand != null && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Demand</Text>
              <Text style={[styles.detailValue, { color: theme.gold }]}>{formatCurrency(item.demand)}</Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Furnishing</Text>
            <Text style={[styles.detailValue, { color: theme.text }]}>{formatFurnishing(item.furnishingType)}</Text>
          </View>
          {item.floor && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Floor</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>{item.floor}</Text>
            </View>
          )}
          {(item.unitNo || item.towerNo) && (
            <View style={styles.detailItem}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Unit/Tower</Text>
              <Text style={[styles.detailValue, { color: theme.text }]}>
                {[item.unitNo, item.towerNo].filter(Boolean).join(" / ")}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.cardActions, { borderTopColor: theme.divider }]}>
          {/* PDF always visible */}
          <TouchableOpacity
            onPress={() => generatePdfAndShare(item)}
            style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
          >
            <Ionicons name="share-outline" size={16} color={theme.info} />
            <Text style={[styles.actionBtnText, { color: theme.info }]}>PDF</Text>
          </TouchableOpacity>

          {/* Edit, Toggle, Delete — permission-gated */}
          {canEdit && (
            <>
              <TouchableOpacity
                onPress={() => openEditModal(item)}
                style={[styles.actionBtn, { backgroundColor: theme.surfaceVariant }]}
              >
                <Ionicons name="create-outline" size={16} color={theme.mauve} />
                <Text style={[styles.actionBtnText, { color: theme.mauve }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleToggleStatus(item)}
                style={[styles.actionBtn, {
                  backgroundColor: item.isActive ? theme.dangerLight : theme.successLight,
                }]}
              >
                <Ionicons
                  name={item.isActive ? "arrow-up" : "arrow-down"}
                  size={16}
                  color={item.isActive ? theme.danger : theme.success}
                />
                <Text style={[styles.actionBtnText, {
                  color: item.isActive ? theme.danger : theme.success,
                }]}>
                  {item.isActive ? "Deactivate" : "Activate"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleDelete(item)}
                style={[styles.actionBtn, { backgroundColor: theme.dangerLight }]}
              >
                <Ionicons name="trash-outline" size={16} color={theme.danger} />
                <Text style={[styles.actionBtnText, { color: theme.danger }]}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    ),
    [theme, isDark, projects, canEdit]
  );

  // ── Loading ──

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <ScreenHeader title="Inventory" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.inventory} />}/>
        <LoadingScreen message="Loading inventory..." />
      </View>
    );
  }

  // ── Render ──

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Inventory" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.inventory} />}/>

      {/* ── Search + Filter Row ── */}
      <View style={styles.filterSection}>
        <View style={styles.searchAndFilterRow}>
          <View style={[styles.searchRow, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, flex: 1 }]}>
            <Ionicons name="search-outline" size={18} color={theme.placeholder} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              value={searchInput}
              onChangeText={setSearchInput}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              placeholder="Search name, phone, unit..."
              placeholderTextColor={theme.placeholder}
            />
            {searchInput.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchInput(""); setSearch(""); setPage(1); }}>
                <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            onPress={() => { setPendingFilters(appliedFilters); setShowFilterPanel((v) => !v); }}
            style={[styles.filterBtn, {
              backgroundColor: activeFilterCount > 0 ? theme.goldLight : theme.surfaceVariant,
              borderColor: activeFilterCount > 0 ? theme.gold : theme.border,
            }]}
          >
            <Ionicons name="options-outline" size={18} color={activeFilterCount > 0 ? theme.gold : theme.textSecondary} />
            {activeFilterCount > 0 && (
              <View style={[styles.filterBadge, { backgroundColor: theme.gold }]}>
                <Text style={{ fontSize: 9, color: "#fff", fontWeight: "800" }}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Filter Panel ── */}
        {showFilterPanel && (
          <View style={[styles.filterPanel, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.filterPanelHeader}>
              <Text style={[styles.filterPanelTitle, { color: theme.text }]}>Filter Inventory</Text>
              <TouchableOpacity onPress={() => setShowFilterPanel(false)}>
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Type filter */}
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Type</Text>
            <View style={styles.toggleRow}>
              {INVENTORY_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => handleFilterTypeChange(t.value as InventoryType | "ALL")}
                  style={[styles.toggleBtnSmall, {
                    backgroundColor: pendingFilters.inventoryType === t.value ? theme.gold : theme.surfaceVariant,
                    borderColor: pendingFilters.inventoryType === t.value ? theme.gold : theme.border,
                  }]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "600", color: pendingFilters.inventoryType === t.value ? theme.textInverse : theme.textSecondary }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Sub Type */}
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Sub Type</Text>
            <TouchableOpacity
              onPress={() => setFilterSubTypePicker(true)}
              style={[styles.filterPickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            >
              <Text style={{ color: pendingFilters.inventorySubType ? theme.text : theme.placeholder, fontSize: 13 }}>
                {pendingFilters.inventorySubType
                  ? ALL_SUB_TYPES.find((s) => s.value === pendingFilters.inventorySubType)?.label
                  : "All Sub Types"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* BHK */}
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>BHK</Text>
            <TouchableOpacity
              onPress={() => setFilterBhkPicker(true)}
              style={[styles.filterPickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            >
              <Text style={{ color: pendingFilters.bhk ? theme.text : theme.placeholder, fontSize: 13 }}>
                {pendingFilters.bhk ? BHK_OPTIONS.find((b) => b.value === pendingFilters.bhk)?.label : "All BHK"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* Project */}
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Project</Text>
            <TouchableOpacity
              onPress={() => setFilterProjectPicker(true)}
              style={[styles.filterPickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            >
              <Text style={{ color: pendingFilters.projectId ? theme.text : theme.placeholder, fontSize: 13 }} numberOfLines={1}>
                {pendingFilters.projectId
                  ? projects?.find((p) => p.id === pendingFilters.projectId)?.name ?? "Selected"
                  : "All Projects"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* Status */}
            <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Status</Text>
            <TouchableOpacity
              onPress={() => setFilterStatusPicker(true)}
              style={[styles.filterPickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
            >
              <Text style={{ color: theme.text, fontSize: 13 }}>
                {STATUS_OPTIONS.find((s) => s.value === pendingFilters.isActive)?.label ?? "All"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {/* Min / Max Demand */}
            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Min Demand (₹)</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                  value={pendingFilters.minDemand}
                  onChangeText={(t) => setPendingFilters((f) => ({ ...f, minDemand: t }))}
                  placeholder="e.g. 500000"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.filterLabel, { color: theme.textSecondary }]}>Max Demand (₹)</Text>
                <TextInput
                  style={[styles.filterInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                  value={pendingFilters.maxDemand}
                  onChangeText={(t) => setPendingFilters((f) => ({ ...f, maxDemand: t }))}
                  placeholder="e.g. 10000000"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Filter actions */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                onPress={handleResetFilters}
                style={[styles.filterActionBtn, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "600", color: theme.mauve }}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleApplyFilters}
                style={[styles.filterActionBtn, { backgroundColor: theme.gold, borderColor: theme.gold, flex: 1.5 }]}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── List ── */}
      {items.length === 0 && !isFetching ? (
        <EmptyState
          icon="home-outline"
          title="No inventory found"
          subtitle="Add your first inventory item using the + button"
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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

      {/* ── Pagination ── */}
      {meta.totalPages > 1 && (
        <PaginationBar
          page={meta.page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
        />
      )}

      {/* ── FAB — only if canEdit ── */}
      {canEdit && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.gold }]}
          onPress={openCreateModal}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* ── Filter Picker Modals ── */}
      {renderPickerModal(
        filterSubTypePicker,
        () => setFilterSubTypePicker(false),
        "Select Sub Type",
        availableFilterSubTypes,
        pendingFilters.inventorySubType,
        (v) => setPendingFilters((f) => ({ ...f, inventorySubType: v as InventorySubType | "" })),
        true
      )}
      {renderPickerModal(
        filterBhkPicker,
        () => setFilterBhkPicker(false),
        "Select BHK",
        BHK_OPTIONS,
        pendingFilters.bhk,
        (v) => setPendingFilters((f) => ({ ...f, bhk: v as BHKType | "" })),
        true
      )}
      {renderPickerModal(
        filterProjectPicker,
        () => setFilterProjectPicker(false),
        "Select Project",
        (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
        pendingFilters.projectId,
        (v) => setPendingFilters((f) => ({ ...f, projectId: v })),
        true
      )}
      {renderPickerModal(
        filterStatusPicker,
        () => setFilterStatusPicker(false),
        "Select Status",
        STATUS_OPTIONS,
        pendingFilters.isActive,
        (v) => setPendingFilters((f) => ({ ...f, isActive: v as "true" | "false" | "" })),
        false
      )}

      {/* ── Create/Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={{ position: "relative", maxHeight: "92%" }}>
          <View style={[styles.modalContainer, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingItem ? "Edit Inventory" : "New Inventory"}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setEditingItem(null); }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>

              {/* Owner Name */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Owner Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={form.ownerName}
                onChangeText={(t) => setForm((f) => ({ ...f, ownerName: t }))}
                placeholder="Owner name"
                placeholderTextColor={theme.placeholder}
              />

              {/* Owner Phone */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Owner Phone *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={form.ownerPhone}
                onChangeText={(t) => setForm((f) => ({ ...f, ownerPhone: t }))}
                placeholder="Phone number"
                placeholderTextColor={theme.placeholder}
                keyboardType="phone-pad"
              />

              {/* Owner Email */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Owner Email</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={form.ownerEmail}
                onChangeText={(t) => setForm((f) => ({ ...f, ownerEmail: t }))}
                placeholder="Email (optional)"
                placeholderTextColor={theme.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              {/* Inventory Type — auto-syncs sub type */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Type *</Text>
              <View style={styles.toggleRow}>
                {(["RESIDENTIAL", "COMMERCIAL"] as InventoryType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => handleFormTypeChange(t)}
                    style={[styles.toggleBtn, {
                      backgroundColor: form.inventoryType === t ? theme.gold : theme.surfaceVariant,
                      borderColor: form.inventoryType === t ? theme.gold : theme.border,
                    }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: form.inventoryType === t ? theme.textInverse : theme.text }}>
                      {t === "RESIDENTIAL" ? "Residential" : "Commercial"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sub Type — filtered by type */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Sub Type *</Text>
              <TouchableOpacity
                onPress={() => setShowFormSubTypePicker(true)}
                style={[styles.input, styles.pickerInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              >
                <Text style={{ color: form.inventorySubType ? theme.text : theme.placeholder, fontSize: 14 }}>
                  {form.inventorySubType ? formatSubType(form.inventorySubType) : "Select sub type"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* Project */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Project</Text>
              <TouchableOpacity
                onPress={() => setShowFormProjectPicker(true)}
                style={[styles.input, styles.pickerInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              >
                <Text style={{ color: form.projectId ? theme.text : theme.placeholder, fontSize: 14 }} numberOfLines={1}>
                  {form.projectId
                    ? projects?.find((p) => p.id === form.projectId)?.name ?? "Selected"
                    : "Select project (optional)"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* BHK + Size + Floor */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>BHK</Text>
                  <TouchableOpacity
                    onPress={() => setShowFormBhkPicker(true)}
                    style={[styles.input, styles.pickerInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                  >
                    <Text style={{ color: form.bhk ? theme.text : theme.placeholder, fontSize: 13 }}>
                      {form.bhk ? formatBHK(form.bhk as BHKType) : "Select"}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Size (sq.ft.)</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                    value={form.size}
                    onChangeText={(t) => setForm((f) => ({ ...f, size: t }))}
                    placeholder="Size"
                    placeholderTextColor={theme.placeholder}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Unit / Tower / Floor */}
              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Unit No</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                    value={form.unitNo}
                    onChangeText={(t) => setForm((f) => ({ ...f, unitNo: t }))}
                    placeholder="Unit"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Tower No</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                    value={form.towerNo}
                    onChangeText={(t) => setForm((f) => ({ ...f, towerNo: t }))}
                    placeholder="Tower"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Floor</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                    value={form.floor}
                    onChangeText={(t) => setForm((f) => ({ ...f, floor: t }))}
                    placeholder="Floor"
                    placeholderTextColor={theme.placeholder}
                  />
                </View>
              </View>

              {/* Facing */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Facing</Text>
              <TouchableOpacity
                onPress={() => setShowFormFacingPicker(true)}
                style={[styles.input, styles.pickerInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              >
                <Text style={{ color: form.facing ? theme.text : theme.placeholder, fontSize: 14 }}>
                  {form.facing || "Select facing"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* Demand */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Demand Price (₹)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
                value={form.demand}
                onChangeText={(t) => setForm((f) => ({ ...f, demand: t }))}
                placeholder="Demand amount"
                placeholderTextColor={theme.placeholder}
                keyboardType="numeric"
              />

              {/* Furnishing */}
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Furnishing</Text>
              <TouchableOpacity
                onPress={() => setShowFormFurnishingPicker(true)}
                style={[styles.input, styles.pickerInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              >
                <Text style={{ color: form.furnishingType ? theme.text : theme.placeholder, fontSize: 14 }}>
                  {form.furnishingType ? formatFurnishing(form.furnishingType) : "Select furnishing"}
                </Text>
                <Ionicons name="chevron-down" size={18} color={theme.textTertiary} />
              </TouchableOpacity>

              {/* Toggles */}
              <View style={styles.switchRow}>
                <View style={styles.switchItem}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Has Tenant</Text>
                  <Switch
                    value={form.hasTenant}
                    onValueChange={(v) => setForm((f) => ({ ...f, hasTenant: v }))}
                    trackColor={{ false: theme.border, true: theme.gold }}
                    thumbColor={form.hasTenant ? theme.goldDark : theme.textTertiary}
                  />
                </View>
                <View style={styles.switchItem}>
                  <Text style={[styles.switchLabel, { color: theme.text }]}>Has Parking</Text>
                  <Switch
                    value={form.hasParking}
                    onValueChange={(v) => setForm((f) => ({ ...f, hasParking: v }))}
                    trackColor={{ false: theme.border, true: theme.gold }}
                    thumbColor={form.hasParking ? theme.goldDark : theme.textTertiary}
                  />
                </View>
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity
                onPress={() => { setModalVisible(false); setEditingItem(null); }}
                style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isCreating || isUpdating}
                style={[styles.modalBtn, {
                  backgroundColor: isCreating || isUpdating ? theme.textTertiary : theme.gold,
                }]}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                  {isCreating || isUpdating
                    ? "Saving..."
                    : editingItem ? "Update" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Inline Pickers (absolute overlay inside the form Modal) ── */}
          {renderInlinePicker(
            showFormSubTypePicker,
            () => setShowFormSubTypePicker(false),
            "Select Sub Type",
            SUB_TYPE_MAP[form.inventoryType],
            form.inventorySubType,
            (v) => setForm((f) => ({ ...f, inventorySubType: v as InventorySubType })),
            false
          )}
          {renderInlinePicker(
            showFormBhkPicker,
            () => setShowFormBhkPicker(false),
            "Select BHK",
            BHK_OPTIONS,
            form.bhk,
            (v) => setForm((f) => ({ ...f, bhk: v as BHKType | "" })),
            true
          )}
          {renderInlinePicker(
            showFormFacingPicker,
            () => setShowFormFacingPicker(false),
            "Select Facing",
            FACING_OPTIONS.map((f) => ({ label: f, value: f })),
            form.facing,
            (v) => setForm((f) => ({ ...f, facing: v })),
            true
          )}
          {renderInlinePicker(
            showFormFurnishingPicker,
            () => setShowFormFurnishingPicker(false),
            "Select Furnishing",
            FURNISHING_OPTIONS,
            form.furnishingType,
            (v) => setForm((f) => ({ ...f, furnishingType: v as FurnishingType | "" })),
            true
          )}
          {renderInlinePicker(
            showFormProjectPicker,
            () => setShowFormProjectPicker(false),
            "Select Project",
            (projects ?? []).map((p) => ({ label: p.name, value: p.id })),
            form.projectId,
            (v) => setForm((f) => ({ ...f, projectId: v })),
            true
          )}
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
    paddingBottom: 4,
  },
  searchAndFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
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
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  filterPanel: {
    margin: 16,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  filterPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  filterPanelTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 10,
  },
  filterPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  filterActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
    gap: 10,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
  },
  cardName: {
    fontSize: 15,
    fontWeight: "600",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  cardPhone: {
    fontSize: 13,
  },
  badgesRow: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    borderTopWidth: 1,
    gap: 4,
  },
  detailItem: {
    width: "48%",
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 8,
    gap: 6,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    minWidth: 60,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "600",
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
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContainer: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  maxHeight: 500, // or use Dimensions for dynamic sizing
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
  pickerInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowInputs: {
    flexDirection: "row",
    gap: 10,
  },
  toggleRow: {
    flexDirection: "row",
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleBtnSmall: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  switchRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 16,
  },
  switchItem: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "500",
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
  // Picker modal
  pickerOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  inlinePickerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    zIndex: 999,
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
});

export default InventoryScreen;