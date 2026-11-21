/*

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/InterTypography";
import type { ReporteeDashboardEmployee } from "../../api/reporteesDashboard";
import { useManagerDirectReporteesDashboard } from "../../hooks/useManagerDirectReporteesDashboard";
import { useTheme } from "../../theme/ThemeProvider";

type Colors = ReturnType<typeof useTheme>["colors"];

type ReporteeCategory =
  | "total"
  | "present"
  | "late"
  | "absent"
  | "on-leave"
  | "checked-out"
  | "missed-checkout";

const CATEGORY_LABELS: Record<ReporteeCategory, string> = {
  total: "All Reportees",
  present: "Today's Present",
  late: "Today's Late",
  absent: "Today's Absent",
  "on-leave": "On Leave",
  "checked-out": "Today's Checkout",
  "missed-checkout": "Missed Checkout",
};

function isReporteeCategory(value: string): value is ReporteeCategory {
  return value in CATEGORY_LABELS;
}

function matchesCategory(
  employee: ReporteeDashboardEmployee,
  category: ReporteeCategory,
) {
  const status = employee.statusType.trim().toUpperCase();

  switch (category) {
    case "total":
      return true;

    case "late":
      return employee.isLateArrival;

    case "on-leave":
      return status === "LEAVE";

    case "checked-out":
      return Boolean(employee.outTime);

    case "missed-checkout":
      return status === "SINGLE_PUNCH";

    case "present":
      if (["PRESENT", "OT", "LATE_MARK", "SINGLE_PUNCH"].includes(status)) {
        return true;
      }
      if (status === "REGULARIZATION") {
        return employee.hasPunches;
      }
      if (
        ["HALF_DAY", "ABSENT", "LEAVE", "WEEK_OFF", "HOLIDAY"].includes(status)
      ) {
        return false;
      }
      return employee.hasPunches;

    case "absent":
      if (status === "ABSENT") return true;
      if (status === "HALF_DAY") return !employee.hasPunches;
      if (
        [
          "PRESENT",
          "OT",
          "LATE_MARK",
          "SINGLE_PUNCH",
          "LEAVE",
          "WEEK_OFF",
          "HOLIDAY",
          "REGULARIZATION",
        ].includes(status)
      ) {
        return false;
      }
      return !employee.hasPunches;
  }
}

function getEmployeeName(employee: ReporteeDashboardEmployee) {
  const name = [employee.employeeFirstName, employee.employeeLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || `Employee #${employee.id}`;
}

export default function ReporteeCategoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string | string[] }>();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const rawCategory = Array.isArray(params.category)
    ? params.category[0]
    : params.category;

  const categoryValue = rawCategory ?? "";

  const category: ReporteeCategory = isReporteeCategory(categoryValue)
    ? categoryValue
    : "total";
  const query = useManagerDirectReporteesDashboard();
  const [searchQuery, setSearchQuery] = useState("");

  const search = searchQuery.trim().toLowerCase();

  const employees = (query.data?.employees ?? []).filter((employee) => {
    if (!matchesCategory(employee, category)) return false;
    if (category !== "total" || !search) return true;

    return [
      `${employee.employeeFirstName} ${employee.employeeLastName}`,
      String(employee.id),
      employee.departmentName ?? "",
      employee.designationName ?? "",
    ].some((value) => value.toLowerCase().includes(search));
  });

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/my-reportees");
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => void query.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back to My Reportees"
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.title}>{CATEGORY_LABELS[category]}</Text>
            <Text style={styles.subtitle}>Direct reportees</Text>
          </View>
        </View>

        {category === "total" ? (
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Search reportees..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
        ) : null}

        {query.isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateMessage}>Loading reportees…</Text>
          </View>
        ) : query.isError ? (
          <View style={styles.stateContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={34}
              color={colors.textSecondary}
            />
            <Text style={styles.stateTitle}>Couldn't load reportees</Text>
            <Text style={styles.stateMessage}>
              Please check your connection and try again.
            </Text>
            <Pressable
              onPress={() => void query.refetch()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>
              {employees.length}{" "}
              {employees.length === 1 ? "employee" : "employees"}
            </Text>

            {employees.length === 0 ? (
              <View style={styles.stateContainer}>
                <Ionicons
                  name="people-outline"
                  size={34}
                  color={colors.textSecondary}
                />
                <Text style={styles.stateTitle}>No reportees found</Text>
                <Text style={styles.stateMessage}>
                  There are no employees in this category today.
                </Text>
              </View>
            ) : (
              <View style={styles.employeeList}>
                {employees.map((employee) => (
                  <Pressable
                    key={employee.id}
                    onPress={() =>
                      router.push({
                        pathname: "/my-team/employee/[id]",
                        params: {
                          id: String(employee.id),
                          status: employee.isLateArrival
                            ? "Late Arrival"
                            : employee.statusType === "LEAVE"
                              ? "On Leave"
                              : employee.statusDisplay,
                        },
                      })
                    }
                    style={({ pressed }) => [
                      styles.employeeCard,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`View ${getEmployeeName(employee)} details`}
                  >
                    <View style={styles.avatar}>
                      <Ionicons
                        name="person-outline"
                        size={22}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.employeeInfo}>
                      <Text style={styles.employeeName} numberOfLines={1}>
                        {getEmployeeName(employee)}
                      </Text>

                      <Text style={styles.employeeDepartment} numberOfLines={1}>
                        {employee.departmentName || "Department not assigned"}
                      </Text>

                      {employee.designationName ? (
                        <Text
                          style={styles.employeeDesignation}
                          numberOfLines={1}
                        >
                          {employee.designationName}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText} numberOfLines={2}>
                        {employee.isLateArrival
                          ? "Late Arrival"
                          : employee.statusDisplay}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      paddingHorizontal: 17,
      paddingTop: 12,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 22,
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
    headerInfo: {
      flex: 1,
    },
    title: {
      fontSize: 21,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 12,
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
    resultCount: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
      marginBottom: 12,
    },
    employeeList: {
      gap: 11,
    },
    employeeCard: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    avatar: {
      width: 43,
      height: 43,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    employeeInfo: {
      flex: 1,
      minWidth: 0,
    },
    employeeName: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    employeeDepartment: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    employeeDesignation: {
      marginTop: 2,
      fontSize: 10,
      color: colors.textMuted,
    },
    statusBadge: {
      maxWidth: 95,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor: colors.surfaceSecondary,
    },
    statusText: {
      fontSize: 9,
      fontWeight: "800",
      color: colors.textSecondary,
      textAlign: "center",
    },
    stateContainer: {
      minHeight: 240,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
      paddingVertical: 30,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stateTitle: {
      marginTop: 13,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateMessage: {
      marginTop: 7,
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 16,
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

export default function MyReporteesCategoryScreen() {
  return <FeatureUnavailableScreen feature="Reportee attendance details" />;
}
