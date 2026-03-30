import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import {
  useGetPlaceholdersQuery,
  useGetMyTemplateQuery,
  useUpsertTemplateMutation,
  useDeleteTemplateMutation,
} from "../store/whatsapp.api";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

export const WhatsAppTemplateScreen: React.FC = () => {
  const { theme } = useTheme();
  const { data: placeholders, isLoading: loadingPlaceholders } = useGetPlaceholdersQuery();
  const { data: currentTemplate, isLoading: loadingTemplate, refetch } = useGetMyTemplateQuery();
  const [upsertTemplate, { isLoading: saving }] = useUpsertTemplateMutation();
  const [deleteTemplate, { isLoading: deleting }] = useDeleteTemplateMutation();

  const [templateText, setTemplateText] = useState("");
  const [selectionStart, setSelectionStart] = useState(0);

  useEffect(() => {
    if (currentTemplate?.templateText) {
      setTemplateText(currentTemplate.templateText);
    }
  }, [currentTemplate]);

  const insertPlaceholder = useCallback(
    (key: string) => {
      const placeholder = `{${key}}`;
      const before = templateText.slice(0, selectionStart);
      const after = templateText.slice(selectionStart);
      const newText = before + placeholder + after;
      setTemplateText(newText);
      setSelectionStart(selectionStart + placeholder.length);
    },
    [templateText, selectionStart]
  );

  const handleSave = useCallback(async () => {
    if (!templateText.trim()) {
      Alert.alert("Error", "Template text cannot be empty.");
      return;
    }
    try {
      await upsertTemplate({ templateText: templateText.trim() }).unwrap();
      Alert.alert("Success", "Template saved successfully.");
    } catch {
      Alert.alert("Error", "Failed to save template. Please try again.");
    }
  }, [templateText, upsertTemplate]);

  const handleDelete = useCallback(() => {
    if (!currentTemplate) return;
    Alert.alert(
      "Delete Template",
      "Are you sure you want to delete your WhatsApp template?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTemplate().unwrap();
              setTemplateText("");
              Alert.alert("Deleted", "Template has been deleted.");
            } catch {
              Alert.alert("Error", "Failed to delete template.");
            }
          },
        },
      ]
    );
  }, [currentTemplate, deleteTemplate]);

  const isLoading = loadingPlaceholders || loadingTemplate;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="WhatsApp Template" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="WhatsApp Template"
        rightAction={<TutorialButton videoUrl={TUTORIALS.whatsappTemplate} />}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        {/* Placeholders Section */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>
          Available Placeholders
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          Tap a placeholder to insert it into your template
        </Text>
        <View style={styles.chipsContainer}>
          {placeholders?.map((p) => (
            <TouchableOpacity
              key={p.key}
              onPress={() => insertPlaceholder(p.key)}
              style={[styles.chip, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
            >
              <Ionicons name="add-circle-outline" size={14} color={theme.mauve} />
              <Text style={[styles.chipText, { color: theme.mauve }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
          {(!placeholders || placeholders.length === 0) && (
            <Text style={[styles.emptyChips, { color: theme.textTertiary }]}>
              No placeholders available
            </Text>
          )}
        </View>

        {/* Template Editor */}
        <Text style={[styles.sectionTitle, { color: theme.text, marginTop: 24 }]}>
          Template Editor
        </Text>
        <TextInput
          style={[
            styles.editor,
            {
              backgroundColor: theme.inputBg,
              borderColor: theme.inputBorder,
              color: theme.text,
            },
          ]}
          multiline
          placeholder="Type your WhatsApp message template here..."
          placeholderTextColor={theme.placeholder}
          value={templateText}
          onChangeText={setTemplateText}
          onSelectionChange={(e) => setSelectionStart(e.nativeEvent.selection.start)}
          textAlignVertical="top"
        />

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[
              styles.saveBtn,
              { backgroundColor: theme.whatsappGreen, opacity: saving ? 0.6 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" />
                <Text style={styles.saveBtnText}>Save Template</Text>
              </>
            )}
          </TouchableOpacity>

          {currentTemplate && (
            <TouchableOpacity
              onPress={handleDelete}
              disabled={deleting}
              style={[
                styles.deleteBtn,
                { backgroundColor: theme.dangerLight, opacity: deleting ? 0.6 : 1 },
              ]}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color={theme.danger} />
                  <Text style={[styles.deleteBtnText, { color: theme.danger }]}>
                    Delete
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Current Template Preview */}
        {currentTemplate && (
          <View style={{ marginTop: 24 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Current Template Preview
            </Text>
            <View
              style={[
                styles.previewCard,
                { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}
            >
              <View style={styles.previewHeader}>
                <Ionicons name="logo-whatsapp" size={18} color={theme.whatsappGreen} />
                <Text style={[styles.previewLabel, { color: theme.textSecondary }]}>
                  Saved Template
                </Text>
              </View>
              <Text style={[styles.previewText, { color: theme.text }]}>
                {currentTemplate.templateText}
              </Text>
              <Text style={[styles.previewMeta, { color: theme.textTertiary }]}>
                Last updated: {new Date(currentTemplate.updatedAt).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  emptyChips: {
    fontSize: 13,
    fontStyle: "italic",
  },
  editor: {
    minHeight: 160,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  previewCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  previewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  previewText: {
    fontSize: 14,
    lineHeight: 22,
  },
  previewMeta: {
    fontSize: 11,
    marginTop: 10,
  },
});

export default WhatsAppTemplateScreen;
