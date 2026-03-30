import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Alert,
  Easing,
} from "react-native";
import { Accelerometer } from "expo-sensors";
import * as SecureStore from "expo-secure-store";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Sound System ───────────────────────────────────────────
function generateWav(frequency: number, durationMs: number, volume = 0.5, decay = true): string {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * durationMs / 1000);
  const dataSize = numSamples * 2;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, fileSize - 8, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const env = decay ? Math.max(0, 1 - (i / numSamples)) : 1;
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * env;
    const s16 = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    view.setInt16(44 + i * 2, s16, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let b64 = "";
  for (let i = 0; i < binary.length; i += 3) {
    const a = binary.charCodeAt(i);
    const b = i + 1 < binary.length ? binary.charCodeAt(i + 1) : 0;
    const c = i + 2 < binary.length ? binary.charCodeAt(i + 2) : 0;
    b64 += b64chars[(a >> 2)];
    b64 += b64chars[((a & 3) << 4) | (b >> 4)];
    b64 += i + 1 < binary.length ? b64chars[((b & 15) << 2) | (c >> 6)] : "=";
    b64 += i + 2 < binary.length ? b64chars[c & 63] : "=";
  }
  return b64;
}


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── Constants ──────────────────────────────────────────────
const BALLOON_COLORS = [
  "#FF3B30", "#D4A843", "#007AFF", "#34C759", "#FF69B4",
  "#AF52DE", "#FF9500", "#FFCC00", "#FF2D55", "#5AC8FA",
];

const CONFETTI_COLORS = [
  "#D4A843", "#FF3B30", "#FF69B4", "#007AFF", "#34C759",
  "#AF52DE", "#FF9500", "#FFCC00", "#FF2D55", "#5AC8FA",
];

const HIGH_SCORE_KEY = "birthday_game_highscore";

// ─── Types ──────────────────────────────────────────────────
interface Celebration {
  type: "birthday" | "anniversary";
  name: string;
  phone?: string;
  employeeId?: string;
  source: "employee" | "client"; 
}

interface Props {
  celebrations: Celebration[];
  onClose: () => void;
}

interface GameBalloon {
  id: number;
  x: number;
  y: Animated.Value;
  color: string;
  size: number;
  speed: number;
  type: "normal" | "golden" | "bomb";
  popped: boolean;
  scale: Animated.Value;
}

// ─── Helpers ────────────────────────────────────────────────
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getDefaultMessage = (type: "birthday" | "anniversary", name: string): string => {
  if (type === "birthday") {
    return `\u{1F382} Happy Birthday ${name}! Wishing you a day as wonderful as you are. May this year bring you joy, success, and all the happiness you deserve! \u{1F389}\u{2728}`;
  }
  return `\u{1F48D} Happy Anniversary ${name}! Congratulations on this beautiful milestone. Wishing you many more years of love, laughter, and togetherness! \u{1F942}\u{2764}\u{FE0F}`;
};

// ─── Confetti Piece ─────────────────────────────────────────
const ConfettiPiece = ({ delay }: { delay: number }) => {
  const fallAnim    = useRef(new Animated.Value(-20)).current;
  const rotateAnim  = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;

  const x        = Math.random() * SCREEN_WIDTH;
  const color    = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const size     = 5 + Math.random() * 7;
  const isCircle = Math.random() > 0.5;
  const duration = 4000 + Math.random() * 4000;

  useEffect(() => {
    const animate = () => {
      fallAnim.setValue(-20);
      opacityAnim.setValue(0.7);
      rotateAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fallAnim,    { toValue: SCREEN_HEIGHT + 20,         duration, useNativeDriver: true }),
        Animated.timing(rotateAnim,  { toValue: 360 * (2 + Math.random() * 3), duration, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration, delay: duration * 0.7, useNativeDriver: true }),
      ]).start(() => animate());
    };
    const timer = setTimeout(animate, delay);
    return () => clearTimeout(timer);
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 360], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: x,
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: isCircle ? size / 2 : 2,
        opacity: opacityAnim,
        transform: [
          { translateY: fallAnim },
          { translateX: (Math.random() - 0.5) * 100 },
          { rotate: spin },
        ],
      }}
    />
  );
};

