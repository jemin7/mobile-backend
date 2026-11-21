import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText as Text } from "./InterTypography";

import { useTheme } from "../theme/ThemeProvider";
import HomeSectionMenu, { type HomeSection } from "./HomeSectionMenu";
// import { useManagerScope } from "../hooks/useManagerScope";
import HomeNavigationDrawer from "./HomeNavigationDrawer";
type HomeHeaderProps = {
  photoUri?: string | null;
  userName: string;
  initials: string;
  onProfilePress?: () => void;
  onCalendarPress?: () => void;
  activeSection: HomeSection;
  onSectionSelect: (section: HomeSection) => void;
  onDrawerNavigate: () => void;
};

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 17) {
    return "Good afternoon";
  }

  return "Good evening";
}

export default function HomeHeader({
  userName,
  initials,
  photoUri,
  onProfilePress,
  onCalendarPress,
  activeSection,
  onSectionSelect,
  onDrawerNavigate,
}: HomeHeaderProps) {
  const { colors } = useTheme();
  // const { hasReportees } = useManagerScope();

  const styles = createStyles(colors);
  const greeting = getGreeting();

  return (
    <View style={styles.container}>
      {/* Left: navigation actions */}
      <View style={styles.profileGroup}>
        <Pressable
          onPress={onProfilePress}
          style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarText}>{initials}</Text>
          )}
        </Pressable>
        <View style={styles.textContainer}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting},
          </Text>

          <Text
            style={styles.name}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            ellipsizeMode="tail"
          >
            {userName}
          </Text>
        </View>
      </View>

      {/* Right: employee identity */}

      {/* Right side - evenly spaced navigation buttons */}
      <View style={styles.actions}>
        {/* {hasReportees && (
          <HomeSectionMenu
            activeSection={activeSection}
            onSelect={onSectionSelect}
          />
        )} */}

        <Pressable
          onPress={onCalendarPress}
          style={({ pressed }) => [
            styles.calendarButton,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Calendar"
        >
          <Ionicons name="calendar-outline" size={21} color={colors.primary} />
        </Pressable>
        <HomeNavigationDrawer
          onNavigate={onDrawerNavigate}
          userName={userName}
          initials={initials}
          photoUri={photoUri}
          // hasReportees={hasReportees}
          showManagement={true}
        />
      </View>
    </View>
  );
}

function createStyles(colors: {
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  primaryLight: string;
  white: string;
}) {
  return StyleSheet.create({
    container: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 72,
      marginBottom: 2,
    },

    actions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 6,
      flexShrink: 0,
      marginLeft: 8,
      marginRight: -7,
    },
    calendarButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    profileGroup: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      gap: 10,
    },

    textContainer: {
      flex: 1,
      minWidth: 0,
      alignItems: "flex-start",
    },
    greeting: {
      fontSize: 13,
      fontWeight: "500",
      color: colors.textSecondary,
      marginBottom: 3,
    },

    name: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
      letterSpacing: -0.4,
    },

    avatar: {
      overflow: "hidden",
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    avatarImage: {
      width: 48,
      height: 48,
      borderRadius: 24,
    },

    avatarText: {
      fontSize: 15,
      fontWeight: "800",

      color: colors.white,
    },

    pressed: {
      opacity: 0.7,
    },
  });
}
