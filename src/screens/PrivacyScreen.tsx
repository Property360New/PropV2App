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
  useGetLatestPrivacyQuery,
  usePublishPrivacyMutation,
} from "../store/terms.api";
import { useGetProfileQuery } from "../store/auth.api";

export const PrivacyScreen: React.FC = () => {
  const { theme } = useTheme();
  const { data: profile } = useGetProfileQuery();
  const {
    data: privacy,
    isLoading,
    refetch,
    isFetching,
  } = useGetLatestPrivacyQuery();
  const [publishPrivacy, { isLoading: publishing }] = usePublishPrivacyMutation();

  const [editorContent, setEditorContent] = useState("");
  const [showEditor, setShowEditor] = useState(false);

  const isAdmin = profile?.designation === "ADMIN";

  const handlePublish = useCallback(async () => {
    if (!editorContent.trim()) {
      Alert.alert("Error", "Content cannot be empty.");
      return;
    }
    Alert.alert(
      "Publish Privacy Policy",
      "Are you sure you want to publish a new Privacy Policy? This will create a new version.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          onPress: async () => {
            try {
              await publishPrivacy({ content: editorContent.trim() }).unwrap();
              setEditorContent("");
              setShowEditor(false);
              Alert.alert("Success", "Privacy Policy published successfully.");
            } catch {
              Alert.alert("Error", "Failed to publish. Please try again.");
            }
          },
        },
      ]
    );
  }, [editorContent, publishPrivacy]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Privacy Policy" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Privacy Policy" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
      >
        {/* Version Info */}
        {privacy && (
          <View style={[styles.versionCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.versionRow}>
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: theme.textTertiary }]}>Version</Text>
                <Text style={[styles.versionValue, { color: theme.text }]}>
                  v{privacy.version}
                </Text>
              </View>
              <View style={styles.versionItem}>
                <Text style={[styles.versionLabel, { color: theme.textTertiary }]}>Updated</Text>
                <Text style={[styles.versionValue, { color: theme.text }]}>
                  {new Date(privacy.updatedAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Privacy Content */}
        {privacy ? (
          <View style={[styles.contentCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <Text style={[styles.contentText, { color: theme.text }]}>
              {privacy.content}
            </Text>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="shield-outline" size={48} color={theme.textTertiary} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              No Privacy Policy available
            </Text>
          </View>
        )}

        {/* Admin: Publish New Privacy Policy */}
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
                  placeholder="Enter new Privacy Policy content..."
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
    gap: 24,
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
  contentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 22,
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 15,
    marginTop: 12,
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

export default PrivacyScreen;
