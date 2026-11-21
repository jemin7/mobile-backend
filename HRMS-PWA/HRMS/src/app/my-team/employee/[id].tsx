// import { Ionicons } from "@expo/vector-icons";
// import { useLocalSearchParams, useRouter } from "expo-router";
// import {
//   ActivityIndicator,
//   Image,
//   Pressable,
//   RefreshControl,
//   ScrollView,
//   StyleSheet,
//   View,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useState, type ComponentProps } from "react";

// import { AppText as Text } from "../../../components/InterTypography";
// import type { TeamAttendanceMember } from "../../../api/team";
// import { useManagerTeamDirectory } from "../../../hooks/useManagerTeamDirectory";
// import { useTheme } from "../../../theme/ThemeProvider";

// type TeamColors = ReturnType<typeof useTheme>["colors"];

// function getEmployeeName(member: TeamAttendanceMember) {
//   const name = [member.employeeFirstName, member.employeeLastName]
//     .filter(Boolean)
//     .join(" ")
//     .trim();

//   return name || member.employeeID || `Employee #${member.id}`;
// }

// function getMemberStatus(member: TeamAttendanceMember) {
//   if (member.isOnLeaveToday) return "On Leave";
//   if (member.isLateArrival) return "Late Arrival";
//   if (member.isAbsentToday) return "Absent";

//   if (member.statusLabel?.trim()) {
//     return member.statusLabel.trim();
//   }

//   return member.isCheckedIn ? "Checked in" : "Yet to check-in";
// }

// function getStatusTone(status: string, colors: TeamColors) {
//   if (status === "Checked in") {
//     return {
//       foreground: colors.success,
//       background: colors.successBackground,
//     };
//   }

//   if (status === "Checked out") {
//     return {
//       foreground: colors.primary,
//       background: colors.primaryLight,
//     };
//   }

//   if (status === "Absent") {
//     return {
//       foreground: colors.danger,
//       background: colors.dangerBackground,
//     };
//   }

//   return {
//     foreground: colors.warning,
//     background: colors.warningBackground,
//   };
// }

// function formatPunchTime(value?: string | null) {
//   if (!value) return "—";

//   const date = new Date(value);

//   if (Number.isNaN(date.getTime())) return "—";

//   return date.toLocaleTimeString("en-IN", {
//     hour: "2-digit",
//     minute: "2-digit",
//   });
// }

// function formatJoiningDate(value?: string | null) {
//   if (!value) return "—";

//   const date = new Date(`${value.slice(0, 10)}T00:00:00`);

//   if (Number.isNaN(date.getTime())) return "—";

//   return date.toLocaleDateString("en-IN", {
//     day: "2-digit",
//     month: "short",
//     year: "numeric",
//   });
// }

// export default function EmployeeDetailsScreen() {
//   const router = useRouter();

//   const params = useLocalSearchParams<{
//     id?: string | string[];
//     status?: string | string[];
//   }>();
//   const employeeId = Number(
//     Array.isArray(params.id) ? params.id[0] : params.id,
//   );

//   const { colors } = useTheme();
//   const styles = createStyles(colors);

//   const { members, isLoading, isError, error, isRefetching, refetch } =
//     useManagerTeamDirectory();

//   const [photoError, setPhotoError] = useState(false);

//   const member = members.find((employee) => employee.id === employeeId);

//   const handleBack = () => {
//     if (router.canGoBack()) {
//       router.back();
//     } else {
//       router.replace("/my-team/total");
//     }
//   };

//   if (isLoading) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.stateContainer}>
//           <ActivityIndicator size="large" color={colors.primary} />
//           <Text style={styles.stateMessage}>Loading employee details…</Text>
//         </View>
//       </SafeAreaView>
//     );
//   }

//   if (isError || !member) {
//     return (
//       <SafeAreaView style={styles.container}>
//         <View style={styles.header}>
//           <Pressable onPress={handleBack} style={styles.backButton}>
//             <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//           </Pressable>

//           <Text style={styles.headerTitle}>Employee Details</Text>
//         </View>

//         <View style={styles.stateContainer}>
//           <Ionicons
//             name="person-outline"
//             size={38}
//             color={colors.textSecondary}
//           />

//           <Text style={styles.stateTitle}>
//             {isError ? "Couldn't load employee" : "Employee not found"}
//           </Text>

//           <Text style={styles.stateMessage}>
//             {isError && error instanceof Error
//               ? error.message
//               : "This employee information is currently unavailable."}
//           </Text>

//           {isError && (
//             <Pressable
//               onPress={() => void refetch()}
//               style={styles.retryButton}
//             >
//               <Text style={styles.retryText}>Try Again</Text>
//             </Pressable>
//           )}
//         </View>
//       </SafeAreaView>
//     );
//   }

