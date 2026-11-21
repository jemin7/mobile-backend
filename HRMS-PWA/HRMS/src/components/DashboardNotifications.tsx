/*
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { AppText as Text } from "./InterTypography";
import { useNotifications } from "../hooks/useNotifications";
import { useTheme } from "../theme/ThemeProvider";
import type {
  EmployeeNotification,
  NotificationFeedScope,
} from "../api/notifications";

export default function DashboardNotifications({
  scope = "personal",
}: {
  scope?: NotificationFeedScope;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [visibleCount, setVisibleCount] = useState(3);
  const { data, isLoading, isError, refetch } = useNotifications(scope);

  const latestNotifications = useMemo(() => {
    const allNotifications = [...(data?.recent ?? []), ...(data?.older ?? [])];
    const uniqueNotifications = new Map<string, EmployeeNotification>();

    allNotifications.forEach((notification) => {
      const key = JSON.stringify([
        notification.kind,
        notification.id,
        notification.at,
        notification.subjectEmployeeId ?? null,
      ]);

      if (!uniqueNotifications.has(key)) {
        uniqueNotifications.set(key, notification);
      }
    });

    return Array.from(uniqueNotifications.values()).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [data]);

  const visibleNotifications = latestNotifications.slice(0, visibleCount);

  const openNotifications = () => {
    if (scope === "personal") {
      router.push("/notifications");
      return;
    }

    router.push({
      pathname: "/notifications",
      params: { scope },
    });
  };

  const openNotification = (notification: EmployeeNotification) => {
    const href = notification.href?.trim();
    const messageId =
      typeof notification.id === "string"
        ? /^memo-(\d+)$/i.exec(notification.id)?.[1]
        : undefined;

    const normalizedHref = href?.toLowerCase() ?? "";

    // Keep chat and memo notifications opening the chat page.
    if (
      scope !== "personal" &&
      (/\/chat(?:\/|[?#]|$)/.test(normalizedHref) ||
        /[?&]tab=messaging(?:&|$)/.test(normalizedHref) ||
        /employee[-_]?memo/.test(normalizedHref))
    ) {
      router.push({
        pathname: "/(tabs)/chat",
        ...(messageId ? { params: { messageId } } : {}),
      });
      return;
    }

    // Keep holiday notifications opening the holidays page.
    if (
      scope !== "personal" &&
      (/holiday|calendar/.test(normalizedHref) ||
        notification.kind === "holiday")
    ) {
      router.push("/holidays");
      return;
    }

    // Reportee leave approval notifications open Approvals.
    if (
      scope === "reportees" &&
      notification.kind === "leave" &&
      /approval pending|needs your approval/i.test(
        `${notification.title} ${notification.body}`,
      )
    ) {
      router.push("/approvals");
      return;
    }

    // Other team/reportee notifications open the employee profile.
    if (scope !== "personal" && notification.subjectEmployeeId) {
      router.push({
        pathname: "/my-team/employee/[id]",
        params: { id: String(notification.subjectEmployeeId) },
      });
      return;
    }

    // Personal notifications continue using normal navigation.
    const target = href ? getHrefTarget(href, messageId) : null;

    if (target) {
      navigateToTarget(router, target);
      return;
    }

    const notificationText =
      `${notification.title} ${notification.body}`.toLowerCase();

    if (
      /\battendance\b|\bcheck[\s_-]?(in|out)\b|\bpunch\b/.test(notificationText)
    ) {
      router.push("/(tabs)/attendance");
      return;
    }

    if (/\btask\b/.test(notificationText)) {
      router.push("/tasks");
      return;
    }

    switch (notification.kind) {
      case "leave":
        router.push("/(tabs)/leave");
        break;
      case "reimbursement":
        router.push("/(tabs)/reimbursement");
        break;
      case "payslip":
        router.push("/(tabs)/payout");
        break;
      case "holiday":
        router.push("/holidays");
        break;
      case "birthday":
        router.push("/(tabs)");
        break;
      case "memo":
      case "general":
      default:
        router.push("/notifications");
        break;
    }
  };
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.heading,
          scope === "personal" ? styles.personalHeading : styles.managerHeading,
        ]}
      >
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {!isLoading && !isError && latestNotifications.length > 0 ? (
          <Pressable
            onPress={openNotifications}
            style={({ pressed }) => [
              styles.viewMoreButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="View more notifications"
          >
            <Text style={styles.viewAllText}>View all</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      {isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading notifications...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="cloud-offline-outline"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>Unable to load notifications.</Text>
          <Pressable onPress={() => void refetch()}>
            <Text style={styles.viewAllText}>Try again</Text>
          </Pressable>
        </View>
      ) : latestNotifications.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="notifications-off-outline"
            size={25}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          style={[styles.panel, scope !== "personal" && styles.managerPanel]}
          data={visibleNotifications}
          keyExtractor={(notification) =>
            JSON.stringify([
              notification.kind,
              notification.id,
              notification.at,
              notification.subjectEmployeeId ?? null,
            ])
          }
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={3}
          onEndReached={() =>
            setVisibleCount((count) =>
              Math.min(count + 3, latestNotifications.length),
            )
          }
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: notification, index }) => (
            <Pressable
              onPress={() => openNotification(notification)}
              style={({ pressed }) => [
                styles.notificationRow,
                index !== latestNotifications.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Open notification: ${notification.title}`}
            >
              <View
                style={[
                  styles.notificationIcon,
                  {
                    backgroundColor: getNotificationVisual(notification, colors)
                      .backgroundColor,
                  },
                ]}
              >
                <Ionicons
                  name={getNotificationIcon(notification)}
                  size={19}
                  color={getNotificationVisual(notification, colors).color}
                />
              </View>
              <View style={styles.notificationContent}>
                <View style={styles.notificationTopRow}>
                  <Text style={styles.notificationTitle} numberOfLines={1}>
                    {notification.title}
                  </Text>
                  <Text style={styles.notificationTime}>
                    {formatNotificationTime(notification.at)}
                  </Text>
                </View>
                <Text style={styles.notificationBody} numberOfLines={1}>
                  {notification.subjectEmployeeName
                    ? `${notification.subjectEmployeeName} · ${notification.body}`
                    : notification.body}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function getNotificationIcon(
  notification: EmployeeNotification,
): React.ComponentProps<typeof Ionicons>["name"] {
  const text =
    `${notification.title} ${notification.body} ${notification.href ?? ""}`.toLowerCase();

  if (/\battendance\b|\bcheck[\s_-]?(in|out)\b|\bpunch\b/.test(text)) {
    return "finger-print-outline";
  }

  if (/\btask\b/.test(text)) {
    return "checkbox-outline";
  }

  switch (notification.kind) {
    case "birthday":
      return "gift-outline";
    case "holiday":
      return "sunny-outline";
    case "leave":
      return "calendar-outline";
    case "reimbursement":
      return "receipt-outline";
    case "payslip":
      return "wallet-outline";
    case "memo":
      return "document-text-outline";
    default:
      return "notifications-outline";
  }
}

function getNotificationVisual(
  notification: EmployeeNotification,
  colors: ReturnType<typeof useTheme>["colors"],
): {
  color: string;
  backgroundColor: string;
} {
  const text =
    `${notification.title} ${notification.body} ${notification.href ?? ""}`.toLowerCase();

  if (/\battendance\b|\bcheck[\s_-]?(in|out)\b|\bpunch\b/.test(text)) {
    return {
      color: colors.success,
      backgroundColor: colors.successBackground,
    };
  }

  if (/\btask\b/.test(text)) {
    return {
      color: colors.primary,
      backgroundColor: colors.primaryLight,
    };
  }

  switch (notification.kind) {
    case "leave":
      return {
        color: colors.primary,
        backgroundColor: colors.primaryLight,
      };
    case "reimbursement":
      return {
        color: colors.warning,
        backgroundColor: colors.warningBackground,
      };
    case "payslip":
      return {
        color: colors.success,
        backgroundColor: colors.successBackground,
      };
    case "holiday":
      return {
        color: colors.primary,
        backgroundColor: colors.surfaceSecondary,
      };
    case "birthday":
      return {
        color: colors.primary,
        backgroundColor: colors.primaryLight,
      };
    case "memo":
    default:
      return {
        color: colors.textSecondary,
        backgroundColor: colors.surfaceSecondary,
      };
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60_000),
  );

  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type NotificationTarget =
  | {
      route:
        | "/(tabs)/attendance"
        | "/holidays"
        | "/tasks"
        | "/(tabs)/leave"
        | "/(tabs)/reimbursement"
        | "/(tabs)/payout"
        | "/(tabs)";
    }
  | { route: "/(tabs)/chat"; messageId?: string }
  | { route: "/leave-details" | "/reimbursement-details"; id: string };

function getHrefTarget(
  href: string,
  messageId?: string,
): NotificationTarget | null {
  const lower = safeDecode(href).toLowerCase();
  const id = extractRelatedId(href);

  if (
    /\/chat(?:\/|[?#]|$)/.test(lower) ||
    /[?&]tab=messaging(?:&|$)/.test(lower) ||
    /employee[-_]?memo/.test(lower)
  ) {
    return {
      route: "/(tabs)/chat",
      ...(messageId ? { messageId } : {}),
    };
  }

  if (/holiday|calendar/.test(lower)) return { route: "/holidays" };

  if (/attendance|check[-_ ]?(in|out)|punch/.test(lower)) {
    return { route: "/(tabs)/attendance" };
  }

  if (/task|mytasks|my-tasks/.test(lower)) {
    return { route: "/tasks" };
  }

  if (/leave/.test(lower)) {
    return id ? { route: "/leave-details", id } : { route: "/(tabs)/leave" };
  }

  if (/reimburse|expense/.test(lower)) {
    return id
      ? { route: "/reimbursement-details", id }
      : { route: "/(tabs)/reimbursement" };
  }

  if (/payslip|salary|payout|payroll/.test(lower)) {
    return { route: "/(tabs)/payout" };
  }

  return null;
}

function extractRelatedId(href: string): string | null {
  try {
    const parsed = new URL(href, "https://mobile.local");

    for (const key of [
      "id",
      "leaveId",
      "leaveApplicationId",
      "reimbursementId",
      "requestId",
    ]) {
      const value = parsed.searchParams.get(key);
      if (value && /^[a-zA-Z0-9_-]+$/.test(value)) return value;
    }
  } catch {
    // Try path parsing below.
  }

  try {
    const parsed = new URL(href, "https://mobile.local");
    const segments = parsed.pathname.split("/").filter(Boolean);
    const numericId = [...segments]
      .reverse()
      .find((segment) => /^\d+$/.test(segment));

    if (numericId) return numericId;
  } catch {
    // No related identifier in this URL.
  }

  return null;
}

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function navigateToTarget(
  router: ReturnType<typeof useRouter>,
  target: NotificationTarget,
) {
  if ("messageId" in target && target.messageId) {
    router.push({
      pathname: target.route,
      params: { messageId: target.messageId },
    });
  } else if ("id" in target) {
    router.push({
      pathname: target.route,
      params: { id: target.id },
    });
  } else {
    router.push(target.route);
  }
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      marginTop: 5,
    },
    notificationTopRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },

    heading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    personalHeading: {
      marginHorizontal: -15,
    },
    managerHeading: {
      marginHorizontal: 5,
    },
    headingCopy: {
      flex: 1,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    viewAllText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },

    viewMoreButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      gap: 6,
      minHeight: 30,
      paddingHorizontal: 13,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
    },
    panel: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: -15,
      backgroundColor: colors.surface,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    managerPanel: {
      marginHorizontal: 5,
    },
    notificationRow: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 10,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    notificationContent: {
      flex: 1,
      minWidth: 0,
    },
    notificationTitle: {
      flex: 1,
      minWidth: 0,
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    notificationBody: {
      marginTop: 2,
      fontSize: 11,
      lineHeight: 14,
      color: colors.textSecondary,
    },
    notificationTime: {
      flexShrink: 0,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    stateCard: {
      minHeight: 95,
      padding: 18,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
    },
    stateText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}

*/

import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";

import { AppText as Text } from "./InterTypography";
import { useTheme } from "../theme/ThemeProvider";

export default function DashboardNotifications(_props?: { scope?: string }) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      <View style={styles.stateCard}>
        <Ionicons
          name="notifications-off-outline"
          size={24}
          color={colors.textSecondary}
        />
        <Text style={styles.stateTitle}>Currently unavailable</Text>
        <Text style={styles.message}>
          Notifications are not available in the mobile app yet.
        </Text>
      </View>
    </View>
  );
}

function createStyles(colors: {
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      marginTop: 5,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
      marginBottom: 12,
    },
    stateCard: {
      minHeight: 110,
      flex: 1,
      padding: 18,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
    },
    stateTitle: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    message: {
      fontSize: 12,
      textAlign: "center",
      color: colors.textSecondary,
    },
  });
}