// ─── Wish Card ──────────────────────────────────────────────
const WishCard = ({ celebration }: { celebration: Celebration }) => {
  const [message, setMessage] = useState(getDefaultMessage(celebration.type, celebration.name));
  const isBirthday = celebration.type === "birthday";
  const initials   = getInitials(celebration.name);

  const cleanPhone = celebration.phone?.replace(/\D/g, "").replace(/^0+/, "") ?? "";
  const hasPhone   = cleanPhone.length >= 10;

  const handleWhatsApp = () => {
    const url = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert("Error", "Could not open WhatsApp. Please make sure it is installed.");
    });
  };

  const handleCopy = () => {
    Alert.alert("Copied!", "Message has been copied to clipboard.", [{ text: "OK" }]);
  };

  return (
    <View style={wishStyles.card}>
      <View style={wishStyles.headerRow}>
        <View style={[wishStyles.avatar, { backgroundColor: isBirthday ? "#FF69B4" : "#D4A843" }]}>
          <Text style={wishStyles.avatarText}>{initials}</Text>
        </View>
        <View style={wishStyles.headerInfo}>
          <Text style={wishStyles.name}>{celebration.name}</Text>
          <View style={wishStyles.badge}>
  <Text style={wishStyles.badgeText}>
    {celebration.source === "client" ? "👤 Client · " : "👥 Team · "}
    {isBirthday ? "🎂 Birthday" : "💍 Anniversary"}
  </Text>
</View>
        </View>
      </View>

      <View style={wishStyles.chatBubble}>
        <View style={wishStyles.bubbleTail} />
        <TextInput
          style={wishStyles.messageInput}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          placeholderTextColor="rgba(255,255,255,0.4)"
        />
      </View>

      {/* actions row — gap replaced with marginRight on first button */}
      <View style={wishStyles.actions}>
        {hasPhone && (
          <TouchableOpacity
            style={[wishStyles.whatsappBtn, { marginRight: 10 }]}
            onPress={handleWhatsApp}
          >
            <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
            <Text style={wishStyles.whatsappBtnText}>Send via WhatsApp</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={wishStyles.copyBtn} onPress={handleCopy}>
          <Ionicons name="copy-outline" size={16} color="#D4A843" />
          <Text style={wishStyles.copyBtnText}>Copy Message</Text>
        </TouchableOpacity>
      </View>

      {!hasPhone && (
        <Text style={wishStyles.noPhoneHint}>No phone number available for WhatsApp</Text>
      )}
    </View>
  );
};

// ─── Wishes View ────────────────────────────────────────────
const WishesView = ({ celebrations }: { celebrations: Celebration[] }) => {
  const insets = useSafeAreaInsets();
  const [wishTab, setWishTab] = useState<"employee" | "client">("employee");

  const employeeCelebrations = celebrations.filter((c) => c.source === "employee");
  const clientCelebrations   = celebrations.filter((c) => c.source === "client");
  const visibleCelebrations  = wishTab === "employee" ? employeeCelebrations : clientCelebrations;

  if (celebrations.length === 0) {
    return (
      <View style={wishStyles.emptyContainer}>
        <Text style={wishStyles.emptyEmoji}>{"\u{1F389}"}</Text>
        <Text style={wishStyles.emptyText}>No celebrations today</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Sub-tabs: Team / Clients */}
      <View style={wishStyles.subTabRow}>
        <TouchableOpacity
          style={[wishStyles.subTab, wishTab === "employee" && wishStyles.subTabActive]}
          onPress={() => setWishTab("employee")}
          activeOpacity={0.7}
        >
          <Text style={[wishStyles.subTabText, wishTab === "employee" && wishStyles.subTabTextActive]}>
            {"👥 Team"}{employeeCelebrations.length > 0 ? ` (${employeeCelebrations.length})` : ""}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[wishStyles.subTab, wishTab === "client" && wishStyles.subTabActive]}
          onPress={() => setWishTab("client")}
          activeOpacity={0.7}
        >
          <Text style={[wishStyles.subTabText, wishTab === "client" && wishStyles.subTabTextActive]}>
            {"👤 Clients"}{clientCelebrations.length > 0 ? ` (${clientCelebrations.length})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={wishStyles.scrollView}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={wishStyles.sectionTitle}>
          {"\u{1F389}"} {wishTab === "employee" ? "Team" : "Client"} Celebrations ({visibleCelebrations.length})
        </Text>
        {visibleCelebrations.length === 0 ? (
          <View style={wishStyles.emptyContainer}>
            <Text style={wishStyles.emptyEmoji}>{wishTab === "employee" ? "👥" : "👤"}</Text>
            <Text style={wishStyles.emptyText}>
              No {wishTab === "employee" ? "team" : "client"} celebrations today
            </Text>
          </View>
        ) : (
          visibleCelebrations.map((c, i) => (
            <WishCard key={`${c.employeeId ?? c.name}-${i}`} celebration={c} />
          ))
        )}
      </ScrollView>
    </View>
  );
};


// ─── Main Component ──────────────────────────────────────────
export const BirthdayCelebration: React.FC<Props> = ({ celebrations, onClose }) => {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"wishes" | "game">("wishes");

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.container]}>
      {Array.from({ length: 20 }).map((_, i) => (
        <ConfettiPiece key={`confetti-${i}`} delay={i * 200} />
      ))}

      <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { top: insets.top + 10 }]} activeOpacity={0.7}>
        <View style={styles.closeBtnInner}>
          <Ionicons name="close" size={24} color="#FFF" />
        </View>
      </TouchableOpacity>

      <View style={[styles.tabRow, { top: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "wishes" && styles.tabActive]}
          onPress={() => setActiveTab("wishes")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, activeTab === "wishes" && styles.tabTextActive]}>
            Wishes {"\u{1F48C}"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ✅ Add this — push content below the tab row */}
      <View style={[styles.content, { marginTop: insets.top + 56 }]}>
        {activeTab === "wishes" && <WishesView celebrations={celebrations} />}
      </View>
    </View>
  );
};

// ─── Main Styles ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    zIndex: 1000,
  },
  closeBtn: {
    position: "absolute",
    right: 16,
    zIndex: 1001,
  },
  closeBtnInner: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center",
  },
  tabRow: {
    position: "absolute",
    left: 16, right: 70,
    flexDirection: "row",
    zIndex: 1001,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 3,
  },
  tab:           { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive:     { backgroundColor: "#D4A843" },
  tabText:       { color: "rgba(255,255,255,0.6)", fontSize: 14, fontWeight: "700" },
  tabTextActive: { color: "#FFF" },
  content:       { flex: 1 },
});

// ─── Wish Styles ─────────────────────────────────────────────
const wishStyles = StyleSheet.create({
  scrollView:   { flex: 1, paddingHorizontal: 16 },
  sectionTitle: { color: "#D4A843", fontSize: 18, fontWeight: "800", marginBottom: 16, marginTop: 8 },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(212,168,67,0.2)",
  },
  headerRow:  { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  avatar:     { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#FFF", fontSize: 18, fontWeight: "800" },
  headerInfo: { marginLeft: 12, flex: 1 },
  name:       { color: "#FFF", fontSize: 17, fontWeight: "700" },
  badge:      { backgroundColor: "rgba(212,168,67,0.2)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  badgeText:  { color: "#D4A843", fontSize: 12, fontWeight: "600" },
  chatBubble: {
    backgroundColor: "rgba(37,211,102,0.15)",
    borderRadius: 14, borderTopLeftRadius: 4,
    padding: 14, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: "#25D366",
  },
  bubbleTail: {
    position: "absolute", top: 0, left: -8,
    width: 0, height: 0,
    borderRightWidth: 8, borderBottomWidth: 8,
    borderRightColor: "rgba(37,211,102,0.15)", borderBottomColor: "transparent",
  },
  subTabRow: {
  flexDirection: "row",
  marginHorizontal: 16,
  marginTop: 4,
  marginBottom: 8,
  backgroundColor: "rgba(255,255,255,0.08)",
  borderRadius: 10,
  padding: 3,
},
subTab: {
  flex: 1,
  paddingVertical: 8,
  alignItems: "center",
  borderRadius: 8,
},
subTabActive: {
  backgroundColor: "rgba(212,168,67,0.25)",
},
subTabText: {
  color: "rgba(255,255,255,0.5)",
  fontSize: 13,
  fontWeight: "700",
},
subTabTextActive: {
  color: "#D4A843",
},
  messageInput: {
    color: "#FFF", fontSize: 14, lineHeight: 20,
    minHeight: 60, textAlignVertical: "top", padding: 0,
  },
  // gap removed — marginRight added inline on whatsappBtn instead
  actions:     { flexDirection: "row" },
  whatsappBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#25D366", borderRadius: 10, paddingVertical: 11,
  },
  whatsappBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700", marginLeft: 6 },
  copyBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(212,168,67,0.15)", borderRadius: 10, paddingVertical: 11,
    borderWidth: 1, borderColor: "rgba(212,168,67,0.3)",
  },
  copyBtnText:  { color: "#D4A843", fontSize: 14, fontWeight: "700", marginLeft: 6 },
  noPhoneHint:  { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 8, fontStyle: "italic" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyEmoji:     { fontSize: 48, marginBottom: 12 },
  emptyText:      { color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: "600" },
});