//   const name = getEmployeeName(member);

//   const routeStatus = Array.isArray(params.status)
//     ? params.status[0]
//     : params.status;

//   const status =
//     routeStatus === "On Leave" || routeStatus === "Late Arrival"
//       ? routeStatus
//       : getMemberStatus(member);

//   const tone = getStatusTone(status, colors);

//   return (
//     <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//         refreshControl={
//           <RefreshControl
//             refreshing={isRefetching && !isLoading}
//             onRefresh={() => void refetch()}
//             tintColor={colors.primary}
//             colors={[colors.primary]}
//           />
//         }
//       >
//         <View style={styles.header}>
//           <Pressable
//             onPress={handleBack}
//             style={styles.backButton}
//             accessibilityRole="button"
//             accessibilityLabel="Go back to employees"
//           >
//             <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//           </Pressable>

//           <Text style={styles.headerTitle}>Employee Details</Text>
//         </View>

//         {/* Employee Profile */}
//         <View style={styles.profileCard}>
//           <View style={styles.avatar}>
//             {member.employeePhotoUrl && !photoError ? (
//               <Image
//                 source={{ uri: member.employeePhotoUrl }}
//                 style={styles.avatarImage}
//                 onError={() => setPhotoError(true)}
//               />
//             ) : (
//               <Ionicons
//                 name="person-outline"
//                 size={38}
//                 color={colors.primary}
//               />
//             )}
//           </View>

//           <Text style={styles.employeeName}>{name}</Text>

//           <Text style={styles.employeeId}>
//             {member.employeeID
//               ? `ID: ${member.employeeID}`
//               : `Employee #${member.id}`}
//           </Text>

//           {member.designation ? (
//             <Text style={styles.designation}>{member.designation}</Text>
//           ) : null}

//           <View
//             style={[styles.statusBadge, { backgroundColor: tone.background }]}
//           >
//             <View
//               style={[styles.statusDot, { backgroundColor: tone.foreground }]}
//             />

//             <Text style={[styles.statusText, { color: tone.foreground }]}>
//               {status}
//             </Text>
//           </View>
//         </View>

//         {/* Today's Attendance */}
//         <View style={styles.section}>
//           <View style={styles.sectionHeading}>
//             <View style={styles.sectionIcon}>
//               <Ionicons name="time-outline" size={19} color={colors.primary} />
//             </View>

//             <Text style={styles.sectionTitle}>Today's Attendance</Text>
//           </View>

//           <View style={styles.attendanceCard}>
//             <View style={styles.attendanceItem}>
//               <View style={styles.attendanceLabel}>
//                 <Ionicons
//                   name="log-in-outline"
//                   size={18}
//                   color={colors.success}
//                 />
//                 <Text style={styles.infoLabel}>Punch In</Text>
//               </View>

//               <Text style={styles.attendanceTime}>
//                 {formatPunchTime(member.checkInTime)}
//               </Text>
//             </View>

//             <View style={styles.attendanceDivider} />

//             <View style={styles.attendanceItem}>
//               <View style={styles.attendanceLabel}>
//                 <Ionicons
//                   name="log-out-outline"
//                   size={18}
//                   color={colors.danger}
//                 />
//                 <Text style={styles.infoLabel}>Punch Out</Text>
//               </View>

//               <Text style={styles.attendanceTime}>
//                 {formatPunchTime(member.checkOutTime)}
//               </Text>
//             </View>
//           </View>
//         </View>

//         {/* Employee Information */}
//         <View style={styles.section}>
//           <View style={styles.sectionHeading}>
//             <View style={styles.sectionIcon}>
//               <Ionicons
//                 name="person-circle-outline"
//                 size={19}
//                 color={colors.primary}
//               />
//             </View>

//             <Text style={styles.sectionTitle}>Employee Information</Text>
//           </View>

//           <View style={styles.infoCard}>
//             <InfoRow
//               icon="id-card-outline"
//               label="Employee ID"
//               value={member.employeeID}
//               colors={colors}
//               styles={styles}
//             />

//             <InfoRow
//               icon="business-outline"
//               label="Department"
//               value={member.departmentName}
//               colors={colors}
//               styles={styles}
//             />

//             <InfoRow
//               icon="briefcase-outline"
//               label="Designation"
//               value={member.designation}
//               colors={colors}
//               styles={styles}
//             />

//             <InfoRow
//               icon="mail-outline"
//               label="Business Email"
//               value={member.email}
//               colors={colors}
//               styles={styles}
//             />

//             <InfoRow
//               icon="calendar-outline"
//               label="Joining Date"
//               value={formatJoiningDate(member.joiningDate)}
//               colors={colors}
//               styles={styles}
//               last
//             />
//           </View>
//         </View>
//       </ScrollView>
//     </SafeAreaView>
//   );
// }

