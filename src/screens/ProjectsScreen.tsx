import React, { useState, useCallback } from "react";
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
  LayoutAnimation,
  UIManager,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingScreen } from "../components/common/LoadingScreen";
import {
  useGetProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} from "../store/projects.api";
import { useGetProfileQuery } from "../store/auth.api";
import type { Project } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

// ── Enable LayoutAnimation on Android ────────────────────────────────────────
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Designation Access Control ────────────────────────────────────────────────

const CAN_ADD_EDIT_DESIGNATIONS = new Set([
  "ADMIN",
  "DGM",
  "GM",
  "VP_SALES",
  "AREA_MANAGER",
  "SALES_COORDINATOR",
  "SALES_MANAGER",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function n(v: number | null | undefined): number {
  return Number(v ?? 0);
}

function fmt(v: number | null | undefined): string {
  if (!v) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
}

function calcPrices(p: Project, size: number) {
  const bsp = n(p.basicSellPrice);
  const discount = n(p.discount);
  const base =
    (bsp - discount) * size;
  const addl =
    (n(p.edc) +
      n(p.idc) +
      n(p.ffc) +
      n(p.viewPlc) +
      n(p.cornerPlc) +
      n(p.floorPlc) +
      n(p.otherAdditionalCharges)) *
    size;
  const poss = n(p.otherPossessionCharges) * size;
  const total = base + addl + poss;
  const gst = total * (n(p.gstPercent) / 100);
  const totalGst = total + gst;
  return { base, addl, poss, total, gst, totalGst };
}

// ── Form State ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  clientName: string;
  product: string;
  sizeInSqft: string;
  floors: string;
  basicSellPrice: string;
  discount: string;
  viewPlc: string;
  cornerPlc: string;
  floorPlc: string;
  edc: string;
  idc: string;
  ffc: string;
  otherAdditionalCharges: string;
  leastRent: string;
  otherPossessionCharges: string;
  gstPercent: string;
  paymentPlan: string;
  powerBackupKva: string;
  powerBackupPrice: string;
  onBookingPercent: string;
  within30DaysPercent: string;
  onPossessionPercent: string;
  note1: string;
  note2: string;
  note3: string;
  note4: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  clientName: "",
  product: "",
  sizeInSqft: "",
  floors: "",
  basicSellPrice: "",
  discount: "",
  viewPlc: "",
  cornerPlc: "",
  floorPlc: "",
  edc: "",
  idc: "",
  ffc: "",
  otherAdditionalCharges: "",
  leastRent: "",
  otherPossessionCharges: "",
  gstPercent: "",
  paymentPlan: "",
  powerBackupKva: "",
  powerBackupPrice: "",
  onBookingPercent: "",
  within30DaysPercent: "",
  onPossessionPercent: "",
  note1: "",
  note2: "",
  note3: "",
  note4: "",
};

function projectToForm(p: Project): FormState {
  return {
    name: p.name ?? "",
    clientName: p.clientName ?? "",
    product: p.product ?? "",
    sizeInSqft: p.sizeInSqft?.toString() ?? "",
    floors: p.floors?.toString() ?? "",
    basicSellPrice: p.basicSellPrice?.toString() ?? "",
    discount: p.discount?.toString() ?? "",
    viewPlc: p.viewPlc?.toString() ?? "",
    cornerPlc: p.cornerPlc?.toString() ?? "",
    floorPlc: p.floorPlc?.toString() ?? "",
    edc: p.edc?.toString() ?? "",
    idc: p.idc?.toString() ?? "",
    ffc: p.ffc?.toString() ?? "",
    otherAdditionalCharges: p.otherAdditionalCharges?.toString() ?? "",
    leastRent: p.leastRent?.toString() ?? "",
    otherPossessionCharges: p.otherPossessionCharges?.toString() ?? "",
    gstPercent: p.gstPercent?.toString() ?? "",
    paymentPlan: p.paymentPlan ?? "",
    powerBackupKva: p.powerBackupKva?.toString() ?? "",
    powerBackupPrice: p.powerBackupPrice?.toString() ?? "",
    onBookingPercent: p.onBookingPercent?.toString() ?? "",
    within30DaysPercent: p.within30DaysPercent?.toString() ?? "",
    onPossessionPercent: p.onPossessionPercent?.toString() ?? "",
    note1: p.note1 ?? "",
    note2: p.note2 ?? "",
    note3: p.note3 ?? "",
    note4: p.note4 ?? "",
  };
}

// ── PDF Generator (matches web calcPrices logic) ──────────────────────────────

function buildPricingHtml(p: Project, logoBase64?: string): string {
  const size = n(p.sizeInSqft);
  const { base, addl, poss, total, gst, totalGst } = calcPrices(p, size);

  const fmtInr = fmt;

  const onBookingAmt = Math.round(totalGst * (n(p.onBookingPercent) / 100));
  const within30Amt = Math.round(totalGst * (n(p.within30DaysPercent) / 100));
  const onPossessionAmt = Math.round(totalGst * (n(p.onPossessionPercent) / 100));

  const notes = [p.note1, p.note2, p.note3, p.note4].filter(Boolean) as string[];

  return `
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
  .subtotal-row td { font-weight: 700; background: #F5E6C8; color: #1A0F2E; border-top: 2px solid #C8922A; }
  .grand-total td { font-weight: 800; font-size: 14px; background: #1A0F2E; color: #fff; }
  .notes li { font-size: 12px; color: #555; margin-bottom: 4px; line-height: 1.6; }
  .footer {
  margin-top: 28px;
  background: #5B184E;
  padding: 14px 20px 10px;
  text-align: center;
  border-radius: 8px;
}
.footer-logo-placeholder {
  font-size: 18px;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: 1px;
  margin-bottom: 6px;
}
.footer-address {
  font-size: 10px;
  color: #D2B9E1;
  margin-bottom: 8px;
}
.footer-quote {
  font-size: 13px;
  font-style: italic;
  color: #D2B9E1;
}
  .badge { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700; background: #F5E6C8; color: #A67820; margin-right: 6px; }
</style>
</head>
<body>
  <h1>${p.name}</h1>
  <div class="meta">
    ${p.clientName ? `<span class="badge">Client: ${p.clientName}</span>` : ""}
    ${p.product ? `<span class="badge">${p.product}</span>` : ""}
    ${size ? `<span class="badge">${size} sq.ft.</span>` : ""}
    ${p.floors ? `<span class="badge">${p.floors} Floors</span>` : ""}
    ${p.paymentPlan ? `<span class="badge">${p.paymentPlan}</span>` : ""}
  </div>

  <h2>Basic Price</h2>
<table>
  <tr><th>Component</th><th>Rate / sq.ft.</th><th class="amount">Amount</th></tr>
  <tr><td>Basic Sell Price (BSP)</td><td>${fmtInr(p.basicSellPrice)}</td><td class="amount">${fmtInr(n(p.basicSellPrice) * size)}</td></tr>
  <tr class="subtotal-row"><td colspan="2">Basic Amount</td><td class="amount">${fmtInr(base)}</td></tr>
</table>

  ${addl > 0 ? `
  <h2>Additional Charges</h2>
  <table>
    <tr><th>Component</th><th>Rate / sq.ft.</th><th class="amount">Amount</th></tr>
    ${n(p.viewPlc) > 0 ? `<tr><td>View PLC</td><td>${fmtInr(p.viewPlc)}</td><td class="amount">${fmtInr(n(p.viewPlc) * size)}</td></tr>` : ""}
    ${n(p.cornerPlc) > 0 ? `<tr><td>Corner PLC</td><td>${fmtInr(p.cornerPlc)}</td><td class="amount">${fmtInr(n(p.cornerPlc) * size)}</td></tr>` : ""}
    ${n(p.floorPlc) > 0 ? `<tr><td>Floor PLC</td><td>${fmtInr(p.floorPlc)}</td><td class="amount">${fmtInr(n(p.floorPlc) * size)}</td></tr>` : ""}
    ${n(p.otherAdditionalCharges) > 0 ? `<tr><td>Other Additional</td><td>${fmtInr(p.otherAdditionalCharges)}</td><td class="amount">${fmtInr(n(p.otherAdditionalCharges) * size)}</td></tr>` : ""}
    <tr class="subtotal-row"><td colspan="2">Total Additional</td><td class="amount">${fmtInr(addl)}</td></tr>
  </table>` : ""}

  ${poss > 0 ? `
  <h2>Possession Charges</h2>
  <table>
    <tr><th>Component</th><th></th><th class="amount">Amount</th></tr>
    
    <tr class="subtotal-row"><td colspan="2">Total Possession</td><td class="amount">${fmtInr(poss)}</td></tr>
  </table>` : ""}

  <h2>Total Price</h2>
  <table>
    <tr><th>Component</th><th></th><th class="amount">Amount</th></tr>
    <tr><td>Subtotal</td><td></td><td class="amount">${fmtInr(total)}</td></tr>
    <tr><td>GST (${n(p.gstPercent)}%)</td><td></td><td class="amount">${fmtInr(gst)}</td></tr>
    <tr class="grand-total"><td colspan="2">Grand Total (Incl. GST)</td><td class="amount">${fmtInr(totalGst)}</td></tr>
  </table>

  ${n(p.onBookingPercent) > 0 || n(p.within30DaysPercent) > 0 || n(p.onPossessionPercent) > 0 ? `
  <h2>Payment Schedule</h2>
  <table>
    <tr><th>Milestone</th><th>Percentage</th><th class="amount">Amount</th></tr>
    ${n(p.onBookingPercent) > 0 ? `<tr><td>On Booking</td><td>${n(p.onBookingPercent)}%</td><td class="amount">${fmtInr(onBookingAmt)}</td></tr>` : ""}
    ${n(p.within30DaysPercent) > 0 ? `<tr><td>Within 30 Days</td><td>${n(p.within30DaysPercent)}%</td><td class="amount">${fmtInr(within30Amt)}</td></tr>` : ""}
    ${n(p.onPossessionPercent) > 0 ? `<tr><td>On Possession</td><td>${n(p.onPossessionPercent)}%</td><td class="amount">${fmtInr(onPossessionAmt)}</td></tr>` : ""}
  </table>` : ""}

  ${notes.length > 0 ? `
  <h2>Notes</h2>
  <ul class="notes">
    ${notes.map((note) => `<li>${note}</li>`).join("")}
  </ul>` : ""}

  <div class="footer">
  ${logoBase64
      ? `<img src="data:image/jpeg;base64,${logoBase64}" style="height:48px; object-fit:contain; margin-bottom:6px;" />`
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
}

// ── Price Row (for expanded card breakdown) ────────────────────────────────────

function PriceRow({
  label,
  value,
  bold,
  highlight,
  theme,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
  theme: any;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, { color: highlight ? theme.text : theme.textSecondary, fontWeight: bold ? "700" : "400" }]}>
        {label}
      </Text>
      <Text style={[styles.priceValue, { color: highlight ? theme.gold : theme.text, fontWeight: bold ? "800" : "600" }]}>
        {value}
      </Text>
    </View>
  );
}

// ── Section Label (for expanded card) ─────────────────────────────────────────

function SectionLabel({ icon, title, theme }: { icon: string; title: string; theme: any }) {
  return (
    <Text style={[styles.sectionLabel, { color: theme.mauve }]}>
      {icon} {title.toUpperCase()}
    </Text>
  );
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({
  item,
  canAddEdit,
  canDelete,
  theme,
  generatingPdf,
  onEdit,
  onDelete,
  onPdf,
}: {
  item: Project;
  canAddEdit: boolean;
  canDelete: boolean;
  theme: any;
  generatingPdf: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onPdf: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const size = n(item.sizeInSqft);
  const { base, addl, poss, total, gst, totalGst } = calcPrices(item, size);
  const notes = [item.note1, item.note2, item.note3, item.note4].filter(Boolean) as string[];
  const isPdfLoading = generatingPdf === item.id;

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((x) => !x);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      {/* Gradient top stripe */}
      <View style={styles.cardStripe} />

      {/* Header */}
      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.projectName, { color: theme.text }]} numberOfLines={2}>
              {item.name}
            </Text>
            {item.clientName && (
              <Text style={[styles.clientName, { color: theme.textSecondary }]}>
                {item.clientName}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.cardActionRow}>
            {/* PDF — always visible */}
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: theme.infoLight }]}
              onPress={onPdf}
              disabled={isPdfLoading}
            >
              {isPdfLoading ? (
                <ActivityIndicator size="small" color={theme.info} />
              ) : (
                <Ionicons name="document-text-outline" size={16} color={theme.info} />
              )}
            </TouchableOpacity>

            {/* Edit — canAddEdit only */}
            {canAddEdit && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.surfaceVariant }]}
                onPress={onEdit}
              >
                <Ionicons name="create-outline" size={16} color={theme.mauve} />
              </TouchableOpacity>
            )}

            {/* Delete — ADMIN only */}
            {canDelete && (
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: theme.dangerLight }]}
                onPress={onDelete}
              >
                <Ionicons name="trash-outline" size={16} color={theme.danger} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Chips */}
        <View style={styles.chipRow}>
          {item.product && (
            <View style={[styles.chip, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
              <Text style={[styles.chipText, { color: theme.text }]}>{item.product}</Text>
            </View>
          )}
          {size > 0 && (
            <View style={[styles.chip, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
              <Text style={[styles.chipText, { color: theme.goldDark }]}>{size} sqft</Text>
            </View>
          )}
          {item.basicSellPrice != null && (
            <View style={[styles.chip, { backgroundColor: theme.successLight ?? "#e8f8ef", borderColor: theme.success ?? "#27ae60" }]}>
              <Text style={[styles.chipText, { color: theme.success ?? "#27ae60", fontWeight: "700" }]}>
                BSP {fmt(item.basicSellPrice)}
              </Text>
            </View>
          )}
          {item.gstPercent != null && (
            <View style={[styles.chip, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
              <Text style={[styles.chipText, { color: theme.textSecondary }]}>GST {item.gstPercent}%</Text>
            </View>
          )}
        </View>
      </View>

      {/* Expand toggle */}
      <TouchableOpacity
        onPress={toggleExpand}
        style={[styles.expandBtn, { backgroundColor: theme.surfaceVariant, borderTopColor: theme.divider }]}
      >
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={theme.mauve}
        />
        <Text style={[styles.expandBtnText, { color: theme.mauve }]}>
          {expanded ? "Hide Details" : "View Full Breakdown"}
        </Text>
      </TouchableOpacity>

      {/* Expanded breakdown */}
      {expanded && (
        <View style={[styles.breakdown, { borderTopColor: theme.divider }]}>

          {/* Project Info */}
          {(item.floors || item.paymentPlan) && (
            <View style={styles.breakdownSection}>
              <SectionLabel icon="🏢" title="Project Info" theme={theme} />
              {item.floors != null && (
                <PriceRow label="Floors" value={String(item.floors)} theme={theme} />
              )}
              {item.paymentPlan && (
                <PriceRow label="Payment Plan" value={item.paymentPlan} theme={theme} />
              )}
            </View>
          )}

          {/* Basic Price */}
          <View style={styles.breakdownSection}>
            <SectionLabel icon="💰" title="Basic Price" theme={theme} />
            <PriceRow label="BSP/sqft" value={fmt(item.basicSellPrice)} theme={theme} />
            {n(item.discount) > 0 && (
              <PriceRow label="Discount" value={fmt(item.discount)} theme={theme} />
            )}
            <PriceRow label="Size" value={size ? `${size} sqft` : "—"} theme={theme} />
            <PriceRow label="Amount" value={`₹ ${base.toLocaleString("en-IN")}`} bold theme={theme} />
          </View>

          {/* Additional Charges */}
          {addl > 0 && (
            <View style={styles.breakdownSection}>
              <SectionLabel icon="➕" title="Additional Charges" theme={theme} />
              {n(item.edc) > 0 && <PriceRow label="EDC" value={`₹ ${(n(item.edc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.idc) > 0 && <PriceRow label="IDC" value={`₹ ${(n(item.idc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.ffc) > 0 && <PriceRow label="FFC" value={`₹ ${(n(item.ffc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.viewPlc) > 0 && <PriceRow label="View PLC" value={`₹ ${(n(item.viewPlc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.cornerPlc) > 0 && <PriceRow label="Corner PLC" value={`₹ ${(n(item.cornerPlc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.floorPlc) > 0 && <PriceRow label="Floor PLC" value={`₹ ${(n(item.floorPlc) * size).toLocaleString("en-IN")}`} theme={theme} />}
              {n(item.otherAdditionalCharges) > 0 && (
                <PriceRow label="Other Additional" value={`₹ ${(n(item.otherAdditionalCharges) * size).toLocaleString("en-IN")}`} theme={theme} />
              )}
              <PriceRow label="Total Additional" value={`₹ ${addl.toLocaleString("en-IN")}`} bold theme={theme} />
            </View>
          )}

          {/* Possession Charges */}
          {poss > 0 && (
            <View style={styles.breakdownSection}>
              <SectionLabel icon="🏠" title="Possession Charges" theme={theme} />
              {n(item.powerBackupKva) > 0 && (
                <PriceRow
                  label={`Power Backup (${item.powerBackupKva} KVA)`}
                  value={`₹ ${(n(item.powerBackupPrice) * n(item.powerBackupKva)).toLocaleString("en-IN")}`}
                  theme={theme}
                />
              )}
              {n(item.leastRent) > 0 && (
                <PriceRow label="Lease Rent" value={`₹ ${(n(item.leastRent) * size).toLocaleString("en-IN")}`} theme={theme} />
              )}
              {n(item.otherPossessionCharges) > 0 && (
                <PriceRow label="Other Possession" value={`₹ ${(n(item.otherPossessionCharges) * size).toLocaleString("en-IN")}`} theme={theme} />
              )}
              <PriceRow label="Total Possession" value={`₹ ${poss.toLocaleString("en-IN")}`} bold theme={theme} />
            </View>
          )}

          {/* Total */}
          <View style={[styles.breakdownSection, styles.totalSection, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}>
            <SectionLabel icon="🧾" title="Total Price" theme={theme} />
            <PriceRow label="Subtotal" value={`₹ ${total.toLocaleString("en-IN")}`} theme={theme} />
            <PriceRow label={`GST ${n(item.gstPercent)}%`} value={`₹ ${gst.toLocaleString("en-IN")}`} theme={theme} />
            <PriceRow label="Total (Incl. GST)" value={`₹ ${totalGst.toLocaleString("en-IN")}`} bold highlight theme={theme} />
          </View>

          {/* Booking */}
          {(item.onBookingPercent || item.within30DaysPercent || item.onPossessionPercent) && (
            <View style={styles.breakdownSection}>
              <SectionLabel icon="📋" title="Booking" theme={theme} />
              {item.onBookingPercent != null && (
                <PriceRow
                  label={`On Booking (${item.onBookingPercent}%)`}
                  value={`₹ ${Math.round(totalGst * n(item.onBookingPercent) / 100).toLocaleString("en-IN")}`}
                  theme={theme}
                />
              )}
              {item.within30DaysPercent != null && (
                <PriceRow
                  label={`Within 30 Days (${item.within30DaysPercent}%)`}
                  value={`₹ ${Math.round(totalGst * n(item.within30DaysPercent) / 100).toLocaleString("en-IN")}`}
                  theme={theme}
                />
              )}
              {item.onPossessionPercent != null && (
                <PriceRow
                  label={`On Possession (${item.onPossessionPercent}%)`}
                  value={`₹ ${Math.round(totalGst * n(item.onPossessionPercent) / 100).toLocaleString("en-IN")}`}
                  theme={theme}
                />
              )}
            </View>
          )}

          {/* Notes */}
          {notes.length > 0 && (
            <View style={styles.breakdownSection}>
              <SectionLabel icon="📝" title="Notes" theme={theme} />
              {notes.map((note, i) => (
                <View key={i} style={[styles.noteItem, { backgroundColor: theme.surfaceVariant, borderColor: theme.cardBorder }]}>
                  <Text style={[styles.noteText, { color: theme.text }]}>• {note}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProjectsScreen() {
  const { theme } = useTheme();
  const { data: projects = [], isLoading, refetch } = useGetProjectsQuery();
  const { data: profile } = useGetProfileQuery();
  const [createProject, { isLoading: isCreating }] = useCreateProjectMutation();
  const [updateProject, { isLoading: isUpdating }] = useUpdateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();

  const designation = profile?.designation ?? "";
  const canAddEdit = CAN_ADD_EDIT_DESIGNATIONS.has(designation);
  const canDelete = designation === "ADMIN";

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  const updateField = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((project: Project) => {
    setEditingId(project.id);
    setForm(projectToForm(project));
    setModalVisible(true);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Project name is required.");
      return;
    }

    const numOrNull = (v: string) => {
      const parsed = parseFloat(v);
      return isNaN(parsed) ? null : parsed;
    };

    const body: Record<string, unknown> = {
      name: form.name.trim(),
      clientName: form.clientName.trim() || null,
      product: form.product.trim() || null,
      sizeInSqft: numOrNull(form.sizeInSqft),
      floors: numOrNull(form.floors),
      basicSellPrice: numOrNull(form.basicSellPrice),
      discount: numOrNull(form.discount),
      viewPlc: numOrNull(form.viewPlc),
      cornerPlc: numOrNull(form.cornerPlc),
      floorPlc: numOrNull(form.floorPlc),
      edc: numOrNull(form.edc),
      idc: numOrNull(form.idc),
      ffc: numOrNull(form.ffc),
      otherAdditionalCharges: numOrNull(form.otherAdditionalCharges),
      leastRent: numOrNull(form.leastRent),
      otherPossessionCharges: numOrNull(form.otherPossessionCharges),
      gstPercent: numOrNull(form.gstPercent),
      paymentPlan: form.paymentPlan.trim() || null,
      powerBackupKva: numOrNull(form.powerBackupKva),
      powerBackupPrice: numOrNull(form.powerBackupPrice),
      onBookingPercent: numOrNull(form.onBookingPercent),
      within30DaysPercent: numOrNull(form.within30DaysPercent),
      onPossessionPercent: numOrNull(form.onPossessionPercent),
      note1: form.note1.trim() || null,
      note2: form.note2.trim() || null,
      note3: form.note3.trim() || null,
      note4: form.note4.trim() || null,
    };

    try {
      if (editingId) {
        await updateProject({ id: editingId, body }).unwrap();
      } else {
        await createProject(body).unwrap();
      }
      setModalVisible(false);
      setForm(INITIAL_FORM);
      setEditingId(null);
    } catch (err: any) {
      Alert.alert("Error", err?.data?.message ?? "Something went wrong.");
    }
  }, [form, editingId, createProject, updateProject]);

  const handleDelete = useCallback(
    (project: Project) => {
      if (!canDelete) return;
      Alert.alert(
        "Delete Project",
        `Delete "${project.name}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteProject(project.id).unwrap();
              } catch (err: any) {
                Alert.alert("Error", err?.data?.message ?? "Failed to delete project.");
              }
            },
          },
        ]
      );
    },
    [deleteProject, canDelete]
  );

  const handleGeneratePdf = useCallback(async (project: Project) => {
    setGeneratingPdf(project.id);
    try {
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
        // falls back to text if logo fails
      }

      const html = buildPricingHtml(project, logoBase64);
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: `${project.name} — Pricing`,
          UTI: "com.adobe.pdf",
        });
      } else {
        Alert.alert("PDF Generated", `File saved at: ${uri}`);
      }
    } catch {
      Alert.alert("Error", "Failed to generate PDF.");
    } finally {
      setGeneratingPdf(null);
    }
  }, []);

  // ── Form field renderers ──

  const renderNumericField = useCallback(
    (label: string, key: keyof FormState, placeholder: string) => (
      <View key={key}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
          value={form[key]}
          onChangeText={(v) => updateField(key, v.replace(/[^0-9.]/g, ""))}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          keyboardType="decimal-pad"
        />
      </View>
    ),
    [form, theme, updateField]
  );

  const renderTextField = useCallback(
    (label: string, key: keyof FormState, placeholder: string, multiline = false) => (
      <View key={key}>
        <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            multiline && { minHeight: 60, textAlignVertical: "top" },
          ]}
          value={form[key]}
          onChangeText={(v) => updateField(key, v)}
          placeholder={placeholder}
          placeholderTextColor={theme.placeholder}
          multiline={multiline}
        />
      </View>
    ),
    [form, theme, updateField]
  );

  // ── Card renderer ──

  const renderProjectCard = useCallback(
    ({ item }: { item: Project }) => (
      <ProjectCard
        item={item}
        canAddEdit={canAddEdit}
        canDelete={canDelete}
        theme={theme}
        generatingPdf={generatingPdf}
        onEdit={() => openEdit(item)}
        onDelete={() => handleDelete(item)}
        onPdf={() => handleGeneratePdf(item)}
      />
    ),
    [theme, canAddEdit, canDelete, generatingPdf, openEdit, handleDelete, handleGeneratePdf]
  );

  if (isLoading) return <LoadingScreen message="Loading projects..." />;

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Projects"
        rightAction={<TutorialButton videoUrl={TUTORIALS.project} />} />

      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={renderProjectCard}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title="No projects found"
            subtitle={canAddEdit ? 'Tap + to create a new project' : 'No projects have been added yet'}
          />
        }
        refreshing={isLoading}
        onRefresh={refetch}
      />

      {/* FAB — canAddEdit only */}
      {canAddEdit && (
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: theme.gold }]}
          onPress={openCreate}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={28} color={theme.textInverse} />
        </TouchableOpacity>
      )}

      {/* Create/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setModalVisible(false); setEditingId(null); }}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.divider, backgroundColor: theme.card }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {editingId ? "Edit Project" : "Create Project"}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setEditingId(null); }}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Basic Info */}
              <Text style={[styles.formSectionTitle, { color: theme.mauve }]}>Basic Information</Text>
              {renderTextField("Project Name *", "name", "Project name")}
              {renderTextField("Client Name", "clientName", "Client name")}
              {renderTextField("Product", "product", "e.g. 2BHK, Plot, Shop")}
              {renderNumericField("Size (sq.ft.)", "sizeInSqft", "e.g. 1200")}
              {renderNumericField("Floors", "floors", "e.g. 10")}

              {/* Pricing */}
              <Text style={[styles.formSectionTitle, { color: theme.mauve, marginTop: 20 }]}>Pricing (per sq.ft.)</Text>
              {renderNumericField("Basic Sell Price (BSP)", "basicSellPrice", "e.g. 5000")}
              {renderNumericField("Discount", "discount", "e.g. 100")}
              {renderNumericField("View PLC", "viewPlc", "e.g. 200")}
              {renderNumericField("Corner PLC", "cornerPlc", "e.g. 150")}
              {renderNumericField("Floor PLC", "floorPlc", "e.g. 100")}
              {renderNumericField("EDC", "edc", "e.g. 300")}
              {renderNumericField("IDC", "idc", "e.g. 200")}
              {renderNumericField("FFC", "ffc", "e.g. 50")}
              {renderNumericField("Other Additional Charges", "otherAdditionalCharges", "e.g. 100")}
              {renderNumericField("GST %", "gstPercent", "e.g. 5")}

              {/* Possession */}
              <Text style={[styles.formSectionTitle, { color: theme.mauve, marginTop: 20 }]}>Possession Charges</Text>
              {renderNumericField("Lease Rent (per sq.ft.)", "leastRent", "e.g. 20")}
              {renderNumericField("Other Possession Charges (per sq.ft.)", "otherPossessionCharges", "e.g. 50")}
              {renderNumericField("Power Backup (KVA)", "powerBackupKva", "e.g. 3")}
              {renderNumericField("Power Backup Price (per KVA)", "powerBackupPrice", "e.g. 50000")}

              {/* Payment Plan */}
              <Text style={[styles.formSectionTitle, { color: theme.mauve, marginTop: 20 }]}>Payment Plan</Text>
              {renderTextField("Payment Plan Description", "paymentPlan", "Payment plan details", true)}
              {renderNumericField("On Booking %", "onBookingPercent", "e.g. 10")}
              {renderNumericField("Within 30 Days %", "within30DaysPercent", "e.g. 40")}
              {renderNumericField("On Possession %", "onPossessionPercent", "e.g. 50")}

              {/* Notes */}
              <Text style={[styles.formSectionTitle, { color: theme.mauve, marginTop: 20 }]}>Notes</Text>
              {renderTextField("Note 1", "note1", "Additional note", true)}
              {renderTextField("Note 2", "note2", "Additional note", true)}
              {renderTextField("Note 3", "note3", "Additional note", true)}
              {renderTextField("Note 4", "note4", "Additional note", true)}

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: theme.gold, opacity: isCreating || isUpdating ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={isCreating || isUpdating}
              >
                {isCreating || isUpdating ? (
                  <ActivityIndicator size="small" color={theme.textInverse} />
                ) : (
                  <Text style={[styles.submitBtnText, { color: theme.textInverse }]}>
                    {editingId ? "Update Project" : "Create Project"}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 80, gap: 12 },

  // Card
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardStripe: { height: 3, backgroundColor: "#9B5E8A" },
  cardBody: { padding: 14 },
  cardHeaderRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  projectName: { fontSize: 17, fontWeight: "700", marginBottom: 3 },
  clientName: { fontSize: 12, marginTop: 1 },
  cardActionRow: { flexDirection: "row", gap: 6, marginLeft: 8, flexShrink: 0 },
  iconBtn: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: "600" },

  // Expand toggle
  expandBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 10, borderTopWidth: 1,
  },
  expandBtnText: { fontSize: 12, fontWeight: "700" },

  // Breakdown
  breakdown: { padding: 14, gap: 0, borderTopWidth: 1 },
  breakdownSection: { marginBottom: 14 },
  sectionLabel: {
    fontSize: 10, fontWeight: "800", letterSpacing: 0.6,
    marginBottom: 6, textTransform: "uppercase",
  },
  totalSection: {
    padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 14,
  },
  priceRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(0,0,0,0.06)",
  },
  priceLabel: { fontSize: 12 },
  priceValue: { fontSize: 12 },
  noteItem: {
    padding: 8, borderRadius: 8, borderWidth: 1, marginTop: 5,
  },
  noteText: { fontSize: 12, lineHeight: 18 },

  // FAB
  fab: {
    position: "absolute", bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    justifyContent: "center", alignItems: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  // Modal
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  formScroll: { flex: 1 },
  formContent: { padding: 20 },
  formSectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  submitBtn: { borderRadius: 12, paddingVertical: 15, alignItems: "center", marginTop: 24 },
  submitBtnText: { fontSize: 16, fontWeight: "700" },
});