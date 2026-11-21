// import { Ionicons } from "@expo/vector-icons";

// import {
//   ActivityIndicator,
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   View,
// } from "react-native";

// import { AppText as Text } from "./InterTypography";

// import DashboardNotifications from "./DashboardNotifications";
// import { useManagerTeamMembers } from "../hooks/useManagerTeamMembers";

// import { TEAM_OPTIONS, type TeamOption } from "../teamOptions";
// import { useTheme } from "../theme/ThemeProvider";

// import { useRouter } from "expo-router";
// type TeamColors = ReturnType<typeof useTheme>["colors"];

// function getToneColor(tone: TeamOption["tone"], colors: TeamColors) {
//   switch (tone) {
//     case "success":
//       return {
//         foreground: colors.success,
//         background: colors.successBackground,
//       };
//     case "danger":
//       return {
//         foreground: colors.danger,
//         background: colors.dangerBackground,
//       };
//     case "warning":
//       return {
//         foreground: colors.warning,
//         background: colors.warningBackground,
//       };
//     default:
//       return {
//         foreground: colors.primary,
//         background: colors.primaryLight,
//       };
//   }
// }

// export default function MyTeamSection({
//   reservedHeight,
// }: {
//   reservedHeight: number;
// }) {
//   const router = useRouter();
//   const { colors, theme } = useTheme();
//   const styles = createStyles(colors);

//   const { members, isLoading, isError, error, refetch } =
//     useManagerTeamMembers();
//   return (
//     <View style={styles.container}>
//       <View style={{ height: reservedHeight, minHeight: 0 }}>
//         {isLoading ? (
//           <View style={styles.stateContainer}>
//             <ActivityIndicator size="large" color={colors.primary} />
//             <Text style={styles.stateMessage}>Loading team information…</Text>
//           </View>
//         ) : isError ? (
//           <View style={styles.stateContainer}>
//             <Ionicons
//               name="cloud-offline-outline"
//               size={36}
//               color={colors.textSecondary}
//             />

//             <Text style={styles.stateTitle}>Couldn't load team</Text>

//             <Text style={styles.stateMessage}>
//               {error instanceof Error
//                 ? error.message
//                 : "Please check your connection and try again."}
//             </Text>

//             <Pressable
//               onPress={() => void refetch()}
//               style={styles.retryButton}
//             >
//               <Text style={styles.retryText}>Try Again</Text>
//             </Pressable>
//           </View>
//         ) : (
//           <>
//             {/* Quick Access - Employee List Shortcuts */}
//             <View style={styles.quickAccessSection}>
//               <View style={styles.quickAccessGrid}>
//                 {TEAM_OPTIONS.map((option) => {
//                   const openCategory = () =>
//                     router.push({
//                       pathname: "/my-team/[category]",
//                       params: { category: option.id },
//                     });
//                   const count = members.filter(option.matches).length;
//                   const tone = getToneColor(option.tone, colors);
//                   const isTotal = option.id === "total";

//                   const label = isTotal
//                     ? "Total Employees"
//                     : option.id === "on-leave"
//                       ? "On Leave"
//                       : option.title;

//                   const icon = isTotal
//                     ? "people-outline"
//                     : option.id === "present"
//                       ? "checkmark-circle-outline"
//                       : option.id === "absent"
//                         ? "person-remove-outline"
//                         : "calendar-outline";
//                   const statusBackground =
//                     option.id === "present"
//                       ? theme === "dark"
//                         ? "#103D30"
//                         : "#F0FAF4"
//                       : option.id === "absent"
//                         ? theme === "dark"
//                           ? "#45232A"
//                           : "#FFF1F2"
//                         : theme === "dark"
//                           ? "#49340F"
//                           : "#FFF8E9";

//                   const statusIconBackground =
//                     option.id === "present"
//                       ? theme === "dark"
//                         ? "#087A4D"
//                         : "#D7F1E1"
//                       : option.id === "absent"
//                         ? theme === "dark"
//                           ? "#B93645"
//                           : "#FADBDD"
//                         : theme === "dark"
//                           ? "#A96A00"
//                           : "#FBE8C7";

//                   const statusIconForeground =
//                     theme === "dark"
//                       ? colors.white
//                       : option.id === "present"
//                         ? "#166534"
//                         : option.id === "absent"
//                           ? "#991B1B"
//                           : "#92400E";

//                   const statusBorderColor =
//                     theme === "dark"
//                       ? tone.foreground
//                       : option.id === "present"
//                         ? "#CDE9D7"
//                         : option.id === "absent"
//                           ? "#F3CDD1"
//                           : "#F1DDB8";

//                   const statusTextColor =
//                     theme === "dark"
//                       ? colors.white
//                       : option.id === "present"
//                         ? "#166534"
//                         : option.id === "absent"
//                           ? "#991B1B"
//                           : "#92400E";

//                   return isTotal ? (
//                     <Pressable
//                       key={option.id}
//                       onPress={openCategory}
//                       style={({ pressed }) => [
//                         styles.totalCard,
//                         pressed && { opacity: 0.82 },
//                       ]}
//                       accessibilityRole="button"
//                       accessibilityLabel={`${label}: ${count}`}
//                     >
//                       <View style={styles.totalIcon}>
//                         <Ionicons name={icon} size={30} color={colors.white} />
//                       </View>

