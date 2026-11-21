/*
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "../components/InterTypography";

import { useManagerDirectReporteesDashboard } from "../hooks/useManagerDirectReporteesDashboard";
import { useTheme } from "../theme/ThemeProvider";

import HomeSectionMenu from "../components/HomeSectionMenu";

type Colors = ReturnType<typeof useTheme>["colors"];

export default function MyReporteesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const reporteesDashboardQuery = useManagerDirectReporteesDashboard();

  const dashboard = reporteesDashboardQuery.data;
  const dashboardSummary = dashboard?.summary;

  const todayLateCount =
    dashboard?.employees.filter((employee) => employee.isLateArrival).length ??
    0;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={reporteesDashboardQuery.isRefetching}
            onRefresh={() => void reporteesDashboardQuery.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        <View>
          <View style={styles.header}>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to dashboard"
            >
              <Ionicons
                name="arrow-back"
                size={22}
                color={colors.textPrimary}
              />
            </Pressable>

            <View style={styles.headerInfo}>
              <Text style={styles.title}>My Reportees</Text>
              <Text style={styles.subtitle}>
                Employees directly reporting to you
              </Text>
            </View>
            <HomeSectionMenu
              activeSection="reportees"
              onSelect={(section) => {
                if (section === "dashboard") {
                  router.replace("/(tabs)");
                } else if (section === "team") {
                  router.replace("/my-team");
                }
              }}
            />
          </View>

          <View style={styles.dashboardSection}>
            <View style={styles.dashboardHeading}>
              <View style={styles.dashboardHeadingIcon}>
                <Ionicons
                  name="stats-chart-outline"
                  size={22}
                  color={colors.primary}
                />
              </View>
              <View>
                <Text style={styles.dashboardTitle}>Today's Overview</Text>
                <Text style={styles.dashboardSubtitle}>
                  Direct reportees attendance
                </Text>
              </View>
            </View>

            <View style={styles.totalMetricCard}>
              <View style={styles.totalMetricText}>
                <Text style={styles.totalMetricEyebrow}>TEAM SIZE</Text>
                <Text style={styles.totalMetricCount}>
                  {dashboardSummary?.total ?? "—"}
                </Text>
                <Text style={styles.totalMetricLabel}>Total Reportees</Text>
              </View>
              <View style={styles.totalMetricIcon}>
                <Ionicons
                  name="people-outline"
                  size={30}
                  color={colors.white}
                />
              </View>
            </View>

            <View style={styles.dashboardMetricGrid}>
              <View
                style={[
                  styles.dashboardMetricCard,
                  {
                    backgroundColor: colors.successBackground,
                    borderColor: colors.success,
                  },
                ]}
              >
                <Ionicons
                  name="checkmark-circle-outline"
                  size={23}
                  color={colors.success}
                />
                <Text
                  style={[
                    styles.dashboardMetricValue,
                    { color: colors.success },
                  ]}
                >
                  {dashboardSummary?.present ?? "—"}
                </Text>
                <Text
                  style={[
                    styles.dashboardMetricLabel,
                    { color: colors.success },
                  ]}
                >
                  Today's Present
                </Text>
              </View>

              <View
                style={[
                  styles.dashboardMetricCard,
                  {
                    backgroundColor: colors.warningBackground,
                    borderColor: colors.warning,
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={23}
                  color={colors.warning}
                />
                <Text
                  style={[
                    styles.dashboardMetricValue,
                    { color: colors.warning },
                  ]}
                >
                  {dashboard ? todayLateCount : "—"}
                </Text>
                <Text
                  style={[
                    styles.dashboardMetricLabel,
                    { color: colors.warning },
                  ]}
                >
                  Today's Late
                </Text>
              </View>

              <View
                style={[
                  styles.dashboardMetricCard,
                  {
                    backgroundColor: colors.dangerBackground,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <Ionicons
                  name="person-remove-outline"
                  size={23}
                  color={colors.danger}
                />
                <Text
                  style={[
                    styles.dashboardMetricValue,
                    { color: colors.danger },
                  ]}
                >
                  {dashboardSummary?.absent ?? "—"}
                </Text>
                <Text
                  style={[
                    styles.dashboardMetricLabel,
                    { color: colors.danger },
                  ]}
                >
                  Today's Absent
                </Text>
              </View>

              <View
                style={[
                  styles.dashboardMetricCard,
                  {
                    backgroundColor: colors.warningBackground,
                    borderColor: colors.warning,
                  },
                ]}
              >
                <Ionicons
                  name="calendar-outline"
                  size={23}
                  color={colors.warning}
                />
                <Text
                  style={[
                    styles.dashboardMetricValue,
                    { color: colors.warning },
                  ]}
                >
                  {dashboardSummary?.onLeave ?? "—"}
                </Text>
                <Text
                  style={[
                    styles.dashboardMetricLabel,
                    { color: colors.warning },
                  ]}
                >
                  On Leave
                </Text>
              </View>

              <View
                style={[
                  styles.dashboardMetricCard,
                  {
                    backgroundColor: colors.dangerBackground,
                    borderColor: colors.danger,
                  },
                ]}
              >
                <Ionicons
                  name="log-out-outline"
                  size={23}
                  color={colors.danger}
                />
                <Text
                  style={[
                    styles.dashboardMetricValue,
                    { color: colors.danger },
                  ]}
                >
                  {dashboardSummary?.noCheckout ?? "—"}
                </Text>
                <Text
                  style={[
                    styles.dashboardMetricLabel,
                    { color: colors.danger },
                  ]}
                >
                  Missed Checkout
                </Text>
              </View>
            </View>

            {reporteesDashboardQuery.isError ? (
              <Text style={styles.dashboardError}>
                Dashboard figures could not be loaded. Pull down to refresh.
              </Text>
            ) : null}
          </View>
        </View>
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
      marginBottom: 12,
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
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    dashboardSection: {
      marginBottom: 20,
    },
    dashboardHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 13,
    },
    dashboardHeadingIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    dashboardTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    dashboardSubtitle: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    totalMetricCard: {
      width: "100%",
      minHeight: 105,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      marginBottom: 10,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
    },
    totalMetricText: {
      flex: 1,
      gap: 2,
    },
    totalMetricEyebrow: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      color: colors.primary,
    },
    totalMetricCount: {
      fontSize: 30,
      lineHeight: 35,
      fontWeight: "900",
      color: colors.textPrimary,
    },
    totalMetricLabel: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    totalMetricIcon: {
      width: 56,
      height: 56,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    dashboardMetricGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
    },
    dashboardMetricCard: {
      width: "48.5%",
      minHeight: 108,
      padding: 13,
      borderRadius: 17,
      borderWidth: 1,
      justifyContent: "center",
      gap: 6,
    },
    dashboardMetricValue: {
      fontSize: 23,
      lineHeight: 27,
      fontWeight: "900",
    },
    dashboardMetricLabel: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
    },
    dashboardError: {
      marginTop: 10,
      fontSize: 11,
      color: colors.danger,
    },
    employeeCard: {
      padding: 15,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    employeeRow: {
      flexDirection: "row",
      alignItems: "center",
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
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    departmentText: {
      fontSize: 12,
      color: colors.textSecondary,
      fontWeight: "600",
    },
    stateContainer: {
      minHeight: 280,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 24,
    },
    stateTitle: {
      marginTop: 13,
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
  });
}
*/

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function MyReporteesScreen() {
  return <FeatureUnavailableScreen feature="My Reportees" />;
}