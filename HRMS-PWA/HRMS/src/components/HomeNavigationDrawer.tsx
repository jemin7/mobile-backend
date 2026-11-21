import { Ionicons } from "@expo/vector-icons";
import { useRouter, usePathname } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText as Text } from "./InterTypography";
import { useTheme } from "../theme/ThemeProvider";
type DrawerRoute =
  | "/(tabs)/tasks"
  | "/notifications"
  | "/(tabs)/loan"
  | "/(tabs)/reimbursement"
  | "/(tabs)/payout"
  | "/approvals"
  | "/my-team"
  | "/my-reportees"
  | "/manager-roster";

type DrawerItem = {
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: DrawerRoute;
  activePath?: string;
};

type DrawerGroup = {
  title: string;
  items: DrawerItem[];
};

type Props = {
  userName: string;
  initials: string;
  photoUri?: string | null;
  showManagement: boolean;
  onNavigate: () => void;
};

const MAIN_GROUPS: DrawerGroup[] = [
  {
    title: "WORK",
    items: [
      {
        label: "Tasks",
        description: "View your assigned tasks",
        icon: "checkbox-outline",
        href: "/(tabs)/tasks",
        activePath: "/tasks",
      },
      {
        label: "Reimbursement",
        description: "View your reimbursement requests",
        icon: "cash-outline",
        href: "/(tabs)/reimbursement",
        activePath: "/reimbursement",
      },
      {
        label: "Payslips",
        description: "View and download payslips",
        icon: "receipt-outline",
        href: "/(tabs)/payout",
        activePath: "/payout",
      },

      {
        label: "Loans & Advances",
        description: "View your loan requests",
        icon: "wallet-outline",
        href: "/(tabs)/loan",
        activePath: "/loan",
      },
    ],
  },
];

const MANAGEMENT_GROUP: DrawerGroup = {
  title: "MANAGEMENT",
  items: [
    {
      label: "Approvals",
      description: "Review team requests",
      icon: "checkmark-done-outline",
      href: "/approvals",
    },
    {
      label: "Roster",
      description: "Manage team shifts and days off",
      icon: "calendar-outline",
      href: "/manager-roster",
    },
  ],
};

