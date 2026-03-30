import React, { useState, useCallback } from "react";
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
  useGetLatestTermsQuery,
  useGetNeedsAcceptanceQuery,
  usePublishTermsMutation,
  useAcceptTermsMutation,
} from "../store/terms.api";
import { useGetProfileQuery } from "../store/auth.api";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

export const TermsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { data: profile } = useGetProfileQuery();
  const {
    data: terms,
    isLoading: loadingTerms,
    refetch: refetchTerms,
    isFetching: fetchingTerms,
  } = useGetLatestTermsQuery();
  const { data: acceptance, refetch: refetchAcceptance } = useGetNeedsAcceptanceQuery();
  const [publishTerms, { isLoading: publishing }] = usePublishTermsMutation();
  const [acceptTerms, { isLoading: accepting }] = useAcceptTermsMutation();

  const [editorContent, setEditorContent] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const isAdmin = profile?.designation === "ADMIN";
  const mustAccept = acceptance?.mustAccept === true;

  const handlePublish = useCallback(async () => {
    if (!editorContent.trim()) {
      Alert.alert("Error", "Content cannot be empty.");
      return;
    }
    Alert.alert(
      "Publish Terms",
      "Are you sure you want to publish new Terms & Conditions? This will create a new version.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await publishTerms({ content: editorContent.trim() }).unwrap();
              setEditorContent("");
              setShowEditor(false);
              Alert.alert("Success", "Terms & Conditions published successfully.");
            } catch {
              Alert.alert("Error", "Failed to publish. Please try again.");
            }
          },
        },
      ]
    );
  }, [editorContent, publishTerms]);

  const handleAccept = useCallback(async () => {
    try {
      await acceptTerms({ termsId: terms?.id }).unwrap();
      refetchAcceptance();
      Alert.alert("Accepted", "You have accepted the Terms & Conditions.");
    } catch {
      Alert.alert("Error", "Failed to accept terms. Please try again.");
    }
  }, [acceptTerms, terms, refetchAcceptance]);

  const handleRefresh = useCallback(() => {
    refetchTerms();
    refetchAcceptance();
  }, [refetchTerms, refetchAcceptance]);

  if (loadingTerms) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Terms & Conditions" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.terms} />}/>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Terms & Conditions" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.terms} />}/>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={fetchingTerms && !loadingTerms}
            onRefresh={handleRefresh}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        {/* Version Info */}
        {terms && (
          <View style={[styles.versionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.versionRow}>
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: theme.textTertiary }]}>Version</Text>
                <Text style={[styles.versionValue, { color: theme.text }]}>
                  v{terms.version}
                </Text>
              </View>
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: theme.textTertiary }]}>Published</Text>
                <Text style={[styles.versionValue, { color: theme.text }]}>
                  {new Date(terms.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <View
                style={[
                  styles.statusIndicator,
                  { backgroundColor: terms.isActive ? theme.successLight : theme.dangerLight },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: terms.isActive ? theme.success : theme.danger },
                  ]}
                >
                  {terms.isActive ? "Active" : "Inactive"}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Terms Content */}
        {terms ? (
          <View style={[styles.contentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.contentText, { color: theme.text }]}>
              {terms.content}
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Ionicons name="document-text-outline" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No Terms & Conditions available
            </Text>
          </View>
        )}

        {/* Accept Button */}
        {mustAccept && (
          <TouchableOpacity
            onPress={handleAccept}
            disabled={accepting}
            style={[styles.acceptBtn, { backgroundColor: theme.gold, opacity: accepting ? 0.6 : 1 }]}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                <Text style={styles.acceptBtnText}>Accept Terms & Conditions</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Admin: Publish New Terms */}
        {isAdmin && (
          <View style={{ marginTop: 24 }}>
            <TouchableOpacity
              onPress={() => setShowEditor(!showEditor)}
              style={[styles.publishToggle, { backgroundColor: theme.surfaceVariant, borderColor: theme.border }]}
            >
              <Ionicons
                name={showEditor ? "chevron-up" : "create-outline"}
                size={18}
                color={theme.mauve}
              />
              <Text style={[styles.publishToggleText, { color: theme.mauve }]}>
                {showEditor ? "Hide Editor" : "Publish New Version"}
              </Text>
            </TouchableOpacity>

            {showEditor && (
              <View style={{ marginTop: 12 }}>
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
                  placeholder="Enter new Terms & Conditions content..."
                  placeholderTextColor={theme.placeholder}
                  value={editorContent}
                  onChangeText={setEditorContent}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  onPress={handlePublish}
                  disabled={publishing}
                  style={[
                    styles.publishBtn,
                    { backgroundColor: theme.gold, opacity: publishing ? 0.6 : 1 },
                  ]}
                >
                  {publishing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.publishBtnText}>Publish</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
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
    paddingVertical: 48,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  versionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  versionItem: {
    gap: 2,
  },
  versionLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  versionValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusIndicator: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  contentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  acceptBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  publishToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  publishToggleText: {
    fontSize: 14,
    fontWeight: "600",
  },
  editor: {
    minHeight: 200,
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
  },
  publishBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 12,
  },
  publishBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default TermsScreen;
