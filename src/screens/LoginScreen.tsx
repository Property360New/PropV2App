import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLoginMutation } from "../store/auth.api";
import { useAppDispatch } from "../store";
import { setCredentials } from "../store/authSlice";

// ── Brand tokens (mirrors web COLORS) ────────────────────────────────────────
const C = {
  darkIndigo:  "#1A0F2E",
  indigo2:     "#2D1B4E",
  mauve:       "#5B184E",
  mauveDark:   "#3D0F34",
  gold:        "#C49832",   // matches web gradient start
  goldDark:    "#A07828",   // matches web gradient end
  lavender:    "#C8B8D8",
  white:       "#FFFFFF",
  danger:      "#C0392B",
  dangerLight: "#FDECEA",
  inputBorder: "#C8B8D840",
  placeholder: "#9B8AAA",
};

export const LoginScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError("Please enter your email address."); return; }
    if (!password)     { setError("Please enter your password.");       return; }

    try {
      const result = await login({ email: trimmedEmail, password }).unwrap();
      dispatch(setCredentials({
        employee:     result.employee,
        accessToken:  result.accessToken,
        refreshToken: result.refreshToken,
      }));
      navigation.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (err: any) {
      const message =
        err?.data?.message || err?.data?.error || err?.error ||
        "Login failed. Please check your credentials.";
      setError(typeof message === "string" ? message : "Login failed.");
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.darkIndigo} />

      {/* Full-page gradient background */}
      <View style={styles.bgGradient} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo ─────────────────────────────────────────────────────── */}
          <View style={styles.logoWrap}>
            <Image
              source={require("../../assets/property360roundNoBg.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* ── Card ─────────────────────────────────────────────────────── */}
          <View style={styles.card}>
            {/* gold top stripe — mirrors the web card's 4px gradient line */}
            <View style={styles.cardTopStripe} />

            <Text style={styles.cardTitle}>Welcome Back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your CRM account</Text>

            {/* Error banner */}
            {error && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={C.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={C.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="you@property360.com"
                  placeholderTextColor={C.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>
            </View>

            {/* Password */}
            <View style={[styles.fieldGroup, { marginBottom: 28 }]}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={C.placeholder} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={C.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  returnKeyType="go"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(s => !s)}
                  disabled={isLoading}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                    size={20}
                    color={C.placeholder}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Submit — gold gradient button matching web */}
            <TouchableOpacity
              style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              {isLoading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={styles.submitText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            Property 360 Degree — Internal CRM Platform
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  root: {
    flex: 1,
    backgroundColor: C.darkIndigo,
  },

  // Simulates the web's 3-stop diagonal gradient:
  // darkIndigo → indigo2 → mauveDark
  // RN doesn't support CSS gradients natively; we layer two Views.
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.darkIndigo,
    // If you have expo-linear-gradient installed, replace this View with:
    // <LinearGradient colors={[C.darkIndigo, C.indigo2, C.mauveDark]}
    //   start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
  },

  scroll: {
    alignItems: "center",
    paddingHorizontal: 24,
  },

  // ── Logo ──────────────────────────────────────────────────────────────────
  logoWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  logo: {
    width: 240,
    height: 200,
    tintColor: C.white, // inverts logo to white — same as web's filter:brightness(0) invert(1)
  },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.white,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 0,     // top stripe sits flush at top
    paddingBottom: 36,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },

  // 4px gradient bar at top of card — mirrors web's linear-gradient(90deg, mauve, gold, mauve)
  cardTopStripe: {
    height: 4,
    marginHorizontal: -28, // bleed to card edges
    marginBottom: 28,
    backgroundColor: C.gold,
    // For expo-linear-gradient replace with:
    // <LinearGradient colors={[C.mauve, C.gold, C.mauve]} start={{x:0,y:0}} end={{x:1,y:0}} style={styles.cardTopStripe} />
  },

  cardTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: C.darkIndigo,
    marginBottom: 6,
    // Playfair Display isn't available in RN by default;
    // add via expo-font if desired: fontFamily: "PlayfairDisplay_800ExtraBold"
  },
  cardSubtitle: {
    fontSize: 14,
    color: C.placeholder,
    marginBottom: 24,
  },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.dangerLight,
    borderWidth: 1,
    borderColor: `${C.danger}30`,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: C.danger,
  },

  // ── Inputs ────────────────────────────────────────────────────────────────
  fieldGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: C.darkIndigo,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: `${C.lavender}60`,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    backgroundColor: C.white,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: C.darkIndigo,
    height: "100%",
  },
  eyeBtn: {
    padding: 4,
    marginLeft: 4,
  },

  // ── Submit ────────────────────────────────────────────────────────────────
  submitBtn: {
    height: 52,
    borderRadius: 12,
    backgroundColor: C.gold,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnDisabled: {
    backgroundColor: C.lavender,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    fontSize: 15,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.5,
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  footer: {
    marginTop: 24,
    fontSize: 12,
    color: C.lavender,
    textAlign: "center",
  },
});