import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { useGetHierarchyTreeQuery } from "../store/hierarchy.api";
import type { HierarchyNode, Designation } from "../types";
import { TutorialButton } from "../components/layout/TutorialButton";
import { TUTORIALS } from "../lib/tutorials";

const DESIGNATION_LABELS: Record<Designation, string> = {
  SALES_EXECUTIVE: "Sales Executive",
  TEAM_LEAD: "Team Lead",
  SALES_MANAGER: "Sales Manager",
  AREA_MANAGER: "Area Manager",
  DGM: "DGM",
  GM: "GM",
  VP_SALES: "VP Sales",
  ADMIN: "Admin",
  SALES_COORDINATOR: "Sales Coordinator",
};

function getInitials(firstName: string, lastName: string | null): string {
  const first = firstName.charAt(0).toUpperCase();
  const last = lastName ? lastName.charAt(0).toUpperCase() : "";
  return first + last;
}

interface TreeNodeProps {
  node: HierarchyNode;
  level: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, level }) => {
  const { theme, isDark } = useTheme();
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  const initials = getInitials(node.firstName, node.lastName);
  const fullName = [node.firstName, node.lastName].filter(Boolean).join(" ");
  const designationLabel = DESIGNATION_LABELS[node.designation] || node.designation;

  return (
    <View>
      <TouchableOpacity
        activeOpacity={hasChildren ? 0.6 : 1}
        onPress={hasChildren ? toggleExpanded : undefined}
        style={[
          styles.nodeRow,
          {
            backgroundColor: theme.card,
            borderColor: theme.cardBorder,
            marginLeft: level * 20,
          },
        ]}
      >
        {hasChildren ? (
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={16}
            color={theme.textSecondary}
            style={styles.chevron}
          />
        ) : (
          <View style={styles.chevronPlaceholder} />
        )}

        <View
          style={[
            styles.avatar,
            { backgroundColor: theme.mauve },
          ]}
        >
          <Text style={[styles.avatarText, { color: theme.textInverse }]}>
            {initials}
          </Text>
        </View>

        <View style={styles.nodeInfo}>
          <Text style={[styles.nodeName, { color: theme.text }]} numberOfLines={1}>
            {fullName}
          </Text>
          <View
            style={[
              styles.designationBadge,
              { backgroundColor: isDark ? theme.goldLight : theme.goldLight },
            ]}
          >
            <Text style={[styles.designationText, { color: theme.goldDark }]}>
              {designationLabel}
            </Text>
          </View>
        </View>

        {hasChildren && (
          <Text style={[styles.childCount, { color: theme.textTertiary }]}>
            {node.children.length}
          </Text>
        )}
      </TouchableOpacity>

      {expanded &&
        hasChildren &&
        node.children.map((child) => (
          <TreeNode key={child.id} node={child} level={level + 1} />
        ))}
    </View>
  );
};

export const HierarchyScreen: React.FC = () => {
  const { theme } = useTheme();
  const { data: tree, isLoading, isError, refetch, isFetching } = useGetHierarchyTreeQuery();

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Organization" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.addEmployee} />}/>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading hierarchy...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            Failed to load hierarchy
          </Text>
          <TouchableOpacity
            onPress={refetch}
            style={[styles.retryBtn, { backgroundColor: theme.gold }]}
          >
            <Text style={[styles.retryText, { color: theme.textInverse }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !tree || tree.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="people-outline" size={48} color={theme.textTertiary} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            No hierarchy data available
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
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
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} level={0} />
          ))}
        </ScrollView>
      )}
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
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  nodeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  chevron: {
    marginRight: 8,
  },
  chevronPlaceholder: {
    width: 24,
    marginRight: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
  },
  nodeInfo: {
    flex: 1,
  },
  nodeName: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  designationBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  designationText: {
    fontSize: 11,
    fontWeight: "600",
  },
  childCount: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
  },
});

export default HierarchyScreen;
