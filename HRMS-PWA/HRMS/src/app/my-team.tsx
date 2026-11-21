// import { Ionicons } from "@expo/vector-icons";
// import { useRouter } from "expo-router";
// import {
//   ActivityIndicator,
//   Pressable,
//   ScrollView,
//   StyleSheet,
//   View,
// } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";

// import { AppText as Text } from "../components/InterTypography";
// import { useManagerTeamMembers } from "../hooks/useManagerTeamMembers";
// import { TEAM_OPTIONS, type TeamOption } from "../teamOptions";
// import HomeSectionMenu from "../components/HomeSectionMenu";
// import { useTheme } from "../theme/ThemeProvider";

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

// export default function MyTeamScreen() {
//   const router = useRouter();
//   const { colors } = useTheme();

//   const styles = createStyles(colors);

//   const { members, isLoading, isError, error, refetch } =
//     useManagerTeamMembers();
//   const handleBack = () => {
//     if (router.canGoBack()) {
//       router.back();
//     } else {
//       router.replace("/(tabs)");
//     }
//   };

//   const openTeamCategory = (category: string) => {
//     router.push({
//       pathname: "/my-team/[category]",
//       params: { category },
//     });
//   };

//   return (
//     <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
//       <ScrollView
//         contentContainerStyle={styles.content}
//         showsVerticalScrollIndicator={false}
//       >
//         {/* Header */}
//         <View style={styles.header}>
//           <Pressable
//             onPress={handleBack}
//             style={({ pressed }) => [
//               styles.backButton,
//               pressed && styles.pressed,
//             ]}
//             accessibilityRole="button"
//             accessibilityLabel="Go back"
//           >
//             <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
//           </Pressable>

//           <View style={styles.headerText}>
//             <Text style={styles.title}>My Team</Text>
//             <Text style={styles.subtitle}>Manage and view your team</Text>
//           </View>
//           <HomeSectionMenu
//             activeSection="team"
//             onSelect={(section) => {
//               if (section === "dashboard") {
//                 router.replace("/(tabs)");
//               } else if (section === "reportees") {
//                 router.replace("/my-reportees");
//               }
//             }}
//           />
//         </View>

//         {/* Section heading */}
//         <View style={styles.sectionHeader}>
//           <Text style={styles.sectionTitle}>Team Overview</Text>
//         </View>

//         {/* Loading */}
//         {isLoading ? (
//           <View style={styles.stateContainer}>
//             <ActivityIndicator size="large" color={colors.primary} />
//             <Text style={styles.stateMessage}>Loading team information…</Text>
//           </View>
//         ) : isError ? (
//           /* Error */
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
//             {/* Dynamic option cards */}
//             {/* Dynamic full-width option cards */}
//             <View style={styles.optionsGrid}>
//               {TEAM_OPTIONS.map((option) => {
//                 const tone = getToneColor(option.tone, colors);
//                 const count = members.filter(option.matches).length;

//                 return (
//                   <Pressable
//                     key={option.id}
//                     onPress={() => openTeamCategory(option.id)}
//                     style={({ pressed }) => [
//                       styles.optionCard,
//                       pressed && styles.pressed,
//                     ]}
//                     accessibilityRole="button"
//                     accessibilityLabel={`${option.title}: ${count}`}
//                   >
//                     {/* Icon */}
//                     <View
//                       style={[
//                         styles.optionIcon,
//                         { backgroundColor: tone.background },
//                       ]}
//                     >
//                       <Ionicons
//                         name={option.icon}
//                         size={23}
//                         color={tone.foreground}
//                       />
//                     </View>

//                     {/* Option information */}
//                     <View style={styles.optionTextContent}>
//                       <Text style={styles.optionTitle}>{option.title}</Text>

//                       <Text style={styles.optionSubtitle}>
//                         {option.subtitle}
//                       </Text>
//                     </View>

//                     {/* Count */}
//                     <Text
//                       style={[styles.optionCount, { color: tone.foreground }]}
//                     >
//                       {count}
//                     </Text>
//                   </Pressable>
//                 );
//               })}
//             </View>
//           </>
//         )}
//       </ScrollView>
//     </SafeAreaView>
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
//       paddingTop: 12,
//       paddingBottom: 40,
//     },

//     header: {
//       flexDirection: "row",
//       alignItems: "center",
//       marginBottom: 27,
//     },

//     backButton: {
//       width: 42,
//       height: 42,
//       borderRadius: 14,
//       alignItems: "center",
//       justifyContent: "center",
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//       marginRight: 12,
//     },

//     headerText: {
//       flex: 1,
//     },

//     title: {
//       fontSize: 25,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     subtitle: {
//       marginTop: 4,
//       fontSize: 13,
//       color: colors.textSecondary,
//     },

//     sectionHeader: {
//       flexDirection: "row",
//       alignItems: "center",
//       justifyContent: "space-between",
//       marginBottom: 15,
//     },

//     sectionTitle: {
//       fontSize: 17,
//       fontWeight: "800",
//       color: colors.textPrimary,
//     },

//     optionCard: {
//       width: "100%",
//       minHeight: 84,
//       flexDirection: "row",
//       alignItems: "center",
//       paddingHorizontal: 15,
//       paddingVertical: 12,
//       borderRadius: 17,
//       backgroundColor: colors.surface,
//       borderWidth: 1,
//       borderColor: colors.border,
//     },
//     optionsGrid: {
//       gap: 12,
//     },

//     optionIcon: {
//       width: 46,
//       height: 46,
//       borderRadius: 14,
//       alignItems: "center",
//       justifyContent: "center",
//     },

//     optionTextContent: {
//       flex: 1,
//       minWidth: 0,
//       marginLeft: 13,
//       marginRight: 10,
//     },

//     optionCount: {
//       fontSize: 23,
//       lineHeight: 29,
//       fontWeight: "900",
//       minWidth: 30,
//       textAlign: "right",
//     },

//     optionTitle: {
//       fontSize: 14,
//       lineHeight: 20,
//       fontWeight: "800",
//       color: colors.textPrimary,
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

//     pressed: {
//       opacity: 0.78,
//     },
//   });
// }

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function MyTeamScreen() {
  return <FeatureUnavailableScreen feature="My Team" />;
}