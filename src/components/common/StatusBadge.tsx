import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "../../lib/theme";
import type { LeadStatus } from "../../types";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; darkBg: string }> = {
  FRESH: { label: "Fresh", color: "#2980B9", bg: "#D6EAF8", darkBg: "#1A2E3D" },
  FOLLOW_UP: { label: "Follow Up", color: "#C8922A", bg: "#F5E6C8", darkBg: "#3D3020" },
  VISIT_DONE: { label: "Visit Done", color: "#27AE60", bg: "#D4EFDF", darkBg: "#1F3D2A" },
  MEETING_DONE: { label: "Meeting Done", color: "#8E44AD", bg: "#E8D8F0", darkBg: "#2E1F3D" },
  RINGING: { label: "Ringing", color: "#E67E22", bg: "#FAE5D3", darkBg: "#3D2E1F" },
  CALL_BACK: { label: "Call Back", color: "#16A085", bg: "#D5F5E3", darkBg: "#1F3D30" },
  DEAL_DONE: { label: "Deal Done", color: "#27AE60", bg: "#D4EFDF", darkBg: "#1F3D2A" },
  NOT_INTERESTED: { label: "Not Interested", color: "#C0392B", bg: "#F5D7D3", darkBg: "#3D1F1F" },
  HOT_PROSPECT: { label: "Hot Prospect", color: "#E74C3C", bg: "#FADBD8", darkBg: "#3D1F1F" },
  SUSPECT: { label: "Suspect", color: "#7F8C8D", bg: "#E5E8E8", darkBg: "#2E2E30" },
  SWITCH_OFF: { label: "Switch Off", color: "#95A5A6", bg: "#EAEDED", darkBg: "#2E2E30" },
  WRONG_NUMBER: { label: "Wrong Number", color: "#C0392B", bg: "#F5D7D3", darkBg: "#3D1F1F" },
};

interface Props {
  status: LeadStatus | string;
  small?: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, small }) => {
  const { theme, isDark } = useTheme();
  const config = STATUS_CONFIG[status] || { label: status, color: "#666", bg: "#E0E0E0", darkBg: "#333" };

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: isDark ? config.darkBg : config.bg,
        paddingHorizontal: small ? 6 : 10,
        paddingVertical: small ? 2 : 4,
      },
    ]}>
      <Text style={[
        styles.text,
        {
          color: config.color,
          fontSize: small ? 10 : 12,
        },
      ]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    fontWeight: "600",
  },
});
