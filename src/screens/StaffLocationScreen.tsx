import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import { ScreenHeader } from "../components/layout/ScreenHeader";
import { EmptyState } from "../components/common/EmptyState";
import {
  useGetLatestLocationsQuery,
  useRequestLocationMutation,
} from "../store/staffLocation.api";
import type { StaffLocation, Designation } from "../types";

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
  return `${diffDays}d ago`;
}

interface LocationCardProps {
  item: StaffLocation;
  onRequestLocation: (employeeId: string) => void;
  requesting: boolean;
}

const LocationCard: React.FC<LocationCardProps> = ({
  item,
  onRequestLocation,
  requesting,
}) => {
  const { theme } = useTheme();
  const employee = item.employee;
  const name = employee
    ? [employee.firstName, employee.lastName].filter(Boolean).join(" ")
    : "Unknown";
  const designation = employee
    ? DESIGNATION_LABELS[employee.designation] || employee.designation
    : "";
  const initials = employee
    ? (employee.firstName.charAt(0) + (employee.lastName?.charAt(0) || "")).toUpperCase()
    : "?";

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: theme.mauve }]}>
          <Text style={[styles.avatarText, { color: theme.textInverse }]}>{initials}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={[styles.employeeName, { color: theme.text }]} numberOfLines={1}>
            {name}
          </Text>
          {designation !== "" && (
            <Text style={[styles.designation, { color: theme.textSecondary }]}>
              {designation}
            </Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => onRequestLocation(item.employeeId)}
          disabled={requesting}
          style={[
            styles.requestBtn,
            { backgroundColor: theme.infoLight, opacity: requesting ? 0.6 : 1 },
          ]}
        >
          {requesting ? (
            <ActivityIndicator size="small" color={theme.info} />
          ) : (
            <>
              <Ionicons name="locate-outline" size={14} color={theme.info} />
              <Text style={[styles.requestBtnText, { color: theme.info }]}>Request</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.divider }]} />

      <View style={styles.cardBottom}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={theme.textTertiary} />
          <Text
            style={[styles.addressText, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {item.address || "Address not available"}
          </Text>
        </View>
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color={theme.textTertiary} />
          <Text style={[styles.timeText, { color: theme.textTertiary }]}>
            {formatTimeAgo(item.capturedAt)}
          </Text>
        </View>
      </View>
    </View>
  );
};

export const StaffLocationScreen: React.FC = () => {
  const { theme } = useTheme();
  const {
    data: locations,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetLatestLocationsQuery();
  const [requestLocation] = useRequestLocationMutation();
  const [requestingId, setRequestingId] = React.useState<string | null>(null);

  const handleRequestLocation = useCallback(
    async (employeeId: string) => {
      setRequestingId(employeeId);
      try {
        await requestLocation({ employeeId }).unwrap();
        Alert.alert("Success", "Location request sent to the employee.");
      } catch {
        Alert.alert("Error", "Failed to request location. Please try again.");
      } finally {
        setRequestingId(null);
      }
    },
    [requestLocation]
  );

  const refreshButton = (
    <TouchableOpacity onPress={refetch} style={styles.headerBtn}>
      <Ionicons name="refresh-outline" size={22} color={theme.headerText} />
    </TouchableOpacity>
  );

  const renderItem = useCallback(
    ({ item }: { item: StaffLocation }) => (
      <LocationCard
        item={item}
        onRequestLocation={handleRequestLocation}
        requesting={requestingId === item.employeeId}
      />
    ),
    [handleRequestLocation, requestingId]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Staff Location" rightAction={refreshButton} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading locations...
          </Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.danger} />
          <Text style={[styles.errorText, { color: theme.textSecondary }]}>
            Failed to load staff locations
          </Text>
          <TouchableOpacity
            onPress={refetch}
            style={[styles.retryBtn, { backgroundColor: theme.gold }]}
          >
            <Text style={[styles.retryBtnText, { color: theme.textInverse }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : !locations || locations.length === 0 ? (
        <EmptyState
          icon="location-outline"
          title="No Location Data"
          subtitle="No staff location data is currently available."
        />
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={theme.gold}
              colors={[theme.gold]}
            />
          }
        />
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
  retryBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerBtn: {
    padding: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "600",
  },
  designation: {
    fontSize: 12,
    marginTop: 2,
  },
  requestBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  requestBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: 14,
  },
  cardBottom: {
    padding: 14,
    gap: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  addressText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 12,
  },
});

export default StaffLocationScreen;
