// import { Ionicons } from "@expo/vector-icons";
// import { Pressable, StyleSheet, View } from "react-native";

// import { AppText as Text } from "./InterTypography";

// import DashboardNotifications from "./DashboardNotifications";
// import { useManagerDirectReporteesDashboard } from "../hooks/useManagerDirectReporteesDashboard";
// import { useTheme } from "../theme/ThemeProvider";
// import { useRouter } from "expo-router";

// type Colors = ReturnType<typeof useTheme>["colors"];

// export default function MyReporteesSection({
//   reservedHeight,
// }: {
//   reservedHeight: number;
// }) {
//   const { colors } = useTheme();
//   const router = useRouter();

//   const openReporteeCategory = (category: string) => {
//     router.push({
//       pathname: "/my-reportees/[category]",
//       params: { category },
//     });
//   };
//   const metricCardHeight = Math.max(52, Math.floor((reservedHeight - 74) / 3));
//   const styles = createStyles(colors, metricCardHeight);

//   const query = useManagerDirectReporteesDashboard();
//   const dashboard = query.data;
//   const summary = dashboard?.summary;

//   const lateCount =
//     dashboard?.employees.filter((employee) => employee.isLateArrival).length ??
//     0;

//   const checkedOutCount =
//     dashboard?.employees.filter((employee) => Boolean(employee.outTime))
//       .length ?? 0;

//   return (
//     <View style={styles.container}>
//       <View style={{ height: reservedHeight, minHeight: 0 }}>
//         <Pressable
//           onPress={() => openReporteeCategory("total")}
//           style={({ pressed }) => [
//             styles.totalCard,
//             pressed && styles.cardPressed,
//           ]}
//           accessibilityRole="button"
//           accessibilityLabel="View all reportees"
//         >
//           <View style={styles.totalInfo}>
//             <Text style={styles.eyebrow}>TOTAL REPORTEES</Text>
//             <Text style={styles.totalCount}>{summary?.total ?? "—"}</Text>
//           </View>

//           <View style={styles.totalIcon}>
//             <Ionicons name="people-outline" size={23} color={colors.white} />
//           </View>
//         </Pressable>

//         <View style={styles.metricGrid}>
//           <MetricCard
//             icon="checkmark-done-circle-outline"
//             label="Today's Present"
//             value={summary?.present}
//             color={colors.success}
//             onPress={() => openReporteeCategory("present")}
//             styles={styles}
//           />

//           <MetricCard
//             icon="alarm-outline"
//             label="Today's Late"
//             value={dashboard ? lateCount : undefined}
//             color={colors.warning}
//             onPress={() => openReporteeCategory("late")}
//             styles={styles}
//           />

//           <MetricCard
//             icon="person-remove-outline"
//             label="Today's Absent"
//             value={summary?.absent}
//             color={colors.danger}
//             onPress={() => openReporteeCategory("absent")}
//             styles={styles}
//           />

//           <MetricCard
//             icon="calendar-outline"
//             label="On Leave"
//             value={summary?.onLeave}
//             color={colors.primary}
//             onPress={() => openReporteeCategory("on-leave")}
//             styles={styles}
//           />

//           <MetricCard
//             icon="log-out-outline"
//             label="Today's Checkout"
//             value={dashboard ? checkedOutCount : undefined}
//             color={colors.success}
//             onPress={() => openReporteeCategory("checked-out")}
//             styles={styles}
//           />

//           <MetricCard
//             icon="log-out-outline"
//             label="Missed Checkout"
//             value={summary?.noCheckout}
//             color={colors.danger}
//             onPress={() => openReporteeCategory("missed-checkout")}
//             styles={styles}
//           />
//         </View>

//         {query.isError ? (
//           <Text style={styles.error}>
//             Dashboard figures could not be loaded. Pull down to refresh.
//           </Text>
//         ) : null}
//       </View>
//       <DashboardNotifications scope="reportees" />
//     </View>
//   );
// }

// function MetricCard({
//   icon,
//   label,
//   value,
//   color,
//   styles,
//   onPress,
//   wide = false,
// }: {
//   icon: React.ComponentProps<typeof Ionicons>["name"];
//   label: string;
//   value: number | undefined;
//   color: string;
//   styles: ReturnType<typeof createStyles>;
//   onPress: () => void;
//   wide?: boolean;
// }) {
//   const { colors: themeColors, theme } = useTheme();

