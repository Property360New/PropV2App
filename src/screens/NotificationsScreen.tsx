import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { EmptyState } from "../components/common/EmptyState";
import {
  useGetNotificationsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} from "../store/notifications.api";
import type { AppNotification } from "../types";
import { useNavigation } from "@react-navigation/native";

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

interface NotificationItemProps {
  notification: AppNotification;
  onPress: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onPress,
}) => {
  const { theme } = useTheme();
  const isUnread = !notification.readAt;

  return (
    <TouchableOpacity
      onPress={() => onPress(notification.id)}
      activeOpacity={0.7}
      style={[
        styles.notificationCard,
        {
          backgroundColor: isUnread ? theme.surfaceVariant : theme.card,
          borderColor: theme.cardBorder,
        },
      ]}
    >
      <View style={styles.notificationRow}>
        <View style={styles.dotContainer}>
          {isUnread && (
            <View style={[styles.unreadDot, { backgroundColor: theme.info }]} />
          )}
        </View>
        <View style={styles.notificationContent}>
          <Text
            style={[
              styles.notificationTitle,
              { color: theme.text, fontWeight: isUnread ? "700" : "600" },
            ]}
            numberOfLines={1}
          >
            {notification.title}
          </Text>
          <Text
            style={[styles.notificationMessage, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {notification.message}
          </Text>
          <Text style={[styles.notificationTime, { color: theme.textTertiary }]}>
            {formatTimeAgo(notification.createdAt)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
      </View>
    </TouchableOpacity>
  );
};

export const NotificationsScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const [page, setPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Use a Map keyed by notification id — this is the single source of truth
  // and makes duplicate keys structurally impossible regardless of API behaviour.
  const [notifMap, setNotifMap] = useState<Map<string, AppNotification>>(
    new Map()
  );

  // Track which page numbers we have already merged so RTK Query re-renders
  // (e.g. cache updates, mark-as-read invalidations) don't re-append the same page.
  const mergedPages = useRef(new Set<number>());

  const {
    data: response,
    isLoading,
    isFetching,
    refetch: rawRefetch,
  } = useGetNotificationsQuery({ page, limit: 10 });

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead, { isLoading: markingAll }] = useMarkAllAsReadMutation();

  const meta = response?.meta ?? {
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 10,
  };

  // Merge new page into the Map exactly once per page number.
  useEffect(() => {
    if (!response?.data?.length) return;
    const responsePage = meta.page;
    if (mergedPages.current.has(responsePage)) return;

    mergedPages.current.add(responsePage);
    setNotifMap((prev) => {
      const next = new Map(prev);
      for (const n of response.data) {
        next.set(n.id, n);
      }
      return next;
    });
    setHasMore(responsePage < meta.totalPages);
  }, [response]);

  // Stable array for FlatList — Map preserves insertion order.
  const notifications = Array.from(notifMap.values());

  // ── All hooks before any early returns ────────────────────

  const refetch = useCallback(async () => {
    setIsRefreshing(true);
    setNotifMap(new Map());
    mergedPages.current.clear();
    setHasMore(true);
    if (page === 1) {
      await rawRefetch();
    } else {
      // Changing page to 1 will trigger the query; rawRefetch not needed.
      setPage(1);
    }
    setIsRefreshing(false);
  }, [page, rawRefetch]);

  const handleNotificationPress = useCallback(
    async (id: string) => {
      const notification = notifMap.get(id);
      if (notification && !notification.readAt) {
        try {
          await markAsRead(id).unwrap();
          // Optimistic local update so the dot disappears immediately.
          setNotifMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(id);
            if (existing) {
              next.set(id, { ...existing, readAt: new Date().toISOString() });
            }
            return next;
          });
        } catch {
          // Silently fail — not critical
        }
      }
    },
    [notifMap, markAsRead]
  );

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead().unwrap();
      // Optimistic update
      setNotifMap((prev) => {
        const next = new Map(prev);
        const now = new Date().toISOString();
        for (const [id, n] of next) {
          if (!n.readAt) next.set(id, { ...n, readAt: now });
        }
        return next;
      });
    } catch {
      // Silently fail
    }
  }, [markAllAsRead]);

  const handleLoadMore = useCallback(() => {
    if (!isFetching && hasMore) {
      setPage((p) => p + 1);
    }
  }, [isFetching, hasMore]);

  const renderFooter = useCallback(() => {
    if (!isFetching || isLoading) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.gold} />
        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          Loading more...
        </Text>
      </View>
    );
  }, [isFetching, isLoading, theme]);

  const renderItem = useCallback(
    ({ item }: { item: AppNotification }) => (
      <NotificationItem notification={item} onPress={handleNotificationPress} />
    ),
    [handleNotificationPress]
  );

  // Must stay above early returns — it's a hook (useLayoutEffect).
  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={handleMarkAllAsRead}
          disabled={markingAll}
          style={styles.headerMarkAllBtn}
        >
          {markingAll ? (
            <ActivityIndicator size="small" color={theme.gold} />
          ) : (
            <Text style={[styles.headerMarkAllText, { color: theme.gold }]}>
              Mark All Read
            </Text>
          )}
        </TouchableOpacity>
      ),
      headerStyle: { backgroundColor: theme.headerBg },
      headerTintColor: theme.headerText,
      headerTitleStyle: {
        color: theme.headerText,
        fontWeight: "700" as const,
      },
    });
  }, [navigation, theme, handleMarkAllAsRead, markingAll]);

  // ── Early returns AFTER all hooks ─────────────────────────

  if (isLoading && notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading notifications...
          </Text>
        </View>
      </View>
    );
  }

  if (!isLoading && notifications.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="notifications-off-outline"
          title="No Notifications"
          subtitle="You're all caught up! New notifications will appear here."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            tintColor={theme.gold}
            colors={[theme.gold]}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, fontSize: 14 },
  headerMarkAllBtn: { paddingHorizontal: 12, paddingVertical: 6 },
  headerMarkAllText: { fontSize: 13, fontWeight: "600" },
  listContent: { padding: 16, paddingBottom: 8 },
  notificationCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
  },
  notificationRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  dotContainer: { width: 12, alignItems: "center", marginRight: 10 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notificationContent: { flex: 1, marginRight: 8 },
  notificationTitle: { fontSize: 14, marginBottom: 4 },
  notificationMessage: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  notificationTime: { fontSize: 11 },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
    gap: 8,
  },
  footerText: { fontSize: 13 },
});

export default NotificationsScreen;