// type InfoRowProps = {
//   icon: ComponentProps<typeof Ionicons>["name"];
//   label: string;
//   value?: string | null;
//   colors: TeamColors;
//   styles: ReturnType<typeof createStyles>;
//   last?: boolean;
// };

// function InfoRow({
//   icon,
//   label,
//   value,
//   colors,
//   styles,
//   last = false,
// }: InfoRowProps) {
//   return (
//     <View style={[styles.infoRow, !last && styles.infoRowDivider]}>
//       <View style={styles.infoIcon}>
//         <Ionicons name={icon} size={18} color={colors.textSecondary} />
//       </View>

//       <View style={styles.infoContent}>
//         <Text style={styles.infoLabel}>{label}</Text>
//         <Text style={styles.infoValue}>{value?.trim() || "Not available"}</Text>
//       </View>
//     </View>
//   );
// }

// function createStyles(colors: TeamColors) {
//   return StyleSheet.create({
//     container: {
//       flex: 1,
//       backgroundColor: colors.background,
//     },

//     content: {
//       paddingHorizontal: 17,
//       paddingTop: 10,
//       paddingBottom: 40,
//     },

//     header: {
//       flexDirection: "row",
//       alignItems: "center",
//       marginBottom: 20,
//       gap: 12,
//     },

//     backButton: {
//       width: 44,
//       height: 44,
//       borderRadius: 14,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     headerTitle: {
//       fontSize: 19,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     profileCard: {
//       alignItems: "center",
//       padding: 22,
//       borderRadius: 22,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     avatar: {
//       width: 88,
//       height: 88,
//       borderRadius: 30,
//       alignItems: "center",
//       justifyContent: "center",
//       overflow: "hidden",
//       backgroundColor: colors.primaryLight,
//       marginBottom: 14,
//     },

//     avatarImage: {
//       width: "100%",
//       height: "100%",
//     },

//     employeeName: {
//       fontSize: 20,
//       lineHeight: 27,
//       fontWeight: "900",
//       color: colors.textPrimary,
//       textAlign: "center",
//     },

//     employeeId: {
//       marginTop: 5,
//       fontSize: 12,
//       color: colors.textSecondary,
//     },

//     designation: {
//       marginTop: 7,
//       fontSize: 13,
//       fontWeight: "600",
//       color: colors.textSecondary,
//       textAlign: "center",
//     },

//     statusBadge: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 7,
//       marginTop: 14,
//       paddingHorizontal: 13,
//       paddingVertical: 8,
//       borderRadius: 20,
//     },

//     statusDot: {
//       width: 7,
//       height: 7,
//       borderRadius: 4,
//     },

//     statusText: {
//       fontSize: 11,
//       fontWeight: "800",
//     },

//     section: {
//       marginTop: 23,
//     },

//     sectionHeading: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 10,
//       marginBottom: 12,
//     },

//     sectionIcon: {
//       width: 36,
//       height: 36,
//       borderRadius: 12,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.primaryLight,
//     },

//     sectionTitle: {
//       fontSize: 16,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     attendanceCard: {
//       flexDirection: "row",
//       alignItems: "center",
//       padding: 17,
//       borderRadius: 18,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     attendanceItem: {
//       flex: 1,
//       gap: 9,
//     },

//     attendanceLabel: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 7,
//     },

//     attendanceTime: {
//       fontSize: 20,
//       fontWeight: "900",
//       color: colors.textPrimary,
//     },

//     attendanceDivider: {
//       width: 1,
//       height: 48,
//       backgroundColor: colors.border,
//       marginHorizontal: 14,
//     },

//     infoCard: {
//       paddingHorizontal: 15,
//       borderRadius: 18,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },

//     infoRow: {
//       flexDirection: "row",
//       alignItems: "center",
//       gap: 12,
//       paddingVertical: 15,
//     },

//     infoRowDivider: {
//       borderBottomWidth: 1,
//       borderBottomColor: colors.border,
//     },

//     infoIcon: {
//       width: 36,
//       height: 36,
//       borderRadius: 11,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.surfaceSecondary,
//     },

//     infoContent: {
//       flex: 1,
//       gap: 4,
//     },

//     infoLabel: {
//       fontSize: 11,
//       fontWeight: "600",
//       color: colors.textSecondary,
//     },

//     infoValue: {
//       fontSize: 13,
//       fontWeight: "700",
//       color: colors.textPrimary,
//     },

//     stateContainer: {
//       flex: 1,
//       alignItems: "center",
//       justifyContent: "center",
//       padding: 25,
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
//   });
// }

import FeatureUnavailableScreen from "../../../components/FeatureUnavailableScreen";

export default function TeamEmployeeScreen() {
  return <FeatureUnavailableScreen feature="Team employee details" />;
}