export default function HomeNavigationDrawer({
  userName,
  initials,
  photoUri,
  showManagement,
  onNavigate,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const drawerWidth = Math.min(width * 0.84, 320);
  const [visible, setVisible] = useState(false);
  const slideX = useRef(new Animated.Value(-320)).current;

  const styles = createStyles(colors);

  // const groups = hasReportees
  //   ? [...MAIN_GROUPS, MANAGEMENT_GROUP]
  //   : MAIN_GROUPS;

  const groups = showManagement
    ? [...MAIN_GROUPS, MANAGEMENT_GROUP]
    : MAIN_GROUPS;
  useEffect(() => {
    if (!visible) return;

    const animation = Animated.timing(slideX, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [visible, slideX]);

  const openDrawer = () => {
    slideX.setValue(-drawerWidth);
    setVisible(true);
  };

  const closeDrawer = (afterClose?: () => void) => {
    Animated.timing(slideX, {
      toValue: -drawerWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setVisible(false);
        afterClose?.();
      }
    });
  };

  const openDestination = (href: DrawerRoute) => {
    onNavigate();
    closeDrawer(() => router.push(href));
  };

  return (
    <>
      <Pressable
        onPress={openDrawer}
        style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Open navigation menu"
      >
        <Ionicons name="menu-outline" size={25} color={colors.textPrimary} />
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => closeDrawer()}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closeDrawer()}
            accessibilityRole="button"
            accessibilityLabel="Close navigation menu"
          />

          <Animated.View
            style={[
              styles.drawer,
              {
                width: drawerWidth,
                paddingTop: Math.max(insets.top, 12) + 12,
                paddingBottom: Math.max(insets.bottom, 12) + 12,
                transform: [{ translateX: slideX }],
              },
            ]}
          >
            <View style={styles.drawerHeading}>
              <View>
                <Text style={styles.drawerHeadingTitle}>Your workspace</Text>
              </View>

              <Pressable
                onPress={() => closeDrawer()}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <Ionicons
                  name="close-outline"
                  size={23}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>
            <View style={styles.profileHeader}>
              <View style={styles.profileAvatar}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.profileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.profileInitials}>{initials}</Text>
                )}
              </View>

              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {userName}
                </Text>
                <Text style={styles.profileSubtitle}>Employee workspace</Text>
              </View>
            </View>

            <ScrollView
              style={styles.menuScroll}
              contentContainerStyle={styles.menuContent}
              showsVerticalScrollIndicator={false}
            >
              {groups.map((group) => (
                <View key={group.title} style={styles.group}>
                  <View style={styles.groupHeading}>
                    <Text style={styles.groupTitle}>{group.title}</Text>
                    <View style={styles.groupDivider} />
                  </View>

                  <View style={styles.groupItems}>
                    {group.items.map((item) => {
                      const selected =
                        pathname === item.href ||
                        pathname === item.activePath ||
                        pathname.startsWith(`${item.href}/`);
                      return (
                        <Pressable
                          key={item.href}
                          onPress={() => openDestination(item.href)}
                          style={({ pressed }) => [
                            styles.menuItem,
                            selected && styles.menuItemSelected,
                            pressed && styles.pressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={item.label}
                          accessibilityState={{ selected }}
                        >
                          <View
                            style={[
                              styles.itemIcon,
                              selected && styles.itemIconSelected,
                            ]}
                          >
                            <Ionicons
                              name={item.icon}
                              size={20}
                              color={
                                selected ? colors.primary : colors.textSecondary
                              }
                            />
                          </View>

                          <Text
                            style={[
                              styles.itemTitle,
                              selected && styles.itemTitleSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {item.label}
                          </Text>

                          {selected ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color={colors.primary}
                            />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function createStyles(colors: {
  surface: string;
  surfaceSecondary: string;
  border: string;
  primary: string;
  primaryLight: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  white: string;
}) {
  return StyleSheet.create({
    menuButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    modalRoot: {
      flex: 1,
      flexDirection: "row",
      backgroundColor: "rgba(0,0,0,0.32)",
    },

    drawer: {
      height: "100%",
      paddingHorizontal: 16,
      backgroundColor: colors.surface,
      borderTopRightRadius: 24,
      borderBottomRightRadius: 24,
      borderRightWidth: 1,
      borderColor: colors.border,
      elevation: 18,
      shadowColor: "#000",
      shadowOffset: { width: 4, height: 0 },
      shadowOpacity: 0.18,
      shadowRadius: 15,
    },

    groupHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 9,
    },

    groupDivider: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    drawerHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    drawerHeadingTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    closeButton: {
      width: 48,
      height: 48,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },

    profileHeader: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
      marginBottom: 8,
      borderRadius: 20,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 12,
    },

    profileAvatar: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      backgroundColor: colors.primary,
    },
    profileImage: {
      width: 52,
      height: 52,
      borderRadius: 26,
    },

    profileInitials: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.white,
    },

    profileInfo: {
      flex: 1,
      minWidth: 0,
    },

    profileName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    profileSubtitle: {
      marginTop: 4,
      fontSize: 11,
      color: colors.textSecondary,
    },

    menuScroll: {
      flex: 1,
    },

    menuContent: {
      paddingBottom: 16,
    },

    group: {
      marginTop: 20,
    },
    groupTitle: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      color: colors.textMuted,
    },

    groupItems: {
      gap: 6,
    },

    menuItem: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 15,
      gap: 12,
    },

    menuItemSelected: {
      backgroundColor: colors.primaryLight,
    },

    itemIcon: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },
    itemIconSelected: {
      backgroundColor: colors.surface,
    },

    itemTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    itemTitleSelected: {
      color: colors.primary,
    },

    pressed: {
      opacity: 0.7,
    },
  });
}
