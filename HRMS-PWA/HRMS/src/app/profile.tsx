import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useState } from "react";
import {
  getEmployeePhotoUri,
  uploadEmployeeProfilePhoto,
} from "../api/profile";

import { AppText as Text } from "../components/InterTypography";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../auth/AuthProvider";
import { useEmployeeProfile } from "../hooks/useEmployeeProfile";
import { useTheme } from "../theme/ThemeProvider";

function getName(profile: any, user: any): string {
  const firstName =
    profile?.employeeFirstName ??
    profile?.firstName ??
    user?.employee?.firstName ??
    "";

  const lastName =
    profile?.employeeLastName ??
    profile?.lastName ??
    user?.employee?.lastName ??
    "";

  return `${firstName} ${lastName}`.trim() || user?.username || "Employee";
}

function getEmail(profile: any, user: any): string {
  return (
    profile?.businessEmail ||
    profile?.personalEmail ||
    user?.employee?.email ||
    "—"
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, theme, setTheme } = useTheme();
  const { user, accessToken, signOut } = useAuth();

  const normalizedRole = String(user?.role ?? "").toUpperCase();

  const canAccessDiagnostics =
    [
      "SUPERADMIN",
      "SERVICE_PROVIDER",
      "COMPANY_ADMIN",
      "MULTI_COMPANY_ADMIN",
      "ADMIN",
      "BRANCH_ADMIN",
    ].includes(normalizedRole) ||
    (normalizedRole === "EMPLOYEE" &&
      user?.type === "employee" &&
      user?.isCompanyOwner === true);

  const { profile, isLoading, error, refetch } = useEmployeeProfile();

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const styles = createStyles(colors);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  const handleChangeProfilePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo library access to choose a profile picture.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
      });

      if (result.canceled || !result.assets?.[0]) {
        return;
      }

      const asset = result.assets[0];

      if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
        Alert.alert(
          "Image too large",
          "Please select an image smaller than 10 MB.",
        );
        return;
      }

      setIsUploadingPhoto(true);

      await uploadEmployeeProfilePhoto(
        {
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        },
        accessToken,
      );

      await refetch();

      Alert.alert("Success", "Your profile photo has been updated.");
    } catch (error) {
      Alert.alert(
        "Upload failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const fullName = getName(profile, user);

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .map((part: string) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const photoUri = getEmployeePhotoUri(profile?.employeePhotoUrl);
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <Text style={styles.headerTitle}>Profile</Text>

          <Pressable
            onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
            style={({ pressed }) => [
              styles.themeToggleButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
          >
            <Ionicons
              name={theme === "dark" ? "sunny-outline" : "moon-outline"}
              size={21}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>
              Unable to load the latest profile information.
            </Text>
          </View>
        ) : null}

        <View style={styles.profileHeader}>
          <Pressable
            onPress={handleChangeProfilePhoto}
            disabled={isUploadingPhoto}
            style={styles.avatarPressable}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.avatar}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials || "E"}</Text>
              </View>
            )}

            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera-outline" size={16} color="#FFFFFF" />
            </View>
          </Pressable>

          {isUploadingPhoto ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={styles.photoUploading}
            />
          ) : (
            <Text style={styles.photoHint}>Tap photo to change</Text>
          )}
          <Text style={styles.name}>{fullName}</Text>

          <Text style={styles.employeeId}>
            {profile?.employeeID ?? user?.employee?.employeeID ?? "—"}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <InfoRow
            label="Email"
            value={getEmail(profile, user)}
            colors={colors}
          />

          <InfoRow
            label="Phone"
            value={
              profile?.businessPhoneNo ||
              profile?.personalPhoneNo ||
              user?.employee?.phone ||
              "—"
            }
            colors={colors}
          />
          <InfoRow
            label="Branch"
            value={profile?.branch ?? user?.employee?.branch ?? "—"}
            colors={colors}
          />

          <InfoRow
            label="Department"
            value={profile?.department ?? user?.employee?.department ?? "—"}
            colors={colors}
          />

          <InfoRow
            label="Designation"
            value={profile?.designation ?? user?.employee?.designation ?? "—"}
            colors={colors}
          />
        </View>

        {__DEV__ || canAccessDiagnostics ? (
          <Pressable
            onPress={() => router.push("/diagnostics")}
            accessibilityRole="button"
            accessibilityLabel="Open background tracking diagnostics"
            style={({ pressed }) => [
              styles.diagnosticsButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="pulse-outline" size={21} color={colors.primary} />
            <Text style={styles.diagnosticsButtonText}>Diagnostics</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => signOut()}
          accessibilityRole="button"
          accessibilityLabel="Log out"
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="log-out-outline" size={21} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Delete Account",
              "Account deletion requests will be available soon.",
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Delete account"
          style={({ pressed }) => [
            styles.deleteAccountButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="trash-outline" size={21} color={colors.danger} />
          <Text style={styles.deleteAccountText}>Delete Account</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: {
    textPrimary: string;
    textSecondary: string;
    border: string;
  };
}) {
  const styles = stylesFactory(colors);

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>

      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function stylesFactory(colors: {
  textPrimary: string;
  textSecondary: string;
  border: string;
}) {
  return StyleSheet.create({
    infoRow: {
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    infoLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    infoValue: {
      marginTop: 4,
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
  });
}

function createStyles(colors: {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  danger: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
    },

    loading: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 26,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },

    themeToggleButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    pressed: {
      opacity: 0.78,
    },

    headerTitle: {
      flex: 1,
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    errorBox: {
      padding: 14,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 20,
    },

    errorText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },

    profileHeader: {
      alignItems: "center",
    },

    avatarPressable: {
      width: 92,
      height: 92,
      position: "relative",
    },

    avatarEditBadge: {
      position: "absolute",
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      borderWidth: 2,
      borderColor: colors.surface,
    },

    photoHint: {
      marginTop: 8,
      fontSize: 12,
      color: colors.textSecondary,
    },

    photoUploading: {
      marginTop: 8,
    },
    avatar: {
      width: 92,
      height: 92,
      borderRadius: 46,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },

    avatarText: {
      fontSize: 28,
      fontWeight: "800",
      color: "#FFFFFF",
    },

    name: {
      marginTop: 14,
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    employeeId: {
      marginTop: 4,
      fontSize: 14,
      color: colors.textSecondary,
    },

    infoCard: {
      marginTop: 26,
      paddingHorizontal: 16,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    sectionTitle: {
      marginTop: 28,
      marginBottom: 12,
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    themeSelector: {
      flexDirection: "row",
      gap: 10,
    },

    themeOption: {
      flex: 1,
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    themeOptionSelected: {
      backgroundColor: colors.surfaceSecondary,
      borderColor: colors.primary,
    },

    themeText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    themeTextSelected: {
      color: colors.primary,
    },

    diagnosticsButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 28,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    diagnosticsButtonText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    logoutButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 28,
      borderRadius: 16,
      backgroundColor: "#DC2626",
      borderWidth: 1,
      borderColor: "#DC2626",
    },

    logoutText: {
      fontSize: 15,
      fontWeight: "800",
      color: "#FFFFFF",
    },
    deleteAccountButton: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 12,
      borderRadius: 16,
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: colors.danger,
    },

    deleteAccountText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.danger,
    },
  });
}
