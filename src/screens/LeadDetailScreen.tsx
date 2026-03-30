import React, { useState, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  StyleSheet, Linking, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRoute, useNavigation } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useTheme } from "../lib/theme";
import {
  useGetLeadDetailQuery, useAddQueryMutation, useAddRemarkMutation,
  useUpdateLeadMutation, useUpdateQueryMutation,
} from "../store/leads.api";
import { useGetScopeEmployeesQuery } from "../store/hierarchy.api";
import { useGetProjectsDropdownQuery } from "../store/projects.api";
import { useRenderTemplateMutation } from "../store/whatsapp.api";
import { StatusBadge } from "../components/common/StatusBadge";
import { LoadingScreen } from "../components/common/LoadingScreen";
import { EmptyState } from "../components/common/EmptyState";
import type { Lead, LeadQuery, LeadStatus, QueryRemark } from "../types";
import type { CreateQueryBody, UpdateQueryBody } from "../store/leads.api";
import type { RootStackParamList } from "../navigation/AppNavigator";

// ─── Constants (same as LeadsScreen / web) ───────────────────
const STATUS_TABS: LeadStatus[] = [
  "FRESH", "FOLLOW_UP", "VISIT_DONE", "MEETING_DONE", "RINGING",
  "CALL_BACK", "DEAL_DONE", "NOT_INTERESTED", "HOT_PROSPECT",
  "SUSPECT", "SWITCH_OFF", "WRONG_NUMBER",
];

const STATUS_LABELS: Record<string, string> = {
  FRESH: "Fresh", FOLLOW_UP: "Follow Up", VISIT_DONE: "Visit Done",
  MEETING_DONE: "Meeting Done", RINGING: "Ringing", CALL_BACK: "Call Back",
  DEAL_DONE: "Deal Done", NOT_INTERESTED: "Not Interested", HOT_PROSPECT: "Hot Prospect",
  SUSPECT: "Suspect", SWITCH_OFF: "Switch Off", WRONG_NUMBER: "Wrong Number",
};
const ADVANCED_STATUSES: LeadStatus[] = ["FOLLOW_UP", "DEAL_DONE", "MEETING_DONE", "VISIT_DONE"];
const SIMPLE_STATUSES: LeadStatus[] = ["RINGING", "CALL_BACK", "WRONG_NUMBER", "SWITCH_OFF"];

function isBlockedTransition(from: LeadStatus, to: LeadStatus): boolean {
  return ADVANCED_STATUSES.includes(from) && SIMPLE_STATUSES.includes(to);
}

const LEAD_TYPE_OPTIONS = [
  { label: "All", value: "ALL" }, { label: "Rent", value: "RENT" },
  { label: "Residential", value: "RESIDENTIAL" }, { label: "Commercial", value: "COMMERCIAL" },
];
const BHK_OPTIONS = [
  "1 BHK", "1.5 BHK", "2 BHK", "2.5 BHK", "3 BHK", "3.5 BHK",
  "4 BHK", "4.5 BHK", "5 BHK", "Penthouse", "Studio",
];
const FURNISHING_OPTIONS = [
  { label: "Raw Flat", value: "RAW_FLAT" },
  { label: "Semi Furnished", value: "SEMI_FURNISHED" },
  { label: "Fully Furnished", value: "FULLY_FURNISHED" },
];