//                       <View style={styles.totalText}>
//                         <Text style={styles.totalEyebrow}>TEAM SIZE</Text>

//                         <View style={styles.totalCountRow}>
//                           <Text style={styles.totalCount}>{count}</Text>
//                           <Text style={styles.totalLabel}>{label}</Text>
//                         </View>
//                       </View>

//                       <View style={styles.totalArtwork}>
//                         <Ionicons
//                           name="people"
//                           size={86}
//                           color={theme === "dark" ? "#A99AFF" : "#8B78F0"}
//                         />
//                       </View>
//                     </Pressable>
//                   ) : (
//                     <Pressable
//                       key={option.id}
//                       onPress={openCategory}
//                       style={({ pressed }) => [
//                         styles.statusCard,
//                         {
//                           backgroundColor: statusBackground,
//                           borderColor: statusBorderColor,
//                         },
//                         pressed && { opacity: 0.82 },
//                       ]}
//                       accessibilityRole="button"
//                       accessibilityLabel={`${label}: ${count}`}
//                     >
//                       <View style={styles.statusTopRow}>
//                         <Text
//                           style={[
//                             styles.statusCount,
//                             { color: statusTextColor },
//                           ]}
//                         >
//                           {count}
//                         </Text>
//                       </View>

//                       <Text
//                         style={[styles.statusLabel, { color: statusTextColor }]}
//                       >
//                         {label}
//                       </Text>
//                     </Pressable>
//                   );
//                 })}
//               </View>
//             </View>
//           </>
//         )}
//       </View>
//       <DashboardNotifications scope="team" />
//     </View>
//   );
// }

// function createStyles(colors: TeamColors) {
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

//     sectionTitle: {
//       fontSize: 19,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     sectionSubtitle: {
//       marginTop: 4,
//       fontSize: 12,
//       color: colors.textSecondary,
//     },

//     optionTextContent: {
//       flex: 1,
//       minWidth: 0,
//       marginLeft: 13,
//       marginRight: 10,
//     },

//     overviewHeader: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 11,
//       marginBottom: 15,
//     },

//     overviewHeadingIcon: {
//       width: 40,
//       height: 40,
//       borderRadius: 13,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },
//     overviewTitle: {
//       fontSize: 18,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     overviewCard: {
//       backgroundColor: colors.primaryLight,
//       borderRadius: 22,
//       borderWidth: 1,
//       borderColor: colors.border,
//       paddingHorizontal: 7,
//       paddingVertical: 14,
//       shadowColor: colors.black,
//       shadowOffset: { width: 0, height: 4 },
//       shadowOpacity: 0.05,
//       shadowRadius: 10,
//       elevation: 2,
//     },

//     metricsRow: {
//       flexDirection: "row",
//       alignItems: "stretch",
//     },

//     metricColumn: {
//       flex: 1,
//       minWidth: 0,
//       position: "relative",
//     },

//     metricContent: {
//       flex: 1,
//       minHeight: 126,
//       alignItems: "center",
//       justifyContent: "center",
//       paddingHorizontal: 2,
//       gap: 8,
//     },

//     metricIcon: {
//       width: 44,
//       height: 44,
//       borderRadius: 22,
//       alignItems: "center",
//       justifyContent: "center",
//     },
//     metricIconBadge: {
//       position: "absolute",
//       right: -5,
//       bottom: -5,
//       backgroundColor: colors.surface,
//       borderRadius: 10,
//     },
//     metricCount: {
//       fontSize: 22,
//       lineHeight: 27,
//       fontWeight: "900",
//       textAlign: "center",
//     },
//     metricLabel: {
//       fontSize: 10,
//       lineHeight: 14,
//       fontWeight: "700",
//       color: colors.textSecondary,
//       textAlign: "center",
//     },
//     metricDivider: {
//       position: "absolute",
//       right: 0,
//       top: 15,
//       bottom: 15,
//       width: 1,
//       backgroundColor: colors.border,
//       opacity: 0.7,
//     },
//     quickAccessSection: {
//       flex: 1,
//       minHeight: 0,
//       marginTop: 0,
//     },
//     quickAccessHeader: {
//       marginBottom: 13,
//     },

//     quickAccessGrid: {
//       flex: 1,
//       alignContent: "flex-start",
//       flexDirection: "row",
//       flexWrap: "wrap",
//       justifyContent: "space-between",
//       rowGap: 8,
//     },
//     totalCard: {
//       width: "100%",
//       height: "45%",
//       minHeight: 92,
//       position: "relative",
//       overflow: "hidden",
//       flexDirection: "row",
//       alignItems: "center",
//       padding: 16,
//       gap: 14,
//       borderRadius: 22,
//       backgroundColor: colors.primaryLight,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     totalIcon: {
//       width: 56,
//       height: 56,
//       borderRadius: 17,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primary,
//     },

//     totalCount: {
//       fontSize: 35,
//       lineHeight: 40,
//       fontWeight: "900",
//       color: colors.textPrimary,
//     },

