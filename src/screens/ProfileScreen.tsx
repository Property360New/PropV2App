import React, { useState, useEffect, useCallback } from "react";
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
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from "../store/auth.api";
import type { Designation } from "../types";
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

export const ProfileScreen: React.FC = () => {
  const { theme } = useTheme();
  const { data: profile, isLoading, refetch, isFetching } = useGetProfileQuery();
  const [updateProfile, { isLoading: updatingProfile }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: changingPassword }] = useChangePasswordMutation();

  // Edit profile state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  // Change password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleUpdateProfile = useCallback(async () => {
    if (!firstName.trim()) {
      Alert.alert("Error", "First name is required.");
      return;
    }
    try {
      await updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
      }).unwrap();
      Alert.alert("Success", "Profile updated successfully.");
    } catch {
      Alert.alert("Error", "Failed to update profile. Please try again.");
    }
  }, [firstName, lastName, phone, updateProfile]);

  const handleChangePassword = useCallback(async () => {
    if (!oldPassword) {
      Alert.alert("Error", "Please enter your current password.");
      return;
    }
    if (!newPassword) {
      Alert.alert("Error", "Please enter a new password.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Error", "New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }
    try {
      await changePassword({ oldPassword, newPassword }).unwrap();
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Success", "Password changed successfully.");
    } catch {
      Alert.alert("Error", "Failed to change password. Please check your current password.");
    }
  }, [oldPassword, newPassword, confirmPassword, changePassword]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ScreenHeader title="Profile" 
        rightAction={<TutorialButton videoUrl={TUTORIALS.profile} />}/>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.gold} />
        </View>
      </View>
    );
  }

  const initials = profile
    ? getInitials(profile.firstName, profile.lastName)
    : "?";
  const fullName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ")
    : "";
  const designationLabel = profile
    ? DESIGNATION_LABELS[profile.designation] || profile.designation
    : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Profile" 
      rightAction={<TutorialButton videoUrl={TUTORIALS.profile} />}/>

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
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <View style={[styles.avatarLarge, { backgroundColor: theme.mauve }]}>
            <Text style={[styles.avatarLargeText, { color: theme.textInverse }]}>
              {initials}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: theme.text }]}>{fullName}</Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>
            {profile?.email || ""}
          </Text>
          <View style={[styles.designationBadge, { backgroundColor: theme.goldLight }]}>
            <Text style={[styles.designationText, { color: theme.goldDark }]}>
              {designationLabel}
            </Text>
          </View>
          {profile?.phone && (
            <View style={styles.phoneRow}>
              <Ionicons name="call-outline" size={14} color={theme.textTertiary} />
              <Text style={[styles.phoneText, { color: theme.textSecondary }]}>
                {profile.phone}
              </Text>
            </View>
          )}
        </View>

        {/* Edit Profile Section */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Edit Profile</Text>

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>First Name</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            ]}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First Name"
            placeholderTextColor={theme.placeholder}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Last Name</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            ]}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last Name"
            placeholderTextColor={theme.placeholder}
          />

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Phone</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone Number"
            placeholderTextColor={theme.placeholder}
            keyboardType="phone-pad"
          />

          <TouchableOpacity
            onPress={handleUpdateProfile}
            disabled={updatingProfile}
            style={[styles.actionBtn, { backgroundColor: theme.gold, opacity: updatingProfile ? 0.6 : 1 }]}
          >
            {updatingProfile ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Change Password Section */}
        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Change Password</Text>

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Current Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
              ]}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Current Password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry={!showOldPassword}
            />
            <TouchableOpacity
              onPress={() => setShowOldPassword(!showOldPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showOldPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>New Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
              ]}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="New Password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry={!showNewPassword}
            />
            <TouchableOpacity
              onPress={() => setShowNewPassword(!showNewPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showNewPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Confirm Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[
                styles.input,
                styles.passwordInput,
                { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.text },
              ]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm New Password"
              placeholderTextColor={theme.placeholder}
              secureTextEntry={!showConfirmPassword}
            />
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              style={styles.eyeBtn}
            >
              <Ionicons
                name={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={theme.textTertiary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={changingPassword}
            style={[styles.actionBtn, { backgroundColor: theme.mauve, opacity: changingPassword ? 0.6 : 1 }]}
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="lock-closed-outline" size={18} color="#fff" />
                <Text style={styles.actionBtnText}>Change Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
  profileCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  avatarLargeText: {
    fontSize: 26,
    fontWeight: "700",
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 10,
  },
  designationBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  designationText: {
    fontSize: 12,
    fontWeight: "600",
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 13,
  },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    marginBottom: 14,
  },
  passwordRow: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: "absolute",
    right: 14,
    top: 12,
    padding: 2,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
    marginTop: 4,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
});

export default ProfileScreen;