// ─── Main Component ──────────────────────────────────────────
export const LeadDetailScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "LeadDetail">>();
  const navigation = useNavigation();
  const { leadId, highlightedQueryId: highlightedQueryIdParam } = route.params;

  const { data: lead, isLoading, isError, refetch } = useGetLeadDetailQuery(leadId);
  const [renderTemplate] = useRenderTemplateMutation();
  const [showQueryModal, setShowQueryModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleCall = useCallback((phone: string) => { Linking.openURL(`tel:${phone}`); }, []);

  const handleWhatsApp = useCallback(async (phone: string) => {
    try {
      const result = await renderTemplate({ leadId }).unwrap();
      if (result?.whatsappUrl) { Linking.openURL(result.whatsappUrl); return; }
    } catch { }
    Linking.openURL(`https://wa.me/${phone.replace(/[^0-9]/g, "")}`);
  }, [leadId, renderTemplate]);

  const handleEmail = useCallback((email: string) => { Linking.openURL(`mailto:${email}`); }, []);

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
    catch { return dateStr; }
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "-";
    try { return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
    catch { return dateStr; }
  };

  if (isLoading) return <LoadingScreen message="Loading lead details..." />;
  if (isError || !lead) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState icon="alert-circle-outline" title="Failed to load lead" subtitle="The lead may have been deleted or you may not have access" />
        <TouchableOpacity onPress={() => refetch()} style={[styles.retryBtn, { backgroundColor: theme.gold }]}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const assignedName = lead.assignedTo
    ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : "Unassigned";

  const queries = [...(lead.queries ?? [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // ── FIX: Highlight logic matching web ────────────────────
  // Web: each query card checks `q.id === highlightedQueryId` where
  // `highlightedQueryId` comes from `lead.highlightedQueryId` OR
  // `lead.latestQuery?.id`. Mobile was passing the same value but
  // the `QueryTimelineCard` was using `lead.highlightedQueryId`
  // which is undefined in many API responses.
  //
  // Correct approach: the "current tab query" is whichever query
  // matches the lead's current status (latestQuery). That's exactly
  // what the web does: it sets highlightedQueryId from
  // `lead.highlightedQueryId ?? lead.latestQuery?.id`.
  const highlightedQueryId: string | undefined =
    highlightedQueryIdParam
    ?? (lead as any).highlightedQueryId
    ?? queries[0]?.id;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Lead Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={styles.infoHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.gold }]}>
              <Text style={styles.avatarText}>{lead.name?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <View style={styles.infoHeaderText}>
              <Text style={[styles.infoName, { color: theme.text }]}>{lead.name}</Text>
              <Text style={[styles.infoPhone, { color: theme.textSecondary }]}>
                {lead.phone}{lead.phone2 ? ` / ${lead.phone2}` : ""}
              </Text>
            </View>
          </View>

          {lead.email && <InfoRow icon="mail-outline" label="Email" value={lead.email} theme={theme} />}
          {lead.source && <InfoRow icon="globe-outline" label="Source" value={lead.source} theme={theme} />}
          {lead.type && <InfoRow icon="pricetag-outline" label="Type" value={lead.type} theme={theme} />}
          {lead.project && <InfoRow icon="business-outline" label="Project" value={lead.project.name} theme={theme} />}
          <InfoRow icon="person-outline" label="Assigned To" value={assignedName} theme={theme} />
          <InfoRow icon="calendar-outline" label="Created" value={formatDate(lead.createdAt)} theme={theme} />
          {lead.address && <InfoRow icon="location-outline" label="Address" value={lead.address} theme={theme} />}
          {/* Birthday / Anniversary chips */}
          {((lead as any).clientBirthday || (lead as any).clientMarriageAnniversary) && (
            <View style={{
              flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10,
              paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider
            }}>
              {(lead as any).clientBirthday && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: "#E74C3C10", borderWidth: 1, borderColor: "#E74C3C30"
                }}>
                  <Text style={{ fontSize: 12, color: "#E74C3C", fontWeight: "600" }}>
                    🎂 {new Date((lead as any).clientBirthday)
                      .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                </View>
              )}
              {(lead as any).clientMarriageAnniversary && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 4,
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: "#8E44AD10", borderWidth: 1, borderColor: "#8E44AD30"
                }}>
                  <Text style={{ fontSize: 12, color: "#8E44AD", fontWeight: "600" }}>
                    💍 {new Date((lead as any).clientMarriageAnniversary)
                      .toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={[styles.contactActions, { borderTopColor: theme.divider }]}>
            <TouchableOpacity onPress={() => handleCall(lead.phone)} style={[styles.contactBtn, { backgroundColor: theme.successLight }]}>
              <Ionicons name="call" size={18} color={theme.success} />
              <Text style={[styles.contactBtnText, { color: theme.success }]}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleWhatsApp(lead.phone)} style={[styles.contactBtn, { backgroundColor: isDark ? "#1A3D2A" : "#DCF8C6" }]}>
              <Ionicons name="logo-whatsapp" size={18} color={theme.whatsappGreen} />
              <Text style={[styles.contactBtnText, { color: theme.whatsappGreen }]}>WhatsApp</Text>
            </TouchableOpacity>
            {lead.email && (
              <TouchableOpacity onPress={() => handleEmail(lead.email!)} style={[styles.contactBtn, { backgroundColor: theme.infoLight }]}>
                <Ionicons name="mail" size={18} color={theme.info} />
                <Text style={[styles.contactBtnText, { color: theme.info }]}>Email</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.editLeadRow, { borderTopColor: theme.divider }]}>
            <TouchableOpacity onPress={() => setShowEditModal(true)} style={[styles.editLeadBtn, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
              <Ionicons name="create-outline" size={16} color={theme.gold} />
              <Text style={[styles.editLeadBtnText, { color: theme.gold }]}>Edit Lead</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Timeline Header */}
        <View style={styles.timelineHeader}>
          <Text style={[styles.timelineTitle, { color: theme.text }]}>Query Timeline</Text>
          <Text style={[styles.timelineCount, { color: theme.textSecondary }]}>
            {queries.length} {queries.length === 1 ? "query" : "queries"}
          </Text>
        </View>

        {/* Timeline */}
        {queries.length === 0 ? (
          <View style={[styles.infoCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <EmptyState icon="chatbox-outline" title="No queries yet" subtitle="Tap the + button below to add a query" />
          </View>
        ) : (
          queries.map((query, index) => (
            <QueryTimelineCard
              key={query.id}
              query={query}
              leadId={leadId}
              isFirst={index === 0}
              isLast={index === queries.length - 1}
              formatDate={formatDate}
              formatDateTime={formatDateTime}
              // Pass the computed highlightedQueryId — a query IS highlighted
              // when its id matches this value (same logic as web).
              highlightedQueryId={highlightedQueryId}
            />
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <TouchableOpacity onPress={() => setShowQueryModal(true)} style={[styles.fab, { backgroundColor: theme.gold }]}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <QueryModal visible={showQueryModal} leadId={leadId} onClose={() => setShowQueryModal(false)} />
      <EditLeadModal visible={showEditModal} leadId={leadId} lead={lead} onClose={() => setShowEditModal(false)} />
    </View>
  );
};

// ─── Info Row ─────────────────────────────────────────────────
interface InfoRowProps { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; theme: any; }
const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, theme }) => (
  <View style={styles.infoRow}>
    <Ionicons name={icon} size={16} color={theme.textTertiary} style={styles.infoRowIcon} />
    <Text style={[styles.infoRowLabel, { color: theme.textTertiary }]}>{label}</Text>
    <Text style={[styles.infoRowValue, { color: theme.text }]} numberOfLines={2}>{value}</Text>
  </View>
);

// ─── Query Timeline Card ───────────────────────────────────────
interface QueryTimelineCardProps {
  query: LeadQuery; leadId: string; isFirst: boolean; isLast: boolean;
  formatDate: (d: string | null | undefined) => string;
  formatDateTime: (d: string | null | undefined) => string;
  highlightedQueryId?: string;
}

const QueryTimelineCard: React.FC<QueryTimelineCardProps> = ({
  query, leadId, isFirst, isLast, formatDate, formatDateTime, highlightedQueryId,
}) => {
  const { theme, isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showAddRemark, setShowAddRemark] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [remarkFollowUpDate, setRemarkFollowUpDate] = useState("");
  const [addRemark, { isLoading: remarkLoading }] = useAddRemarkMutation();
  const [updateQuery, { isLoading: updateQueryLoading }] = useUpdateQueryMutation();
  const [showEditQueryModal, setShowEditQueryModal] = useState(false);
  const [showQuickUpdate, setShowQuickUpdate] = useState(false);
  const [quickStatus, setQuickStatus] = useState<LeadStatus>(query.status);
  const [quickFollowUp, setQuickFollowUp] = useState(query.followUpDate ?? "");
  const [showQuickStatusPicker, setShowQuickStatusPicker] = useState(false);
  const [quickSaving, setQuickSaving] = useState(false);
  const [showRemarkFollowUpPicker, setShowRemarkFollowUpPicker] = useState(false);
  const [showQuickFollowUpPicker, setShowQuickFollowUpPicker] = useState(false);

  // ── FIX: Highlight check matches web exactly ──────────────
  // Web: `isHighlighted = q.id === highlightedQueryId`
  // The highlighted card is the "current tab query" — whichever
  // query's id matches `lead.highlightedQueryId ?? lead.latestQuery?.id`.
  // Previously mobile was computing this per-card from `isFirst` (wrong).
  const isHighlighted = highlightedQueryId === query.id;

  const createdByName = query.createdBy
    ? `${query.createdBy.firstName} ${query.createdBy.lastName}` : "System";

  const hasDetails = query.budgetMin || query.budgetMax || query.bhk || query.floor ||
    query.furnishingType || query.visitDate || query.meetingDate || query.dealDoneDate ||
    query.expVisitDate || query.shiftingDate || query.closingAmount || query.unitNo ||
    query.reason || query.leadType || query.location || query.purpose || query.size;

  const handleSubmitRemark = async () => {
    if (!remarkText.trim()) { Alert.alert("Validation", "Remark text is required"); return; }
    if (!remarkFollowUpDate.trim()) { Alert.alert("Validation", "Follow-up date is required"); return; }
    try {
      await addRemark({ leadId, queryId: query.id, body: { text: remarkText.trim() } }).unwrap();
      await updateQuery({ leadId, queryId: query.id, body: { followUpDate: remarkFollowUpDate.trim() } }).unwrap();
      setRemarkText(""); setRemarkFollowUpDate(""); setShowAddRemark(false);
    } catch { Alert.alert("Error", "Failed to save remark or update follow-up"); }
  };

  const handleQuickSave = async () => {
    setQuickSaving(true);
    try {
      const body: UpdateQueryBody = { status: quickStatus };
      if (quickFollowUp) body.followUpDate = quickFollowUp;
      await updateQuery({ leadId, queryId: query.id, body }).unwrap();
      Alert.alert("Success", "Query updated");
      setShowQuickUpdate(false);
    } catch { Alert.alert("Error", "Failed to update query"); }
    finally { setQuickSaving(false); }
  };

  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineLine}>
        <View style={[styles.timelineDot, {
          backgroundColor: isHighlighted ? "#DAA520" : isFirst ? theme.gold : theme.border,
          borderColor: isHighlighted ? "#DAA520" : isFirst ? theme.gold : theme.border,
        }]} />
        {!isLast && <View style={[styles.timelineConnector, { backgroundColor: theme.border }]} />}
      </View>

      <View style={[styles.queryCard, {
        backgroundColor: theme.card,
        borderColor: isHighlighted ? "#DAA520" : isFirst ? theme.gold : theme.cardBorder,
        borderWidth: isHighlighted ? 2 : isFirst ? 1.5 : 1,
      }]}>
        {/* Highlighted banner — identical to web "★ Current tab query" */}
        {isHighlighted && (
          <View style={styles.highlightBanner}>
            <Ionicons name="star" size={12} color="#DAA520" />
            <Text style={styles.highlightBannerText}>Current tab query</Text>
          </View>
        )}

        <View style={styles.queryHeader}>
          <StatusBadge status={query.status} small />
          <Text style={[styles.queryDate, { color: theme.textTertiary }]}>{formatDateTime(query.createdAt)}</Text>
        </View>

        {query.remark && (
          <Text style={[styles.queryRemark, { color: theme.text }]}>{query.remark}</Text>
        )}

        <View style={styles.queryMeta}>
          <Ionicons name="person-outline" size={12} color={theme.textTertiary} />
          <Text style={[styles.queryMetaText, { color: theme.textTertiary }]}>{createdByName}</Text>
        </View>

        {query.followUpDate && (
          <View style={styles.queryMeta}>
            <Ionicons name="calendar-outline" size={12} color={theme.warning} />
            <Text style={[styles.queryMetaText, { color: theme.warning }]}>
              Follow-up: {formatDate(query.followUpDate)}
            </Text>
          </View>
        )}

        {query.visitDoneBy && (
          <View style={styles.queryMeta}>
            <Ionicons name="walk-outline" size={12} color={theme.textTertiary} />
            <Text style={[styles.queryMetaText, { color: theme.textTertiary }]}>
              Visit by: {query.visitDoneBy.firstName} {query.visitDoneBy.lastName}
            </Text>
          </View>
        )}

        {query.meetingDoneBy && (
          <View style={styles.queryMeta}>
            <Ionicons name="people-outline" size={12} color={theme.textTertiary} />
            <Text style={[styles.queryMetaText, { color: theme.textTertiary }]}>
              Meeting by: {query.meetingDoneBy.firstName} {query.meetingDoneBy.lastName}
            </Text>
          </View>
        )}

        {hasDetails && (
          <>
            <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expandBtn}>
              <Text style={[styles.expandBtnText, { color: theme.gold }]}>{expanded ? "Hide Details" : "Show Details"}</Text>
              <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={theme.gold} />
            </TouchableOpacity>

            {expanded && (
              <View style={[styles.detailsGrid, { backgroundColor: theme.surfaceVariant }]}>
                {query.leadType && <DetailRow label="Lead Type" value={query.leadType} theme={theme} />}
                {query.bhk && <DetailRow label="BHK" value={query.bhk} theme={theme} />}
                {(query.budgetMin || query.budgetMax) && <DetailRow label="Budget" value={`${query.budgetMin ?? "–"} – ${query.budgetMax ?? "–"} ${query.budgetUnit ?? "Lac"}`} theme={theme} />}
                {query.floor && <DetailRow label="Floor" value={query.floor} theme={theme} />}
                {query.size && <DetailRow label="Size" value={`${query.size} sq ft`} theme={theme} />}
                {query.location && <DetailRow label="Location" value={query.location} theme={theme} />}
                {query.purpose && <DetailRow label="Purpose" value={query.purpose} theme={theme} />}
                {query.furnishingType && <DetailRow label="Furnishing" value={query.furnishingType.replace(/_/g, " ")} theme={theme} />}
                {query.visitDate && <DetailRow label="Visit Date" value={formatDate(query.visitDate)} theme={theme} />}
                {query.meetingDate && <DetailRow label="Meeting Date" value={formatDate(query.meetingDate)} theme={theme} />}
                {query.dealDoneDate && <DetailRow label="Deal Done" value={formatDate(query.dealDoneDate)} theme={theme} />}
                {query.expVisitDate && <DetailRow label="Exp. Visit" value={formatDate(query.expVisitDate)} theme={theme} />}
                {query.shiftingDate && <DetailRow label="Shifting" value={formatDate(query.shiftingDate)} theme={theme} />}
                {query.closingAmount != null && <DetailRow label="Closing" value={`₹${query.closingAmount.toLocaleString("en-IN")}`} theme={theme} />}
                {query.unitNo && <DetailRow label="Unit No" value={query.unitNo} theme={theme} />}
                {query.reason && <DetailRow label="Reason" value={query.reason} theme={theme} />}
              </View>
            )}
          </>
        )}

        {/* Remarks */}
        {query.remarks && query.remarks.length > 0 && (
          <View style={[styles.remarksSection, { borderTopColor: theme.divider }]}>
            <Text style={[styles.remarksSectionTitle, { color: theme.textSecondary }]}>Remarks ({query.remarks.length})</Text>
            {query.remarks.map((r) => (
              <View key={r.id} style={[styles.remarkItem, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.remarkItemText, { color: theme.text }]}>{r.text}</Text>
                <View style={styles.remarkItemMeta}>
                  <Text style={[styles.remarkItemMetaText, { color: theme.textTertiary }]}>
                    {r.createdBy.firstName} {r.createdBy.lastName}
                  </Text>
                  <Text style={[styles.remarkItemMetaText, { color: theme.textTertiary }]}>
                    {formatDateTime(r.createdAt)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add Remark form */}
        {showAddRemark ? (
          <View style={[styles.addRemarkContainer, { borderTopColor: theme.divider }]}>
            <TextInput
              value={remarkText} onChangeText={setRemarkText}
              placeholder="Add a remark..." placeholderTextColor={theme.placeholder} multiline
              style={[styles.addRemarkInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text }]}
            />
            <Text style={[styles.remarkFollowUpLabel, { color: theme.textTertiary, marginTop: 8 }]}>Follow-up Date *</Text>
            <TouchableOpacity
              onPress={() => setShowRemarkFollowUpPicker(true)}
              style={[styles.addRemarkInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, marginTop: 4, minHeight: 42, flexDirection: "row", alignItems: "center" }]}
            >
              <Text style={{ color: remarkFollowUpDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>
                {remarkFollowUpDate || "Select date"}
              </Text>
              <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
            {showRemarkFollowUpPicker && (
              <DateTimePicker
                value={remarkFollowUpDate ? new Date(remarkFollowUpDate) : new Date()}
                mode="date" display="default" minimumDate={new Date()}
                onChange={(_, d) => { setShowRemarkFollowUpPicker(false); if (d) setRemarkFollowUpDate(d.toISOString().split("T")[0]); }}
              />
            )}
            <View style={styles.addRemarkActions}>
              <TouchableOpacity onPress={() => { setShowAddRemark(false); setRemarkText(""); setRemarkFollowUpDate(""); }}>
                <Text style={[styles.addRemarkCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmitRemark}
                disabled={remarkLoading || updateQueryLoading || !remarkText.trim() || !remarkFollowUpDate.trim()}
                style={[styles.addRemarkSubmit, { backgroundColor: theme.gold, opacity: remarkLoading || updateQueryLoading || !remarkText.trim() || !remarkFollowUpDate.trim() ? 0.5 : 1 }]}
              >
                {remarkLoading || updateQueryLoading
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.addRemarkSubmitText}>Save Remark & Update Follow-up</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[styles.queryActionRow, { borderTopColor: theme.divider }]}>
            <TouchableOpacity onPress={() => setShowAddRemark(true)} style={styles.queryActionBtn}>
              <Ionicons name="chatbubble-outline" size={14} color={theme.gold} />
              <Text style={[styles.queryActionBtnText, { color: theme.gold }]}>Add Remark</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowEditQueryModal(true)} style={styles.queryActionBtn}>
              <Ionicons name="create-outline" size={14} color={theme.info} />
              <Text style={[styles.queryActionBtnText, { color: theme.info }]}>Edit Query</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setQuickStatus(query.status); setQuickFollowUp(query.followUpDate ?? ""); setShowQuickUpdate(!showQuickUpdate); }}
              style={styles.queryActionBtn}
            >
              <Ionicons name="flash-outline" size={14} color={theme.warning} />
              <Text style={[styles.queryActionBtnText, { color: theme.warning }]}>Quick Update</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Quick Update */}
        {showQuickUpdate && (
          <View style={[styles.quickUpdateContainer, { borderTopColor: theme.divider }]}>
            <PickerField
              label="Status"
              value={STATUS_LABELS[quickStatus] || quickStatus}
              placeholder="Select status"
              onPress={() => setShowQuickStatusPicker(true)}
            />
            <OptionPickerModal
              visible={showQuickStatusPicker} title="Select Status"
              options={STATUS_TABS.map((s) => ({ label: STATUS_LABELS[s], value: s }))}
              selected={quickStatus}
              onSelect={(v) => { setQuickStatus(v as LeadStatus); setShowQuickStatusPicker(false); }}
              onClose={() => setShowQuickStatusPicker(false)}
            />
            <View style={styles.formGroup}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Follow-up Date</Text>
              <TouchableOpacity
                onPress={() => setShowQuickFollowUpPicker(true)}
                style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
              >
                <Text style={{ color: quickFollowUp ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>
                  {quickFollowUp || "Select date"}
                </Text>
                <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
              </TouchableOpacity>
            </View>
            {showQuickFollowUpPicker && (
              <DateTimePicker
                value={quickFollowUp ? new Date(quickFollowUp) : new Date()}
                mode="date" display="default" minimumDate={new Date()}
                onChange={(_, d) => { setShowQuickFollowUpPicker(false); if (d) setQuickFollowUp(d.toISOString().split("T")[0]); }}
              />
            )}
            <View style={styles.quickUpdateActions}>
              <TouchableOpacity onPress={() => setShowQuickUpdate(false)}>
                <Text style={[styles.addRemarkCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleQuickSave} disabled={quickSaving}
                style={[styles.addRemarkSubmit, { backgroundColor: theme.gold, opacity: quickSaving ? 0.5 : 1 }]}
              >
                {quickSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.addRemarkSubmitText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <EditQueryModal
          visible={showEditQueryModal} leadId={leadId} query={query}
          onClose={() => setShowEditQueryModal(false)}
        />
      </View>
    </View>
  );
};

// ─── Detail Row ───────────────────────────────────────────────
interface DetailRowProps { label: string; value: string; theme: any; }
const DetailRow: React.FC<DetailRowProps> = ({ label, value, theme }) => (
  <View style={styles.detailRow}>
    <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>{label}</Text>
    <Text style={[styles.detailValue, { color: theme.text }]}>{value}</Text>
  </View>
);

// ─── Query Modal ──────────────────────────────────────────────
interface QueryModalProps { visible: boolean; leadId: string; onClose: () => void; }

const QueryModal: React.FC<QueryModalProps> = ({ visible, leadId, onClose }) => {
  const { theme } = useTheme();
  const [addQuery, { isLoading }] = useAddQueryMutation();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const { data: projects } = useGetProjectsDropdownQuery();

  const [status, setStatus] = useState<LeadStatus>("FOLLOW_UP");
  const [remark, setRemark] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [meetingDate, setMeetingDate] = useState("");
  const [dealDoneDate, setDealDoneDate] = useState("");
  const [expVisitDate, setExpVisitDate] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [unitNo, setUnitNo] = useState("");
  const [reason, setReason] = useState("");
  const [leadType, setLeadType] = useState("");
  const [bhk, setBhk] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [budgetUnit, setBudgetUnit] = useState("Lac");
  const [furnishingType, setFurnishingType] = useState("");
  const [projectId, setProjectId] = useState("");
  const [visitDoneById, setVisitDoneById] = useState("");
  const [meetingDoneById, setMeetingDoneById] = useState("");
  const [size, setSize] = useState("");
  const [floor, setFloor] = useState("");
  const [location, setLocation] = useState("");
  const [purpose, setPurpose] = useState("");
  const [shiftingDate, setShiftingDate] = useState("");
  const [confirmedStatus, setConfirmedStatus] = useState<LeadStatus>("FOLLOW_UP");

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showLeadTypePicker, setShowLeadTypePicker] = useState(false);
  const [showBhkPicker, setShowBhkPicker] = useState(false);
  const [showFurnishingPicker, setShowFurnishingPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showVisitByPicker, setShowVisitByPicker] = useState(false);
  const [showMeetingByPicker, setShowMeetingByPicker] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [showVisitDatePicker, setShowVisitDatePicker] = useState(false);
  const [showMeetingDatePicker, setShowMeetingDatePicker] = useState(false);
  const [showDealDoneDatePicker, setShowDealDoneDatePicker] = useState(false);
  const [showExpVisitDatePicker, setShowExpVisitDatePicker] = useState(false);
  const [showShiftingDatePicker, setShowShiftingDatePicker] = useState(false);

  const resetForm = () => {
    setStatus("FOLLOW_UP"); setRemark(""); setFollowUpDate(""); setVisitDate(""); setMeetingDate("");
    setDealDoneDate(""); setExpVisitDate(""); setClosingAmount(""); setUnitNo(""); setReason("");
    setLeadType(""); setBhk(""); setBudgetMin(""); setBudgetMax(""); setBudgetUnit("Lac");
    setFurnishingType(""); setProjectId(""); setVisitDoneById(""); setMeetingDoneById("");
    setSize(""); setFloor(""); setLocation(""); setPurpose(""); setShiftingDate("");
  };

  const handleSubmit = async () => {
    if (status === "FOLLOW_UP" && !followUpDate) { Alert.alert("Validation", "Follow-up date is required"); return; }
    if (status === "VISIT_DONE" && !visitDate) { Alert.alert("Validation", "Visit date is required"); return; }
    if (status === "MEETING_DONE" && !meetingDate) { Alert.alert("Validation", "Meeting date is required"); return; }
    try {
      const body: CreateQueryBody = {
        status,
        projectName: ""
      };
      if (remark) body.remark = remark;
      if (followUpDate) body.followUpDate = followUpDate;
      if (visitDate) body.visitDate = visitDate;
      if (meetingDate) body.meetingDate = meetingDate;
      if (dealDoneDate) body.dealDoneDate = dealDoneDate;
      if (expVisitDate) body.expVisitDate = expVisitDate;
      if (closingAmount) body.closingAmount = parseFloat(closingAmount);
      if (unitNo) body.unitNo = unitNo;
      if (reason) body.reason = reason;
      if (leadType) body.leadType = leadType;
      if (bhk) body.bhk = bhk;
      if (budgetMin) body.budgetMin = parseFloat(budgetMin);
      if (budgetMax) body.budgetMax = parseFloat(budgetMax);
      if (budgetUnit) body.budgetUnit = budgetUnit;
      if (furnishingType) body.furnishingType = furnishingType;
      if (projectId) body.projectId = projectId;
      if (visitDoneById) body.visitDoneById = visitDoneById;
      if (meetingDoneById) body.meetingDoneById = meetingDoneById;
      if (size) body.size = parseFloat(size);
      if (floor) body.floor = floor;
      if (location) body.location = location;
      if (purpose) body.purpose = purpose;
      if (shiftingDate) body.shiftingDate = shiftingDate;
      await addQuery({ leadId, body }).unwrap();
      Alert.alert("Success", "Query added successfully");
      resetForm(); onClose();
    } catch (err: any) { Alert.alert("Error", err?.data?.message || "Failed to add query"); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Query</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <PickerField label="Status *" value={STATUS_LABELS[status] || status} placeholder="Select status" onPress={() => setShowStatusPicker(true)} />
              <OptionPickerModal
                visible={showStatusPicker} title="Select Status"
                options={STATUS_TABS.map((s) => ({ label: STATUS_LABELS[s], value: s }))}
                selected={status}
                onSelect={(v) => {
                  const next = v as LeadStatus;
                  setShowStatusPicker(false);
                  if (isBlockedTransition(confirmedStatus, next)) {
                    Alert.alert(
                      "Status Downgrade Warning",
                      `Moving from "${STATUS_LABELS[confirmedStatus]}" to "${STATUS_LABELS[next]}" is unusual. Are you sure?`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Yes, change it",
                          style: "destructive",
                          onPress: () => { setStatus(next); setConfirmedStatus(next); },
                        },
                      ]
                    );
                  } else {
                    setStatus(next);
                    setConfirmedStatus(next);
                  }
                }}
                onClose={() => setShowStatusPicker(false)}
              />
              <FormInput label="Remark" value={remark} onChangeText={setRemark} placeholder="Add remark..." multiline />

              {(status === "FOLLOW_UP" || status === "HOT_PROSPECT" || status === "CALL_BACK") && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{status === "FOLLOW_UP" ? "Follow-up Date *" : "Follow-up Date"}</Text>
                    <TouchableOpacity onPress={() => setShowFollowUpPicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: followUpDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{followUpDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showFollowUpPicker && <DateTimePicker value={followUpDate ? new Date(followUpDate) : new Date()} mode="date" display="default" minimumDate={new Date()} onChange={(_, d) => { setShowFollowUpPicker(false); if (d) setFollowUpDate(d.toISOString().split("T")[0]); }} />}
                </>
              )}
              {status === "VISIT_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Visit Date *</Text>
                    <TouchableOpacity onPress={() => setShowVisitDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: visitDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{visitDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showVisitDatePicker && <DateTimePicker value={visitDate ? new Date(visitDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowVisitDatePicker(false); if (d) setVisitDate(d.toISOString().split("T")[0]); }} />}
                  <PickerField label="Visit Done By" value={scopeEmployees?.find((e: any) => e.id === visitDoneById) ? `${scopeEmployees.find((e: any) => e.id === visitDoneById)!.firstName} ${scopeEmployees.find((e: any) => e.id === visitDoneById)!.lastName}` : ""} placeholder="Select staff" onPress={() => setShowVisitByPicker(true)} />
                  <OptionPickerModal visible={showVisitByPicker} title="Visit Done By" options={(scopeEmployees ?? []).map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))} selected={visitDoneById} onSelect={(v) => { setVisitDoneById(v); setShowVisitByPicker(false); }} onClose={() => setShowVisitByPicker(false)} />
                </>
              )}
              {status === "MEETING_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Meeting Date *</Text>
                    <TouchableOpacity onPress={() => setShowMeetingDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: meetingDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{meetingDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showMeetingDatePicker && <DateTimePicker value={meetingDate ? new Date(meetingDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowMeetingDatePicker(false); if (d) setMeetingDate(d.toISOString().split("T")[0]); }} />}
                  <PickerField label="Meeting Done By" value={scopeEmployees?.find((e: any) => e.id === meetingDoneById) ? `${scopeEmployees.find((e: any) => e.id === meetingDoneById)!.firstName} ${scopeEmployees.find((e: any) => e.id === meetingDoneById)!.lastName}` : ""} placeholder="Select staff" onPress={() => setShowMeetingByPicker(true)} />
                  <OptionPickerModal visible={showMeetingByPicker} title="Meeting Done By" options={(scopeEmployees ?? []).map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))} selected={meetingDoneById} onSelect={(v) => { setMeetingDoneById(v); setShowMeetingByPicker(false); }} onClose={() => setShowMeetingByPicker(false)} />
                </>
              )}
              {status === "DEAL_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Deal Done Date</Text>
                    <TouchableOpacity onPress={() => setShowDealDoneDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: dealDoneDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{dealDoneDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showDealDoneDatePicker && <DateTimePicker value={dealDoneDate ? new Date(dealDoneDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowDealDoneDatePicker(false); if (d) setDealDoneDate(d.toISOString().split("T")[0]); }} />}
                  <FormInput label="Closing Amount" value={closingAmount} onChangeText={setClosingAmount} placeholder="Amount" keyboardType="numeric" />
                  <FormInput label="Unit No" value={unitNo} onChangeText={setUnitNo} placeholder="Unit number" />
                </>
              )}
              {status === "NOT_INTERESTED" && (
                <FormInput label="Reason" value={reason} onChangeText={setReason} placeholder="Reason for not interested" multiline />
              )}
              {(status === "FOLLOW_UP" || status === "HOT_PROSPECT" || status === "CALL_BACK" || status === "RINGING") && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Expected Visit Date</Text>
                    <TouchableOpacity onPress={() => setShowExpVisitDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: expVisitDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{expVisitDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showExpVisitDatePicker && <DateTimePicker value={expVisitDate ? new Date(expVisitDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowExpVisitDatePicker(false); if (d) setExpVisitDate(d.toISOString().split("T")[0]); }} />}
                </>
              )}

              <View style={styles.sectionDivider}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Lead Details</Text>
              </View>

              <PickerField label="Lead Type" value={LEAD_TYPE_OPTIONS.find((o) => o.value === leadType)?.label ?? ""} placeholder="Select type" onPress={() => setShowLeadTypePicker(true)} />
              <OptionPickerModal visible={showLeadTypePicker} title="Lead Type" options={LEAD_TYPE_OPTIONS} selected={leadType} onSelect={(v) => { setLeadType(v); setShowLeadTypePicker(false); }} onClose={() => setShowLeadTypePicker(false)} />

              <PickerField label="BHK" value={bhk} placeholder="Select BHK" onPress={() => setShowBhkPicker(true)} />
              <OptionPickerModal visible={showBhkPicker} title="Select BHK" options={BHK_OPTIONS.map((b) => ({ label: b, value: b }))} selected={bhk} onSelect={(v) => { setBhk(v); setShowBhkPicker(false); }} onClose={() => setShowBhkPicker(false)} />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Budget</Text>
              <View style={styles.budgetRow}>
                <View style={{ flex: 1 }}><FormInput value={budgetMin} onChangeText={setBudgetMin} placeholder="Min" keyboardType="numeric" /></View>
                <Text style={[styles.budgetDash, { color: theme.textTertiary }]}>-</Text>
                <View style={{ flex: 1 }}><FormInput value={budgetMax} onChangeText={setBudgetMax} placeholder="Max" keyboardType="numeric" /></View>
                <TouchableOpacity onPress={() => setBudgetUnit((u) => u === "Lac" ? "Cr" : "Lac")} style={[styles.unitToggle, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
                  <Text style={[styles.unitToggleText, { color: theme.gold }]}>{budgetUnit}</Text>
                </TouchableOpacity>
              </View>

              <PickerField label="Furnishing" value={FURNISHING_OPTIONS.find((o) => o.value === furnishingType)?.label ?? ""} placeholder="Select furnishing" onPress={() => setShowFurnishingPicker(true)} />
              <OptionPickerModal visible={showFurnishingPicker} title="Furnishing Type" options={FURNISHING_OPTIONS} selected={furnishingType} onSelect={(v) => { setFurnishingType(v); setShowFurnishingPicker(false); }} onClose={() => setShowFurnishingPicker(false)} />

              <PickerField label="Project" value={projects?.find((p: any) => p.id === projectId)?.name ?? ""} placeholder="Select project" onPress={() => setShowProjectPicker(true)} />
              <OptionPickerModal visible={showProjectPicker} title="Select Project" options={(projects ?? []).map((p: any) => ({ label: p.name, value: p.id }))} selected={projectId} onSelect={(v) => { setProjectId(v); setShowProjectPicker(false); }} onClose={() => setShowProjectPicker(false)} />

              <FormInput label="Size (sq ft)" value={size} onChangeText={setSize} placeholder="e.g. 1200" keyboardType="numeric" />
              <FormInput label="Floor" value={floor} onChangeText={setFloor} placeholder="e.g. 3rd Floor" />
              <FormInput label="Location" value={location} onChangeText={setLocation} placeholder="Enter location" />
              <FormInput label="Purpose" value={purpose} onChangeText={setPurpose} placeholder="Enter purpose" />

              {leadType === "RENT" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Shifting Date</Text>
                    <TouchableOpacity onPress={() => setShowShiftingDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: shiftingDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{shiftingDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showShiftingDatePicker && <DateTimePicker value={shiftingDate ? new Date(shiftingDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowShiftingDatePicker(false); if (d) setShiftingDate(d.toISOString().split("T")[0]); }} />}
                </>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Submit</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Reusable form components ─────────────────────────────────
interface FormInputProps {
  label?: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: "default" | "phone-pad" | "email-address" | "numeric"; multiline?: boolean;
}
const FormInput: React.FC<FormInputProps> = ({ label, value, onChangeText, placeholder, keyboardType = "default", multiline = false }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.formGroup}>
      {label && <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>}
      <TextInput
        value={value} onChangeText={onChangeText} placeholder={placeholder}
        placeholderTextColor={theme.placeholder} keyboardType={keyboardType} multiline={multiline}
        style={[styles.textInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text, minHeight: multiline ? 72 : 42, textAlignVertical: multiline ? "top" : "center" }]}
      />
    </View>
  );
};

interface PickerFieldProps { label?: string; value: string; placeholder: string; onPress: () => void; }
const PickerField: React.FC<PickerFieldProps> = ({ label, value, placeholder, onPress }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.formGroup}>
      {label && <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{label}</Text>}
      <TouchableOpacity onPress={onPress} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
        <Text style={{ color: value ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }} numberOfLines={1}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
      </TouchableOpacity>
    </View>
  );
};

interface OptionPickerModalProps {
  visible: boolean; title: string; options: Array<{ label: string; value: string }>;
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
            data={options} keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const isActive = item.value === selected;
              return (
                <TouchableOpacity onPress={() => onSelect(item.value)} style={[styles.dropdownItem, { backgroundColor: isActive ? theme.goldLight : "transparent" }]}>
                  <Text style={{ color: isActive ? theme.gold : theme.text, fontWeight: isActive ? "700" : "400", fontSize: 15, flex: 1 }}>{item.label}</Text>
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

// ─── Edit Lead Modal ──────────────────────────────────────────
interface EditLeadModalProps { visible: boolean; leadId: string; lead: Lead; onClose: () => void; }
const EditLeadModal: React.FC<EditLeadModalProps> = ({ visible, leadId, lead, onClose }) => {
  const { theme } = useTheme();
  const [updateLead, { isLoading }] = useUpdateLeadMutation();
  const [name, setName] = useState(lead.name ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [address, setAddress] = useState(lead.address ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [clientBirthday, setClientBirthday] = useState(
    (lead as any).clientBirthday
      ? new Date((lead as any).clientBirthday).toISOString().split("T")[0]
      : ""
  );
  const [clientMarriageAnniversary, setClientMarriageAnniversary] = useState(
    (lead as any).clientMarriageAnniversary
      ? new Date((lead as any).clientMarriageAnniversary).toISOString().split("T")[0]
      : ""
  );
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [showAnniversaryPicker, setShowAnniversaryPicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setName(lead.name ?? ""); setPhone(lead.phone ?? ""); setEmail(lead.email ?? ""); setAddress(lead.address ?? ""); setSource(lead.source ?? ""); setClientBirthday(
        (lead as any).clientBirthday
          ? new Date((lead as any).clientBirthday).toISOString().split("T")[0]
          : ""
      );
      setClientMarriageAnniversary(
        (lead as any).clientMarriageAnniversary
          ? new Date((lead as any).clientMarriageAnniversary).toISOString().split("T")[0]
          : ""
      );
    }
  }, [visible, lead]);

  const handleSubmit = async () => {
    if (!name.trim()) { Alert.alert("Validation", "Name is required"); return; }
    if (!phone.trim()) { Alert.alert("Validation", "Phone is required"); return; }
    try {
      const body: any = { name: name.trim(), phone: phone.trim() };
      if (email.trim()) body.email = email.trim();
      if (address.trim()) body.address = address.trim();
      if (source.trim()) body.source = source.trim();
      if (clientBirthday) body.clientBirthday = clientBirthday;
      else body.clientBirthday = null;          // allow clearing
      if (clientMarriageAnniversary) body.clientMarriageAnniversary = clientMarriageAnniversary;
      else body.clientMarriageAnniversary = null;
      await updateLead({ id: leadId, body }).unwrap();
      Alert.alert("Success", "Lead updated successfully");
      onClose();
    } catch (err: any) { Alert.alert("Error", err?.data?.message || "Failed to update lead"); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Lead</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <FormInput label="Name *" value={name} onChangeText={setName} placeholder="Lead name" />
              <FormInput label="Phone *" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
              <FormInput label="Email" value={email} onChangeText={setEmail} placeholder="Email address" keyboardType="email-address" />
              <FormInput label="Address" value={address} onChangeText={setAddress} placeholder="Address" multiline />
              <FormInput label="Source" value={source} onChangeText={setSource} placeholder="e.g. 99acres, MagicBricks, Walk-in" />
              {/* ── Client Special Days ── */}
              <View style={[styles.specialDaysBox, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}>
                <Text style={[styles.specialDaysTitle, { color: theme.textSecondary }]}>
                  🎉 Client Special Days
                </Text>
                <Text style={[styles.specialDaysHint, { color: theme.textTertiary }]}>
                  Clear to remove reminders.
                </Text>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  {/* Birthday */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>🎂 Birthday</Text>
                    <TouchableOpacity
                      onPress={() => setShowBirthdayPicker(true)}
                      style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                    >
                      <Text style={{ color: clientBirthday ? theme.text : theme.placeholder, flex: 1, fontSize: 13 }}>
                        {clientBirthday || "Select date"}
                      </Text>
                      {clientBirthday ? (
                        <TouchableOpacity onPress={() => setClientBirthday("")}>
                          <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="calendar-outline" size={15} color={theme.textTertiary} />
                      )}
                    </TouchableOpacity>
                    {showBirthdayPicker && (
                      <DateTimePicker
                        value={clientBirthday ? new Date(clientBirthday) : new Date()}
                        mode="date" display="default"
                        onChange={(_, d) => {
                          setShowBirthdayPicker(false);
                          if (d) setClientBirthday(d.toISOString().split("T")[0]);
                        }}
                      />
                    )}
                  </View>

                  {/* Anniversary */}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>💍 Anniversary</Text>
                    <TouchableOpacity
                      onPress={() => setShowAnniversaryPicker(true)}
                      style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
                    >
                      <Text style={{ color: clientMarriageAnniversary ? theme.text : theme.placeholder, flex: 1, fontSize: 13 }}>
                        {clientMarriageAnniversary || "Select date"}
                      </Text>
                      {clientMarriageAnniversary ? (
                        <TouchableOpacity onPress={() => setClientMarriageAnniversary("")}>
                          <Ionicons name="close-circle" size={16} color={theme.textTertiary} />
                        </TouchableOpacity>
                      ) : (
                        <Ionicons name="calendar-outline" size={15} color={theme.textTertiary} />
                      )}
                    </TouchableOpacity>
                    {showAnniversaryPicker && (
                      <DateTimePicker
                        value={clientMarriageAnniversary ? new Date(clientMarriageAnniversary) : new Date()}
                        mode="date" display="default"
                        onChange={(_, d) => {
                          setShowAnniversaryPicker(false);
                          if (d) setClientMarriageAnniversary(d.toISOString().split("T")[0]);
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Edit Query Modal ─────────────────────────────────────────
interface EditQueryModalProps { visible: boolean; leadId: string; query: LeadQuery; onClose: () => void; }
const EditQueryModal: React.FC<EditQueryModalProps> = ({ visible, leadId, query, onClose }) => {
  const { theme } = useTheme();
  const [updateQueryMut, { isLoading }] = useUpdateQueryMutation();
  const { data: scopeEmployees } = useGetScopeEmployeesQuery();
  const { data: projects } = useGetProjectsDropdownQuery();

  const [status, setStatus] = useState<LeadStatus>(query.status);
  const [remark, setRemark] = useState(query.remark ?? "");
  const [followUpDate, setFollowUpDate] = useState(query.followUpDate ?? "");
  const [visitDate, setVisitDate] = useState(query.visitDate ?? "");
  const [meetingDate, setMeetingDate] = useState(query.meetingDate ?? "");
  const [dealDoneDate, setDealDoneDate] = useState(query.dealDoneDate ?? "");
  const [expVisitDate, setExpVisitDate] = useState(query.expVisitDate ?? "");
  const [closingAmount, setClosingAmount] = useState(query.closingAmount != null ? String(query.closingAmount) : "");
  const [unitNo, setUnitNo] = useState(query.unitNo ?? "");
  const [reason, setReason] = useState(query.reason ?? "");
  const [leadType, setLeadType] = useState(query.leadType ?? "");
  const [bhk, setBhk] = useState(query.bhk ?? "");
  const [budgetMin, setBudgetMin] = useState(query.budgetMin != null ? String(query.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(query.budgetMax != null ? String(query.budgetMax) : "");
  const [budgetUnit, setBudgetUnit] = useState(query.budgetUnit ?? "Lac");
  const [furnishingType, setFurnishingType] = useState(query.furnishingType ?? "");
  const [projectId, setProjectId] = useState(query.projectId ?? "");
  const [visitDoneById, setVisitDoneById] = useState(query.visitDoneBy?.id ?? "");
  const [meetingDoneById, setMeetingDoneById] = useState(query.meetingDoneBy?.id ?? "");

  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showLeadTypePicker, setShowLeadTypePicker] = useState(false);
  const [showBhkPicker, setShowBhkPicker] = useState(false);
  const [showFurnishingPicker, setShowFurnishingPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showVisitByPicker, setShowVisitByPicker] = useState(false);
  const [showMeetingByPicker, setShowMeetingByPicker] = useState(false);
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);
  const [showVisitDatePicker, setShowVisitDatePicker] = useState(false);
  const [showMeetingDatePicker, setShowMeetingDatePicker] = useState(false);
  const [showDealDoneDatePicker, setShowDealDoneDatePicker] = useState(false);
  const [showExpVisitDatePicker, setShowExpVisitDatePicker] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setStatus(query.status); setRemark(query.remark ?? ""); setFollowUpDate(query.followUpDate ?? "");
      setVisitDate(query.visitDate ?? ""); setMeetingDate(query.meetingDate ?? "");
      setDealDoneDate(query.dealDoneDate ?? ""); setExpVisitDate(query.expVisitDate ?? "");
      setClosingAmount(query.closingAmount != null ? String(query.closingAmount) : "");
      setUnitNo(query.unitNo ?? ""); setReason(query.reason ?? ""); setLeadType(query.leadType ?? "");
      setBhk(query.bhk ?? ""); setBudgetMin(query.budgetMin != null ? String(query.budgetMin) : "");
      setBudgetMax(query.budgetMax != null ? String(query.budgetMax) : "");
      setBudgetUnit(query.budgetUnit ?? "Lac"); setFurnishingType(query.furnishingType ?? "");
      setProjectId(query.projectId ?? ""); setVisitDoneById(query.visitDoneBy?.id ?? "");
      setMeetingDoneById(query.meetingDoneBy?.id ?? "");
    }
  }, [visible, query]);

  const handleSubmit = async () => {
    try {
      const body: UpdateQueryBody = { status };
      if (remark) body.remark = remark;
      if (followUpDate) body.followUpDate = followUpDate;
      if (visitDate) body.visitDate = visitDate;
      if (meetingDate) body.meetingDate = meetingDate;
      if (dealDoneDate) body.dealDoneDate = dealDoneDate;
      if (expVisitDate) body.expVisitDate = expVisitDate;
      if (closingAmount) body.closingAmount = parseFloat(closingAmount);
      if (unitNo) body.unitNo = unitNo;
      if (reason) body.reason = reason;
      if (leadType) body.leadType = leadType;
      if (bhk) body.bhk = bhk;
      if (budgetMin) body.budgetMin = parseFloat(budgetMin);
      if (budgetMax) body.budgetMax = parseFloat(budgetMax);
      if (budgetUnit) body.budgetUnit = budgetUnit;
      if (furnishingType) body.furnishingType = furnishingType;
      if (projectId) body.projectId = projectId;
      if (visitDoneById) body.visitDoneById = visitDoneById;
      if (meetingDoneById) body.meetingDoneById = meetingDoneById;
      await updateQueryMut({ leadId, queryId: query.id, body }).unwrap();
      Alert.alert("Success", "Query updated successfully");
      onClose();
    } catch (err: any) { Alert.alert("Error", err?.data?.message || "Failed to update query"); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Query</Text>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={theme.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <PickerField label="Status *" value={STATUS_LABELS[status] || status} placeholder="Select status" onPress={() => setShowStatusPicker(true)} />
              <OptionPickerModal visible={showStatusPicker} title="Select Status" options={STATUS_TABS.map((s) => ({ label: STATUS_LABELS[s], value: s }))} selected={status} onSelect={(v) => { setStatus(v as LeadStatus); setShowStatusPicker(false); }} onClose={() => setShowStatusPicker(false)} />
              <FormInput label="Remark" value={remark} onChangeText={setRemark} placeholder="Add remark..." multiline />
              {(status === "FOLLOW_UP" || status === "HOT_PROSPECT" || status === "CALL_BACK") && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>{status === "FOLLOW_UP" ? "Follow-up Date *" : "Follow-up Date"}</Text>
                    <TouchableOpacity onPress={() => setShowFollowUpPicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: followUpDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{followUpDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showFollowUpPicker && <DateTimePicker value={followUpDate ? new Date(followUpDate) : new Date()} mode="date" display="default" minimumDate={new Date()} onChange={(_, d) => { setShowFollowUpPicker(false); if (d) setFollowUpDate(d.toISOString().split("T")[0]); }} />}
                </>
              )}
              {status === "VISIT_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Visit Date *</Text>
                    <TouchableOpacity onPress={() => setShowVisitDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: visitDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{visitDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showVisitDatePicker && <DateTimePicker value={visitDate ? new Date(visitDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowVisitDatePicker(false); if (d) setVisitDate(d.toISOString().split("T")[0]); }} />}
                  <PickerField label="Visit Done By" value={scopeEmployees?.find((e: any) => e.id === visitDoneById) ? `${scopeEmployees.find((e: any) => e.id === visitDoneById)!.firstName} ${scopeEmployees.find((e: any) => e.id === visitDoneById)!.lastName}` : ""} placeholder="Select staff" onPress={() => setShowVisitByPicker(true)} />
                  <OptionPickerModal visible={showVisitByPicker} title="Visit Done By" options={(scopeEmployees ?? []).map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))} selected={visitDoneById} onSelect={(v) => { setVisitDoneById(v); setShowVisitByPicker(false); }} onClose={() => setShowVisitByPicker(false)} />
                </>
              )}
              {status === "MEETING_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Meeting Date *</Text>
                    <TouchableOpacity onPress={() => setShowMeetingDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: meetingDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{meetingDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showMeetingDatePicker && <DateTimePicker value={meetingDate ? new Date(meetingDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowMeetingDatePicker(false); if (d) setMeetingDate(d.toISOString().split("T")[0]); }} />}
                  <PickerField label="Meeting Done By" value={scopeEmployees?.find((e: any) => e.id === meetingDoneById) ? `${scopeEmployees.find((e: any) => e.id === meetingDoneById)!.firstName} ${scopeEmployees.find((e: any) => e.id === meetingDoneById)!.lastName}` : ""} placeholder="Select staff" onPress={() => setShowMeetingByPicker(true)} />
                  <OptionPickerModal visible={showMeetingByPicker} title="Meeting Done By" options={(scopeEmployees ?? []).map((e: any) => ({ label: `${e.firstName} ${e.lastName}`, value: e.id }))} selected={meetingDoneById} onSelect={(v) => { setMeetingDoneById(v); setShowMeetingByPicker(false); }} onClose={() => setShowMeetingByPicker(false)} />
                </>
              )}
              {status === "DEAL_DONE" && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Deal Done Date</Text>
                    <TouchableOpacity onPress={() => setShowDealDoneDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: dealDoneDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{dealDoneDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showDealDoneDatePicker && <DateTimePicker value={dealDoneDate ? new Date(dealDoneDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowDealDoneDatePicker(false); if (d) setDealDoneDate(d.toISOString().split("T")[0]); }} />}
                  <FormInput label="Closing Amount" value={closingAmount} onChangeText={setClosingAmount} placeholder="Amount" keyboardType="numeric" />
                  <FormInput label="Unit No" value={unitNo} onChangeText={setUnitNo} placeholder="Unit number" />
                </>
              )}
              {status === "NOT_INTERESTED" && (
                <FormInput label="Reason" value={reason} onChangeText={setReason} placeholder="Reason for not interested" multiline />
              )}
              {(status === "FOLLOW_UP" || status === "HOT_PROSPECT" || status === "CALL_BACK" || status === "RINGING") && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Expected Visit Date</Text>
                    <TouchableOpacity onPress={() => setShowExpVisitDatePicker(true)} style={[styles.pickerBtn, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}>
                      <Text style={{ color: expVisitDate ? theme.text : theme.placeholder, flex: 1, fontSize: 14 }}>{expVisitDate || "Select date"}</Text>
                      <Ionicons name="calendar-outline" size={16} color={theme.textTertiary} />
                    </TouchableOpacity>
                  </View>
                  {showExpVisitDatePicker && <DateTimePicker value={expVisitDate ? new Date(expVisitDate) : new Date()} mode="date" display="default" onChange={(_, d) => { setShowExpVisitDatePicker(false); if (d) setExpVisitDate(d.toISOString().split("T")[0]); }} />}
                </>
              )}
              <View style={styles.sectionDivider}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Lead Details</Text>
              </View>
              <PickerField label="Lead Type" value={LEAD_TYPE_OPTIONS.find((o) => o.value === leadType)?.label ?? ""} placeholder="Select type" onPress={() => setShowLeadTypePicker(true)} />
              <OptionPickerModal visible={showLeadTypePicker} title="Lead Type" options={LEAD_TYPE_OPTIONS} selected={leadType} onSelect={(v) => { setLeadType(v); setShowLeadTypePicker(false); }} onClose={() => setShowLeadTypePicker(false)} />
              <PickerField label="BHK" value={bhk} placeholder="Select BHK" onPress={() => setShowBhkPicker(true)} />
              <OptionPickerModal visible={showBhkPicker} title="Select BHK" options={BHK_OPTIONS.map((b) => ({ label: b, value: b }))} selected={bhk} onSelect={(v) => { setBhk(v); setShowBhkPicker(false); }} onClose={() => setShowBhkPicker(false)} />
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Budget</Text>
              <View style={styles.budgetRow}>
                <View style={{ flex: 1 }}><FormInput value={budgetMin} onChangeText={setBudgetMin} placeholder="Min" keyboardType="numeric" /></View>
                <Text style={[styles.budgetDash, { color: theme.textTertiary }]}>-</Text>
                <View style={{ flex: 1 }}><FormInput value={budgetMax} onChangeText={setBudgetMax} placeholder="Max" keyboardType="numeric" /></View>
                <TouchableOpacity onPress={() => setBudgetUnit((u) => u === "Lac" ? "Cr" : "Lac")} style={[styles.unitToggle, { backgroundColor: theme.goldLight, borderColor: theme.gold }]}>
                  <Text style={[styles.unitToggleText, { color: theme.gold }]}>{budgetUnit}</Text>
                </TouchableOpacity>
              </View>
              <PickerField label="Furnishing" value={FURNISHING_OPTIONS.find((o) => o.value === furnishingType)?.label ?? ""} placeholder="Select furnishing" onPress={() => setShowFurnishingPicker(true)} />
              <OptionPickerModal visible={showFurnishingPicker} title="Furnishing Type" options={FURNISHING_OPTIONS} selected={furnishingType} onSelect={(v) => { setFurnishingType(v); setShowFurnishingPicker(false); }} onClose={() => setShowFurnishingPicker(false)} />
              <PickerField label="Project" value={projects?.find((p: any) => p.id === projectId)?.name ?? ""} placeholder="Select project" onPress={() => setShowProjectPicker(true)} />
              <OptionPickerModal visible={showProjectPicker} title="Select Project" options={(projects ?? []).map((p: any) => ({ label: p.name, value: p.id }))} selected={projectId} onSelect={(v) => { setProjectId(v); setShowProjectPicker(false); }} onClose={() => setShowProjectPicker(false)} />
              <View style={{ height: 24 }} />
            </ScrollView>
            <View style={[styles.modalFooter, { borderTopColor: theme.divider }]}>
              <TouchableOpacity onPress={onClose} style={[styles.modalBtn, { backgroundColor: theme.surfaceVariant }]}>
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} disabled={isLoading} style={[styles.modalBtn, { backgroundColor: theme.gold, opacity: isLoading ? 0.6 : 1 }]}>
                {isLoading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 12 },
  retryBtn: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 16 },
  retryBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  infoCard: { borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 12 },
  infoHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFFFFF", fontSize: 20, fontWeight: "700" },
  infoHeaderText: { flex: 1 },
  infoName: { fontSize: 20, fontWeight: "700" },
  infoPhone: { fontSize: 14, marginTop: 2 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 6, gap: 8 },
  infoRowIcon: { marginTop: 2, width: 20 },
  infoRowLabel: { fontSize: 13, width: 80 },
  infoRowValue: { fontSize: 14, fontWeight: "500", flex: 1 },
  contactActions: { flexDirection: "row", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 10, gap: 6 },
  contactBtnText: { fontSize: 13, fontWeight: "600" },
  timelineHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, marginTop: 4, paddingHorizontal: 4 },
  timelineTitle: { fontSize: 18, fontWeight: "700" },
  timelineCount: { fontSize: 13 },
  timelineItem: { flexDirection: "row", marginBottom: 0 },
  timelineLine: { width: 28, alignItems: "center" },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 16 },
  timelineConnector: { width: 2, flex: 1, marginTop: 2 },
  queryCard: { flex: 1, borderRadius: 12, padding: 14, marginBottom: 10, marginLeft: 4 },
  queryHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  queryDate: { fontSize: 11 },
  queryRemark: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  queryMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  queryMetaText: { fontSize: 12 },
  expandBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingVertical: 4 },
  expandBtnText: { fontSize: 13, fontWeight: "600" },
  detailsGrid: { borderRadius: 8, padding: 12, marginTop: 8 },
  detailRow: { flexDirection: "row", paddingVertical: 4 },
  detailLabel: { fontSize: 12, width: 100 },
  detailValue: { fontSize: 13, fontWeight: "500", flex: 1 },
  remarksSection: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  remarksSectionTitle: { fontSize: 13, fontWeight: "700", marginBottom: 8 },
  remarkItem: { padding: 10, borderRadius: 8, marginBottom: 6 },
  remarkItemText: { fontSize: 13, lineHeight: 18 },
  remarkItemMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  remarkItemMetaText: { fontSize: 11 },
  addRemarkContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  addRemarkInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, minHeight: 60, textAlignVertical: "top" },
  addRemarkActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 8 },
  addRemarkCancel: { fontSize: 13, fontWeight: "500" },
  addRemarkSubmit: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6 },
  addRemarkSubmitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  fab: { position: "absolute", right: 16, bottom: 16, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14 },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalBody: { paddingHorizontal: 16 },
  modalFooter: { flexDirection: "row", padding: 16, gap: 12, borderTopWidth: 1 },
  modalBtn: { flex: 1, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
  formGroup: { marginBottom: 12 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  textInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, fontSize: 14 },
  pickerBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 42, flexDirection: "row", alignItems: "center" },
  dropdownItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, gap: 8 },
  dropdownItemText: { fontSize: 15, flex: 1 },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetDash: { fontSize: 16, fontWeight: "600" },
  unitToggle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  unitToggleText: { fontSize: 13, fontWeight: "700" },
  sectionDivider: { marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  editLeadRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, alignItems: "center" },
  editLeadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 9, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, gap: 6 },
  editLeadBtnText: { fontSize: 13, fontWeight: "600" },
  highlightBanner: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFF8DC", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginBottom: 8, alignSelf: "flex-start" },
  highlightBannerText: { fontSize: 11, fontWeight: "700", color: "#DAA520" },
  queryActionRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  queryActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4 },
  queryActionBtnText: { fontSize: 12, fontWeight: "600" },
  quickUpdateContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  quickUpdateActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 4, marginBottom: 4 },
  remarkFollowUpLabel: { fontSize: 11, marginTop: 2, marginBottom: 4 },
  specialDaysBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginBottom: 12 },
  specialDaysTitle: { fontSize: 13, fontWeight: "700" },
  specialDaysHint: { fontSize: 11, marginTop: 2 },
});