//     totalLabel: {
//       fontSize: 14,
//       lineHeight: 18,
//       fontWeight: "700",
//       color: colors.textSecondary,
//     },

//     statusCard: {
//       width: "23.5%",
//       height: "48%",
//       minHeight: 82,
//       alignItems: "center",
//       justifyContent: "center",
//       paddingHorizontal: 7,
//       paddingVertical: 10,
//       borderRadius: 16,
//       borderWidth: 1,
//       borderColor: colors.border,
//       gap: 8,
//     },

//     statusTopRow: {
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "center",
//       gap: 9,
//     },
//     statusIcon: {
//       width: 33,
//       height: 33,
//       borderRadius: 8,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.surface,
//     },
//     statusCount: {
//       fontSize: 27,
//       lineHeight: 33,
//       fontWeight: "900",
//       textAlign: "center",
//     },
//     statusLabel: {
//       fontSize: 11,
//       lineHeight: 15,
//       fontWeight: "700",
//       color: colors.textPrimary,
//       textAlign: "center",
//       flexShrink: 1,
//     },
//     quickAccessCard: {
//       width: "48%",
//       minHeight: 96,
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "flex-start",
//       paddingVertical: 11,
//       paddingHorizontal: 11,
//       borderRadius: 17,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//       gap: 10,
//     },
//     quickAccessTopRow: {
//       width: "100%",
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//     },

//     quickAccessPressed: {
//       opacity: 0.82,
//       transform: [{ scale: 0.98 }],
//     },

//     totalText: {
//       flex: 1,
//       minWidth: 0,
//       justifyContent: "center",
//       gap: 4,
//     },

//     totalCountRow: {
//       flexDirection: "row",
//       alignItems: "baseline",
//       flexWrap: "wrap",
//       gap: 9,
//     },

//     totalArtwork: {
//       position: "absolute",
//       right: 12,
//       bottom: -8,
//       opacity: 0.22,
//     },

//     totalEyebrow: {
//       fontSize: 10,
//       lineHeight: 14,
//       fontWeight: "800",
//       letterSpacing: 1,
//       color: colors.primary,
//     },

//     quickAccessIcon: {
//       width: 40,
//       height: 40,
//       borderRadius: 12,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },
//     quickAccessArrow: {
//       width: 32,
//       height: 32,
//       borderRadius: 16,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     quickAccessCount: {
//       fontSize: 22,
//       lineHeight: 26,
//       fontWeight: "800",
//       color: colors.textPrimary,
//       textAlign: "left",
//     },
//     quickAccessText: {
//       flex: 1,
//       minWidth: 0,
//       gap: 3,
//     },
//     quickAccessLabel: {
//       fontSize: 10,
//       lineHeight: 14,
//       fontWeight: "600",
//       color: colors.textSecondary,
//       textAlign: "left",
//     },
//     optionSubtitle: {
//       marginTop: 3,
//       fontSize: 11,
//       lineHeight: 16,
//       color: colors.textSecondary,
//     },

//     stateContainer: {
//       minHeight: 280,
//       alignItems: "center",
//       justifyContent: "center",
//       paddingHorizontal: 25,
//       paddingVertical: 35,
//       borderRadius: 18,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     stateTitle: {
//       marginTop: 13,
//       fontSize: 17,
//       fontWeight: "800",
//       color: colors.textPrimary,
//       textAlign: "center",
//     },

//     stateMessage: {
//       marginTop: 8,
//       fontSize: 13,
//       lineHeight: 20,
//       color: colors.textSecondary,
//       textAlign: "center",
//     },

//     retryButton: {
//       marginTop: 17,
//       paddingHorizontal: 20,
//       paddingVertical: 11,
//       borderRadius: 12,
//       backgroundColor: colors.primary,
//     },

//     retryText: {
//       fontSize: 13,
//       fontWeight: "800",
//       color: colors.white,
//     },

//     todayOverviewCard: {
//       position: "relative",
//       overflow: "hidden",
//       padding: 16,
//       borderRadius: 22,
//       backgroundColor: "#1252A5",
//       minHeight: 150,
//       marginBottom: 20,
//     },

//     todayOverviewDecoration: {
//       position: "absolute",
//       width: 180,
//       height: 180,
//       borderRadius: 90,
//       backgroundColor: "rgba(255,255,255,0.07)",
//       top: -100,
//       right: -55,
//     },

//     todayOverviewTitle: {
//       fontSize: 14,
//       fontWeight: "800",
//       color: "#FFFFFF",
//       marginBottom: 17,
//     },

//     metricItem: {
//       flex: 1,
//       minWidth: 0,
//       alignItems: "center",
//       justifyContent: "center",
//       paddingHorizontal: 2,
//       gap: 6,
//     },

//     metricValue: {
//       fontSize: 21,
//       lineHeight: 25,
//       fontWeight: "900",
//       color: "#FFFFFF",
//     },
//   });
// }

import FeatureUnavailableScreen from "./FeatureUnavailableScreen";

export default function MyTeamSection(_props: { reservedHeight: number }) {
  return <FeatureUnavailableScreen feature="My Team" />;
}