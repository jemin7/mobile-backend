/*
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  TextInput,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/InterTypography";
import type { TeamAttendanceMember } from "../../api/team";
import { useManagerTeamMembers } from "../../hooks/useManagerTeamMembers";
import { getTeamOption } from "../../teamOptions";
import { useTheme } from "../../theme/ThemeProvider";

type TeamColors = ReturnType<typeof useTheme>["colors"];

function getEmployeeName(member: TeamAttendanceMember) {
  const fullName = [member.employeeFirstName, member.employeeLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || member.employeeID || `Employee #${member.id}`;
}

function getMemberStatus(member: TeamAttendanceMember) {
  if (member.isOnLeaveToday === true) {
    return "On Leave";
  }

  if (member.isLateArrival === true) {
    return "Late Arrival";
  }

  if (member.isAbsentToday === true) {
    return "Absent";
  }

  if (member.statusLabel?.trim()) {
    return member.statusLabel.trim();
  }

  if (member.isCheckedIn) {
    return "Checked in";
  }

  return "Yet to check-in";
}

function formatPunchTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusTone(status: string, colors: TeamColors) {
  if (status === "Checked in") {
    return {
      foreground: colors.success,
      background: colors.successBackground,
    };
  }

  if (status === "Checked out") {
    return {
      foreground: colors.primary,
      background: colors.primaryLight,
    };
  }

  if (status === "Absent") {
    return {
      foreground: colors.danger,
      background: colors.dangerBackground,
    };
  }

  return {
    foreground: colors.warning,
    background: colors.warningBackground,
  };
}

export default function TeamCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    category?: string | string[];
  }>();

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const option = getTeamOption(params.category);

  const { members, isLoading, isError, error, isRefetching, refetch } =
    useManagerTeamMembers();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const list = members.filter(option.matches);
    const search = searchQuery.trim().toLowerCase();

    if (option.id !== "total" || !search) return list;

    return list.filter((member) =>
      [
        `${member.employeeFirstName ?? ""} ${member.employeeLastName ?? ""}`,
        member.employeeID ?? "",
        member.departmentName ?? "",
        member.designation ?? "",
        member.email ?? "",
      ].some((value) => value.toLowerCase().includes(search)),
    );
  }, [members, option, searchQuery]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/my-team");
    }
  };

  const renderEmployee = ({ item }: { item: TeamAttendanceMember }) => (
    <EmployeeCard
      member={item}
      showPunchTimes={option.fields.includes("punchTimes")}
      colors={colors}
      styles={styles}
    />
  );

  const listHeader = (
    <View>
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Go back to My Team"
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.title}>{option.title}</Text>
          <Text style={styles.subtitle}>{option.subtitle}</Text>
        </View>
      </View>

      {option.id === "total" ? (
        <View style={styles.searchContainer}>
          <Ionicons
            name="search-outline"
            size={20}
            color={colors.textSecondary}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search employees..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      ) : null}

      <View style={styles.resultHeading}>
        <View>
          <Text style={styles.resultTitle}>Employees</Text>
          <Text style={styles.resultSubtitle}>
            {filteredMembers.length}{" "}
            {filteredMembers.length === 1 ? "employee" : "employees"}
          </Text>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {listHeader}

        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateMessage}>Loading employees…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        {listHeader}

        <View style={styles.stateContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={36}
            color={colors.textSecondary}
          />

          <Text style={styles.stateTitle}>Couldn't load employees</Text>

          <Text style={styles.stateMessage}>
            {error instanceof Error
              ? error.message
              : "Please check your connection and try again."}
          </Text>

          <Pressable onPress={() => void refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <FlatList
        data={filteredMembers}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEmployee}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="people-outline"
                size={32}
                color={colors.textSecondary}
              />
            </View>

            <Text style={styles.stateTitle}>No employees found</Text>

            <Text style={styles.stateMessage}>{option.emptyMessage}</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </SafeAreaView>
  );
}

type EmployeeCardProps = {
  member: TeamAttendanceMember;
  showPunchTimes: boolean;
  colors: TeamColors;
  styles: ReturnType<typeof createStyles>;
};

function EmployeeCard({
  member,
  showPunchTimes,
  colors,
  styles,
}: EmployeeCardProps) {
  const router = useRouter();
  const [photoError, setPhotoError] = useState(false);

  const status = getMemberStatus(member);
  const tone = getStatusTone(status, colors);

  return (
    <View style={styles.employeeCard}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: "/my-team/employee/[id]",
            params: {
              id: String(member.id),
              status,
            },
          })
        }
        style={({ pressed }) => [styles.employeeTop, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`View ${getEmployeeName(member)} details`}
      >
        <View style={styles.avatar}>
          {member.employeePhotoUrl && !photoError ? (
            <Image
              source={{ uri: member.employeePhotoUrl }}
              style={styles.avatarImage}
              onError={() => setPhotoError(true)}
            />
          ) : (
            <Ionicons name="person-outline" size={22} color={colors.primary} />
          )}
        </View>

        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName} numberOfLines={1}>
            {getEmployeeName(member)}
          </Text>
        </View>

        <View
          style={[styles.statusBadge, { backgroundColor: tone.background }]}
        >
          <Text style={[styles.statusText, { color: tone.foreground }]}>
            {status}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
    </View>
  );
}

function optionallyShowDepartment(
  member: TeamAttendanceMember,
  styles: ReturnType<typeof createStyles>,
) {
  return (
    <View style={styles.departmentRow}>
      <Ionicons
        name="business-outline"
        size={15}
        color={styles.departmentIcon.color}
      />

      <Text style={styles.departmentText}>
        {member.departmentName || "Unassigned"}
      </Text>
    </View>
  );
}

function createStyles(colors: TeamColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    listContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 40,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 25,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },

    headerContent: {
      flex: 1,
    },

    title: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    subtitle: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    searchContainer: {
      height: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      marginBottom: 16,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 0,
      fontSize: 14,
      color: colors.textPrimary,
    },
    resultHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    resultTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    resultSubtitle: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSecondary,
    },

    employeeCard: {
      padding: 15,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    employeeTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },

    avatar: {
      width: 46,
      height: 46,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
      overflow: "hidden",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
      borderRadius: 16,
    },

    employeeDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    employeeIdRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      marginBottom: 10,
    },
    employeeInfo: {
      flex: 1,
      minWidth: 0,
    },

    employeeName: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    employeeId: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textMuted,
    },

    statusBadge: {
      maxWidth: 112,
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      alignItems: "center",
    },

    statusText: {
      fontSize: 10,
      fontWeight: "800",
    },

    departmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },
    departmentText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },

    departmentIcon: {
      color: colors.textSecondary,
    },

    punchContainer: {
      flexDirection: "row",
      marginTop: 14,
      paddingTop: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },

    punchBox: {
      flex: 1,
      gap: 7,
    },

    punchLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    punchLabel: {
      fontSize: 11,
      color: colors.textSecondary,
      fontWeight: "600",
    },

    punchTime: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    punchDivider: {
      width: 1,
      backgroundColor: colors.border,
      marginHorizontal: 14,
    },

    listSeparator: {
      height: 11,
    },

    stateContainer: {
      flex: 1,
      minHeight: 260,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },

    emptyContainer: {
      flex: 1,
      minHeight: 260,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },

    emptyIcon: {
      width: 65,
      height: 65,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 15,
    },

    stateTitle: {
      marginTop: 12,
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },

    stateMessage: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },

    retryButton: {
      marginTop: 17,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },

    retryText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },

    pressed: {
      opacity: 0.75,
    },
  });
}
*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function MyTeamCategoryScreen() {
  return (
    <FeatureUnavailableScreen feature="Team attendance and employee details" />
  );
}