//   return (
//     <Pressable
//       onPress={onPress}
//       style={({ pressed }) => [
//         styles.metricCard,
//         wide && styles.metricCardWide,
//         {
//           backgroundColor:
//             theme === "light"
//               ? themeColors.white
//               : themeColors.surfaceSecondary,
//           borderColor: themeColors.border,
//           shadowColor: themeColors.black,
//           shadowOpacity: theme === "light" ? 0.09 : 0.2,
//           elevation: 3,
//         },
//         pressed && styles.cardPressed,
//       ]}
//       accessibilityRole="button"
//       accessibilityLabel={`${label}: ${value ?? "—"}`}
//     >
//       {wide ? (
//         <>
//           <View style={styles.metricWideHeading}>
//             <View style={styles.metricIconWrap}>
//               <Ionicons name={icon} size={17} color={color} />
//             </View>

//             <Text style={styles.metricWideLabel}>{label}</Text>
//           </View>

//           <Text style={styles.metricValue}>{value ?? "—"}</Text>
//         </>
//       ) : (
//         <>
//           <View style={styles.metricTopRow}>
//             <Text style={styles.metricValue}>{value ?? "—"}</Text>

//             <View style={styles.metricIconWrap}>
//               <Ionicons name={icon} size={17} color={color} />
//             </View>
//           </View>

//           <Text style={styles.metricLabel}>{label}</Text>
//         </>
//       )}
//     </Pressable>
//   );
// }

// function createStyles(colors: Colors, metricCardHeight: number) {
//   return StyleSheet.create({
//     container: {
//       flex: 1,
//       minHeight: 0,
//     },
//     content: {
//       flexGrow: 1,
//       paddingHorizontal: 17,
//       paddingTop: 0,
//       paddingBottom: 0,
//     },
//     cardPressed: {
//       opacity: 0.78,
//       transform: [{ scale: 0.98 }],
//     },

//     totalInfo: {
//       flexDirection: "row",
//       alignItems: "center",
//       alignSelf: "center",
//       gap: 10,
//     },

//     metricTopRow: {
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//     },

//     metricIconWrap: {
//       width: 28,
//       height: 28,
//       borderRadius: 8,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },

//     metricWideHeading: {
//       flex: 1,
//       minWidth: 0,
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 8,
//     },

//     metricWideLabel: {
//       flexShrink: 1,
//       fontSize: 11,
//       lineHeight: 14,
//       fontWeight: "700",
//       color: colors.textSecondary,
//     },

//     dashboardHeading: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 10,
//       marginBottom: 13,
//     },
//     headingIcon: {
//       width: 40,
//       height: 40,
//       borderRadius: 13,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },
//     headingTitle: {
//       fontSize: 17,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },
//     headingSubtitle: {
//       marginTop: 3,
//       fontSize: 11,
//       color: colors.textSecondary,
//     },
//     totalCard: {
//       width: "100%",
//       height: 58,
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//       paddingHorizontal: 13,
//       paddingVertical: 8,
//       marginBottom: 6,
//       borderRadius: 16,
//       backgroundColor: colors.primaryLight,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     eyebrow: {
//       fontSize: 10,
//       fontWeight: "800",
//       letterSpacing: 1,
//       color: colors.primary,
//     },
//     totalCount: {
//       fontSize: 26,
//       lineHeight: 30,
//       fontWeight: "900",
//       color: colors.textPrimary,
//     },
//     totalLabel: {
//       fontSize: 12,
//       fontWeight: "700",
//       color: colors.textSecondary,
//     },
//     totalIcon: {
//       width: 40,
//       height: 40,
//       borderRadius: 13,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primary,
//     },
//     metricGrid: {
//       flexGrow: 0,
//       flexShrink: 0,
//       flexDirection: "row",
//       flexWrap: "wrap",
//       justifyContent: "space-between",
//       rowGap: 5,
//     },

//     metricCard: {
//       width: "49%",
//       height: metricCardHeight,
//       paddingHorizontal: 10,
//       paddingVertical: 7,
//       borderRadius: 14,
//       borderWidth: 1,
//       justifyContent: "space-between",
//       gap: 1,
//       shadowOffset: { width: 0, height: 2 },
//       shadowRadius: 5,
//     },
//     metricCardWide: {
//       width: "100%",
//       height: 54,
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//       paddingHorizontal: 11,
//       paddingVertical: 5,
//       gap: 8,
//     },

//     metricValue: {
//       fontSize: 20,
//       lineHeight: 23,
//       fontWeight: "900",
//       color: colors.textPrimary,
//     },
//     metricLabel: {
//       flexShrink: 1,
//       fontSize: 10,
//       lineHeight: 14,
//       fontWeight: "700",
//       color: colors.textSecondary,
//     },
//     error: {
//       marginTop: 10,
//       fontSize: 11,
//       color: colors.danger,
//     },
//   });
// }

import FeatureUnavailableScreen from "./FeatureUnavailableScreen";

export default function MyReporteesSection(_props: { reservedHeight: number }) {
  return <FeatureUnavailableScreen feature="My Reportees" />;
}
