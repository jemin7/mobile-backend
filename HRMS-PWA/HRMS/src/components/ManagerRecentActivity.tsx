import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AppText as Text } from "./InterTypography";
import { useRecentActivity } from "../hooks/useNotifications";
import type { TeamActivityScope } from "../api/notifications";
import { useTheme } from "../theme/ThemeProvider";

type Props = {
  scope: TeamActivityScope;
};

type Colors = ReturnType<typeof useTheme>["colors"];

export default function ManagerRecentActivity({ scope }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const query = useRecentActivity(scope);
  const activities = (query.data ?? []).slice(0, 10);

  const subtitle =
    scope === "reportees"
      ? "Latest actions by your direct reportees"
      : "Latest actions across your team";

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="time-outline" size={21} color={colors.primary} />
        </View>

        <View style={styles.headingCopy}>
          <Text style={styles.title}>Recent Activity</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {!query.isLoading && !query.isError && activities.length > 0 ? (
          <View style={styles.countPill}>
            <Text style={styles.countText}>{query.data?.length ?? 0}</Text>
          </View>
        ) : null}
      </View>

      {query.isLoading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading recent activity...</Text>
        </View>
      ) : query.isError ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="cloud-offline-outline"
            size={23}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>Unable to load recent activity.</Text>
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
      ) : activities.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons
            name="time-outline"
            size={25}
            color={colors.textSecondary}
          />
          <Text style={styles.stateText}>No recent activity yet.</Text>
        </View>
      ) : (
        <View style={styles.panel}>
          {activities.map((activity, index) => (
            <View
              key={activity.id}
              style={[
                styles.activityRow,
                index !== activities.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.activityIcon}>
                <Ionicons
                  name={
                    activity.kind === "attendance"
                      ? "finger-print-outline"
                      : "checkbox-outline"
                  }
                  size={19}
                  color={colors.primary}
                />
              </View>

              <View style={styles.activityContent}>
                <Text style={styles.activityTitle} numberOfLines={2}>
                  {activity.title}
                </Text>

                <Text style={styles.activityBody} numberOfLines={2}>
                  {activity.body}
                </Text>

                <Text style={styles.activityTime}>
                  {formatActivityTime(activity.at)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formatActivityTime(value: string) {
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
    year:
      date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      marginTop: 22,
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
    subtitle: {
      marginTop: 3,
      fontSize: 10,
      color: colors.textSecondary,
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
      overflow: "hidden",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    activityRow: {
      minHeight: 75,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 13,
      paddingVertical: 11,
      gap: 11,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    activityIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    activityContent: {
      flex: 1,
      minWidth: 0,
    },
    activityTitle: {
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    activityBody: {
      marginTop: 3,
      fontSize: 10,
      lineHeight: 15,
      color: colors.textSecondary,
    },
    activityTime: {
      marginTop: 5,
      fontSize: 9,
      color: colors.textMuted,
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
  });
}
