import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/theme";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  /** When true, renders a compact inline bar (no safe-area padding, no border, smaller height).
   *  Use this when placing the bar inside a container (e.g. below the status tab strip)
   *  rather than fixed at the bottom of the screen. */
  inline?: boolean;
  /** Page size options to show in the inline variant (e.g. [10, 20, 50]).
   *  Omit to hide the selector entirely. */
  pageSizes?: number[];
  /** Current page size — required when pageSizes is provided. */
  pageSize?: number;
  /** Called when the user picks a new page size. */
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export const PaginationBar: React.FC<Props> = ({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
  inline = false,
  pageSizes = PAGE_SIZE_OPTIONS,
  pageSize,
  onPageSizeChange,
}) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  if (inline) {
    return (
      <View
        style={[
          styles.inlineContainer,
          { backgroundColor: theme.card, borderTopColor: theme.divider ?? theme.border },
        ]}
      >
        {/* ── Left: page size selector ── */}
        {pageSize !== undefined && onPageSizeChange && (
          <View style={styles.pageSizeRow}>
            <Text style={[styles.pageSizeLabel, { color: theme.textTertiary }]}>Rows:</Text>
            <View style={styles.pageSizePills}>
              {pageSizes.map((size) => {
                const active = size === pageSize;
                return (
                  <TouchableOpacity
                    key={size}
                    onPress={() => onPageSizeChange(size)}
                    style={[
                      styles.pageSizePill,
                      {
                        backgroundColor: active ? theme.gold : theme.surfaceVariant,
                        borderColor: active ? theme.gold : theme.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pageSizePillText,
                        { color: active ? "#fff" : theme.textSecondary },
                      ]}
                    >
                      {size}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Right: page info + prev/next ── */}
        <View style={styles.inlineRight}>
          <Text style={[styles.inlineInfo, { color: theme.textSecondary }]}>
            {page}/{totalPages}{" "}
            <Text style={{ color: theme.textTertiary }}>({total})</Text>
          </Text>
          <View style={styles.buttons}>
            <TouchableOpacity
              onPress={onPrev}
              disabled={page <= 1}
              style={[
                styles.inlineBtn,
                { backgroundColor: page <= 1 ? theme.surfaceVariant : theme.gold },
              ]}
            >
              <Ionicons
                name="chevron-back"
                size={14}
                color={page <= 1 ? theme.textTertiary : "#fff"}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onNext}
              disabled={page >= totalPages}
              style={[
                styles.inlineBtn,
                { backgroundColor: page >= totalPages ? theme.surfaceVariant : theme.gold },
              ]}
            >
              <Ionicons
                name="chevron-forward"
                size={14}
                color={page >= totalPages ? theme.textTertiary : "#fff"}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ── Original bottom-bar render (unchanged) ─────────────────────────────────
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          paddingBottom: Math.max(insets.bottom, 16),
        },
      ]}
    >
      <Text style={[styles.info, { color: theme.textSecondary }]}>
        Page {page} of {totalPages} ({total} total)
      </Text>
      <View style={styles.buttons}>
        <TouchableOpacity
          onPress={onPrev}
          disabled={page <= 1}
          style={[
            styles.btn,
            { backgroundColor: page <= 1 ? theme.surfaceVariant : theme.gold },
          ]}
        >
          <Ionicons
            name="chevron-back"
            size={18}
            color={page <= 1 ? theme.textTertiary : "#fff"}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onNext}
          disabled={page >= totalPages}
          style={[
            styles.btn,
            { backgroundColor: page >= totalPages ? theme.surfaceVariant : theme.gold },
          ]}
        >
          <Ionicons
            name="chevron-forward"
            size={18}
            color={page >= totalPages ? theme.textTertiary : "#fff"}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Original bottom-bar styles (untouched) ─────────────────────────────────
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
    marginBottom: 0,
    borderTopWidth: 1,
  },
  info: {
    fontSize: 13,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Inline variant ─────────────────────────────────────────────────────────
  inlineContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexWrap: "wrap",
    gap: 4,
  },

  // Page size selector (left side)
  pageSizeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pageSizeLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  pageSizePills: {
    flexDirection: "row",
    gap: 4,
  },
  pageSizePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  pageSizePillText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Page info + buttons (right side)
  inlineRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineInfo: {
    fontSize: 12,
    fontWeight: "600",
  },
  inlineBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
  },
  buttons: {
    flexDirection: "row",
    gap: 6,
  },
});