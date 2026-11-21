import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import { AppText as Text } from "./InterTypography";
import { useNotifications } from "../hooks/useNotifications";
import type {
  EmployeeNotification,
  NotificationFeedScope,
} from "../api/notifications";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  scope: Extract<NotificationFeedScope, "reportees" | "team">;
};
type Colors = ReturnType<typeof useTheme>["colors"];
type ManagerFeedItem = {
  key: string;
  type: "notification";
  at: string;
  notification: EmployeeNotification;
};

export default function ManagerNotifications({ scope }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [visibleCount, setVisibleCount] = useState(4);
  const query = useNotifications(scope);

  const feedItems = useMemo(() => {
    const notifications = [
      ...(query.data?.recent ?? []),
      ...(query.data?.older ?? []),
    ];

    const uniqueItems = new Map<string, ManagerFeedItem>();

    notifications.forEach((notification) => {
      const key = JSON.stringify([
        notification.kind,
        notification.id,
        notification.at,
        notification.subjectEmployeeId ?? null,
      ]);

      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, {
          key,
          type: "notification",
          at: notification.at,
          notification,
        });
      }
    });

    return Array.from(uniqueItems.values()).sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [query.data]);

  const visibleItems = feedItems.slice(0, visibleCount);

  const openNotification = (notification: EmployeeNotification) => {
    const href = notification.href?.trim().toLowerCase() ?? "";

    const messageId =
      typeof notification.id === "string"
        ? /^memo-(\d+)$/i.exec(notification.id)?.[1]
        : undefined;

    if (
      /\/chat(?:\/|[?#]|$)/.test(href) ||
      /[?&]tab=messaging(?:&|$)/.test(href) ||
      /employee[-_]?memo/.test(href)
    ) {
      router.push({
        pathname: "/(tabs)/chat",
        ...(messageId ? { params: { messageId } } : {}),
      });
      return;
    }

    if (/holiday|calendar/.test(href) || notification.kind === "holiday") {
      router.push("/holidays");
      return;
    }

    const needsLeaveApproval =
      scope === "reportees" &&
      notification.kind === "leave" &&
      /approval pending|needs your approval/i.test(
        `${notification.title} ${notification.body}`,
      );

    if (needsLeaveApproval) {
      router.push("/approvals");
      return;
    }

    if (notification.subjectEmployeeId) {
      router.push({
        pathname: "/my-team/employee/[id]",
        params: { id: String(notification.subjectEmployeeId) },
      });
      return;
    }

    if (notification.kind === "birthday") {
      router.push("/(tabs)");
      return;
    }

    router.push("/notifications");
  };

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons
            name="notifications-outline"
            size={20}
            color={colors.primary}
          />
        </View>

        <View style={styles.headingCopy}>
          <Text style={styles.title}>Notifications</Text>
        </View>

        {!query.isLoading && feedItems.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{feedItems.length}</Text>
          </View>
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading notifications...</Text>
        </View>
      ) : feedItems.length === 0 && query.isError ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="cloud-offline-outline"
            size={23}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>Unable to load notifications.</Text>
          <Pressable
            onPress={() => void query.refetch()}
            disabled={query.isRefetching}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              {query.isRefetching ? "Retrying..." : "Try again"}
            </Text>
          </Pressable>
        </View>
      ) : feedItems.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="notifications-off-outline"
            size={24}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>No notifications yet.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.panel}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={({ nativeEvent }) => {
              const { contentOffset, contentSize, layoutMeasurement } =
                nativeEvent;

              if (
                contentOffset.y + layoutMeasurement.height >=
                contentSize.height - 40
              ) {
                setVisibleCount((current) =>
                  Math.min(current + 3, feedItems.length),
                );
              }
            }}
          >
            {visibleItems.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => openNotification(item.notification)}
                style={({ pressed }) => [
                  styles.notificationRow,
                  index !== visibleItems.length - 1 && styles.rowDivider,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open notification: ${item.notification.title}`}
              >
                <View
                  style={[
                    styles.notificationIcon,
                    {
                      backgroundColor: getFeedItemVisual(item).backgroundColor,
                    },
                  ]}
                >
                  <Ionicons
                    name={getNotificationIcon(item.notification.kind)}
                    size={19}
                    color={getFeedItemVisual(item).color}
                  />
                </View>

                <View style={styles.notificationContent}>
                  <View style={styles.notificationTopRow}>
                    <Text style={styles.notificationTitle} numberOfLines={2}>
                      {item.notification.title}
                    </Text>
                    <Text style={styles.notificationTime}>
                      {formatNotificationTime(item.at)}
                    </Text>
                  </View>

                  <Text style={styles.notificationBody} numberOfLines={2}>
                    {item.notification.body}
                  </Text>

                  {item.notification.subjectEmployeeName ? (
                    <Text style={styles.employeeName}>
                      {item.notification.subjectEmployeeName}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function getNotificationIcon(
  kind: EmployeeNotification["kind"],
): React.ComponentProps<typeof Ionicons>["name"] {
  switch (kind) {
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

function getFeedItemVisual(item: ManagerFeedItem): {
  color: string;
  backgroundColor: string;
} {
  return getNotificationVisual(item.notification.kind);
}

function getNotificationVisual(kind: string): {
  color: string;
  backgroundColor: string;
} {
  switch (kind) {
    case "birthday":
      return { color: "#BE185D", backgroundColor: "#FCE7F3" };
    case "holiday":
      return { color: "#B45309", backgroundColor: "#FEF3C7" };
    case "leave":
      return { color: "#2563EB", backgroundColor: "#DBEAFE" };
    case "reimbursement":
      return { color: "#C2410C", backgroundColor: "#FFEDD5" };
    case "payslip":
      return { color: "#7C3AED", backgroundColor: "#EDE9FE" };
    case "memo":
      return { color: "#475569", backgroundColor: "#E2E8F0" };
    case "attendance":
      return { color: "#15803D", backgroundColor: "#DCFCE7" };
    case "task":
      return { color: "#0F766E", backgroundColor: "#CCFBF1" };
    default:
      return { color: "#0F766E", backgroundColor: "#CCFBF1" };
  }
}

function formatNotificationTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const minutes = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / 60000),
  );

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function createStyles(colors: Colors) {
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
      gap: 10,
      marginBottom: 12,
    },
    headingIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    headingCopy: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    countPill: {
      minWidth: 28,
      height: 26,
      paddingHorizontal: 8,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    countText: {
      fontSize: 11,
      fontWeight: "800",
      color: colors.primary,
    },
    panel: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: -15,
      overflow: "hidden",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    notificationRow: {
      minHeight: 78,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      paddingVertical: 11,
      gap: 10,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    notificationIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
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
      lineHeight: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    notificationBody: {
      marginTop: 3,
      fontSize: 10,
      lineHeight: 15,
      color: colors.textSecondary,
    },
    employeeName: {
      marginTop: 3,
      fontSize: 10,
      fontWeight: "700",
      color: colors.primary,
    },
    notificationTime: {
      flexShrink: 0,
      fontSize: 10,
      lineHeight: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    stateCard: {
      minHeight: 105,
      padding: 17,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    stateText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    retryButton: {
      paddingHorizontal: 13,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor: colors.primaryLight,
    },
    retryText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    showMoreButton: {
      minHeight: 42,
      marginTop: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    showMoreText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.primary,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
