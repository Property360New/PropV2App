import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../lib/theme";
import { useGetUnreadCountQuery } from "../../store/notifications.api";
// ✅ Import from the dedicated context file, NOT from AppNavigator
import { useDrawer } from "../../navigation/DrawerContext";

interface Props {
  title: string;
  subtitle?: string;
  showDrawer?: boolean;
  showNotifications?: boolean;
  rightAction?: React.ReactNode;
}

export const ScreenHeader: React.FC<Props> = ({
  title,
  subtitle,
  showDrawer = true,
  showNotifications = true,
  rightAction,
}) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { data: unreadCount } = useGetUnreadCountQuery();
  const { openDrawer } = useDrawer();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.headerBg, paddingTop: insets.top },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={theme.headerBg} />
      <View style={styles.row}>
        {showDrawer && (
          <TouchableOpacity onPress={openDrawer} style={styles.iconBtn}>
            <Ionicons name="menu" size={24} color={theme.headerText} />
          </TouchableOpacity>
        )}
        <View style={styles.titleContainer}>
          <Text
            style={[styles.title, { color: theme.headerText }]}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              style={[styles.subtitle, { color: theme.gold }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.rightActions}>
          {rightAction}
          {showNotifications && (
            <TouchableOpacity
              onPress={() => navigation.navigate("Notifications")}
              style={styles.iconBtn}
            >
              <Ionicons
                name="notifications-outline"
                size={22}
                color={theme.headerText}
              />
              {(unreadCount ?? 0) > 0 && (
                <View
                  style={[styles.badge, { backgroundColor: theme.danger }]}
                >
                  {/* <Text style={styles.badgeText}>
                    {(unreadCount ?? 0) > 99 ? "99+" : unreadCount}
                  </Text> */}
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  iconBtn: {
    padding: 4,
    position: "relative",
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});