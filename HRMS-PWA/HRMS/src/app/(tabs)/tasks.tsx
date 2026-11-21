/*
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/InterTypography";
import { SafeAreaView } from "react-native-safe-area-context";

import type { TaskProject } from "../../api/tasks";
import { useTasks } from "../../hooks/useTasks";
import { useTheme } from "../../theme/ThemeProvider";
import { useManagerScope } from "../../hooks/useManagerScope";

type TaskStatus = "Completed" | "Open" | "Work In Progress" | "Reopened";

const TASK_STATUSES: TaskStatus[] = [
  "Completed",
  "Open",
  "Work In Progress",
  "Reopened",
];

function formatDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getTaskStatusLabel(status?: string | null) {
  const normalized = status?.trim().toLowerCase();

  const labels: Record<string, string> = {
    open: "Open",

    completed: "Completed",
    closed: "Completed",

    wip: "Work In Progress",
    "work in progress": "Work In Progress",
    "in progress": "Work In Progress",
    in_progress: "Work In Progress",
    inprogress: "Work In Progress",

    scheduled: "Scheduled",
    rescheduled: "Rescheduled",

    "on-hold": "On-Hold",
    "on hold": "On-Hold",
    on_hold: "On-Hold",
    onhold: "On-Hold",

    reopen: "Reopened",
    reopened: "Reopened",
    "re-opened": "Reopened",
  };

  return labels[normalized || ""] || status?.trim() || "Unknown status";
}

function getTaskStatusCount(
  statusCounts: Record<string, number> | undefined,
  targetStatus: TaskStatus,
) {
  return Object.entries(statusCounts ?? {}).reduce(
    (total, [rawStatus, count]) =>
      getTaskStatusLabel(rawStatus) === targetStatus
        ? total + (Number(count) || 0)
        : total,
    0,
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "We couldn't load your tasks. Please try again.";
}

export default function TasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { hasReportees } = useManagerScope();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | null>(null);

  const { data, error, isError, isLoading, isRefetching, refetch } = useTasks({
    assignedToMe: !hasReportees,
    search: searchQuery,
    status:
      selectedStatus === "Reopened" ? "Reopen" : (selectedStatus ?? undefined),

    page: 1,
    limit: 50,
  });

  const tasks = data?.items ?? [];
  const styles = createStyles(colors);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>
              {hasReportees ? "Team Tasks" : "My Tasks"}
            </Text>
          </View>
          {hasReportees ? (
            <Pressable
              onPress={() => router.push("/create-task")}
              style={({ pressed }) => [
                styles.createTaskButton,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Create task"
            >
              <Ionicons name="add" size={23} color={colors.white} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textSecondary}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search tasks by name or code"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              clearButtonMode="while-editing"
              accessibilityLabel="Search tasks"
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => setSearchQuery("")}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Clear task search"
              >
                <Ionicons
                  name="close-circle"
                  size={19}
                  color={colors.textMuted}
                />
              </Pressable>
            )}
          </View>

          <View style={styles.statusSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Filter by status</Text>
              <Text style={styles.filterHint}>Select one</Text>
            </View>
            <View style={styles.statusScrollContent}>
              {TASK_STATUSES.map((status) => {
                const selected = selectedStatus === status;
                const count = getTaskStatusCount(data?.statusCounts, status);
                return (
                  <Pressable
                    key={status === "Work In Progress" ? "WIP" : status}
                    onPress={() =>
                      setSelectedStatus(
                        selectedStatus === status ? null : status,
                      )
                    }
                    style={({ pressed }) => [
                      styles.statusChip,
                      selected && styles.statusChipSelected,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Filter tasks by ${status === "Work In Progress" ? "WIP" : status}`}
                  >
                    
                    <Text
                      style={[
                        styles.statusText,
                        selected && styles.statusTextSelected,
                      ]}
                    >
                      {status === "Work In Progress" ? "WIP" : status}
                    </Text>

                    {data?.statusCounts ? (
                      <View
                        style={[
                          styles.statusCountBadge,
                          selected && styles.statusCountBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusCountText,
                            selected && styles.statusCountTextSelected,
                          ]}
                        >
                          {count > 99 ? "99+" : count}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsTitle}>
                {selectedStatus ?? "Tasks"}
              </Text>
              <Text style={styles.resultsSubtitle}>Tasks in this category</Text>
            </View>
            {!isLoading && !isError && (
              <View style={styles.resultsCountPill}>
                <Text style={styles.resultsCount}>
                  {data?.total ?? tasks.length}{" "}
                  {data?.total === 1 ? "task" : "tasks"}
                </Text>
              </View>
            )}
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateTitle}>Loading your tasks</Text>
              <Text style={styles.stateMessage}>
                Getting your latest assignments…
              </Text>
            </View>
          ) : isError ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconContainer}>
                <Ionicons
                  name="cloud-offline-outline"
                  size={30}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.stateTitle}>Couldn&apos;t load tasks</Text>
              <Text style={styles.stateMessage}>{getErrorMessage(error)}</Text>
              <Pressable
                onPress={() => void refetch()}
                disabled={isRefetching}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                  isRefetching && styles.disabledButton,
                ]}
                accessibilityRole="button"
              >
                {isRefetching ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="refresh-outline"
                      size={17}
                      color={colors.white}
                    />
                    <Text style={styles.retryButtonText}>Try again</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : tasks.length === 0 ? (
            <View style={styles.stateCard}>
              <View style={styles.stateIconContainer}>
                <Ionicons
                  name="clipboard-outline"
                  size={32}
                  color={colors.textMuted}
                />
              </View>
              <Text style={styles.stateTitle}>
                {searchQuery.trim() ? "No matching tasks" : "No tasks found"}
              </Text>
              <Text style={styles.stateMessage}>
                {searchQuery.trim()
                  ? "Try another task name or code, or clear your search."
                  : selectedStatus
                    ? `There are no tasks to show in ${selectedStatus} right now.`
                    : "There are no tasks to show right now."}
              </Text>
              {searchQuery.trim() ? (
                <Pressable
                  onPress={() => setSearchQuery("")}
                  style={({ pressed }) => [
                    styles.clearSearchButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.clearSearchText}>Clear search</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.taskList}>
              {tasks.map((task) => (
                <TaskCard
                  key={String(task.id)}
                  task={task}
                  colors={colors}
                  onPress={() =>
                    router.push({
                      pathname: "/task-details",
                      params: { task: JSON.stringify(task) },
                    })
                  }
                  onChat={() =>
                    router.push({
                      pathname: "/task-chat",
                      params: { task: JSON.stringify(task) },
                    })
                  }
                />
              ))}
              {data && data.total > tasks.length && (
                <Text style={styles.paginationNote}>
                  Showing {tasks.length} of {data.total} tasks.
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TaskCard({
  task,
  colors,
  onPress,
  onChat,
}: {
  task: TaskProject;
  onPress: () => void;
  onChat: () => void;
  colors: {
    surface: string;
    surfaceSecondary: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    primary: string;
    primaryLight: string;
    white: string;
    success?: string;
    successBackground?: string;
    warning?: string;
    warningBackground?: string;
    danger?: string;
    dangerBackground?: string;
  };
}) {
  const title = task.taskName?.trim() || "Untitled task";
  const statusLabel = getTaskStatusLabel(task.status);
  const dueDate = formatDate(task.dueAt ?? task.dueDate);
  const styles = createTaskCardStyles(colors);
  const statusVisual = getStatusVisual(statusLabel, colors);
  const priorityVisual = getPriorityVisual(task.priority, colors);

  return (
    <View style={styles.taskCard}>
      <View style={styles.taskCardTopRow}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.taskMainPressable,
            pressed && { opacity: 0.75 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Open task ${title}`}
        >
          <View style={styles.taskTitleContainer}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {title}
            </Text>
          </View>

          <View
            style={[
              styles.taskStatusBadge,
              { backgroundColor: statusVisual.background },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusVisual.color },
              ]}
            />
            <Text
              style={[styles.taskStatusText, { color: statusVisual.color }]}
              numberOfLines={1}
            >
              {statusLabel}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={onChat}
          hitSlop={8}
          style={styles.chatAction}
          accessibilityRole="button"
          accessibilityLabel="Open task chat"
        >
          <Ionicons
            name="chatbubbles-outline"
            size={18}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {task.priority || dueDate ? (
        <View style={styles.taskMetadata}>
          {task.priority ? (
            <View style={styles.metadataItem}>
              <Ionicons
                name="flag-outline"
                size={13}
                color={priorityVisual.color}
              />
              <Text
                style={[styles.metadataText, { color: priorityVisual.color }]}
              >
                {task.priority}
              </Text>
            </View>
          ) : null}

          {dueDate ? (
            <View style={styles.metadataItem}>
              <Ionicons
                name="calendar-outline"
                size={13}
                color={colors.textSecondary}
              />
              <Text style={styles.metadataText}>Due {dueDate}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function getStatusVisual(
  status: string,
  colors: {
    primary: string;
    primaryLight: string;
    success?: string;
    successBackground?: string;
    warning?: string;
    warningBackground?: string;
    danger?: string;
    dangerBackground?: string;
    surfaceSecondary: string;
    textSecondary: string;
  },
) {
  const normalized = status.trim().toLowerCase();

  const statusStyles: Record<string, { color: string; background: string }> = {
    completed: {
      color: colors.success ?? colors.primary,
      background: colors.successBackground ?? colors.primaryLight,
    },
    open: {
      color: colors.primary,
      background: colors.primaryLight,
    },
    "work in progress": {
      color: colors.warning ?? colors.primary,
      background: colors.warningBackground ?? colors.primaryLight,
    },
    scheduled: {
      color: colors.primary,
      background: colors.primaryLight,
    },
    rescheduled: {
      color: colors.warning ?? colors.primary,
      background: colors.warningBackground ?? colors.primaryLight,
    },
    "on-hold": {
      color: colors.warning ?? colors.primary,
      background: colors.warningBackground ?? colors.primaryLight,
    },
    reopened: {
      color: colors.danger ?? colors.primary,
      background: colors.dangerBackground ?? colors.primaryLight,
    },
  };

  return (
    statusStyles[normalized] ?? {
      color: colors.textSecondary,
      background: colors.surfaceSecondary,
    }
  );
}

function getPriorityVisual(
  priority: string | null | undefined,
  colors: {
    textSecondary: string;
    warning?: string;
    danger?: string;
    success?: string;
  },
) {
  const normalized = priority?.toLowerCase() ?? "";
  if (normalized.includes("high") || normalized.includes("urgent")) {
    return { color: colors.danger ?? colors.textSecondary };
  }
  if (normalized.includes("medium")) {
    return { color: colors.warning ?? colors.textSecondary };
  }
  if (normalized.includes("low")) {
    return { color: colors.success ?? colors.textSecondary };
  }
  return { color: colors.textSecondary };
}

function createStyles(colors: {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
  white: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    pressed: {
      opacity: 0.7,
    },
    headerTextContainer: {
      flex: 1,
    },
    title: {
      fontSize: 21,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    createTaskButton: {
      width: 42,
      height: 42,
      borderRadius: 13,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 30,
    },
    searchContainer: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 13,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    searchInput: {
      flex: 1,
      minWidth: 0,
      fontSize: 14,
      color: colors.textPrimary,
      paddingVertical: 8,
    },
    statusSection: {
      marginTop: 20,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 10,
    },
    sectionLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    filterHint: {
      fontSize: 11,
      color: colors.textMuted,
    },

        statusScrollContent: {
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: 4,
    },
    statusChip: {
      flex: 1,
      minWidth: 0,
      justifyContent: "center",
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      paddingHorizontal: 1,
      paddingVertical: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    statusChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    statusTextSelected: {
      color: colors.white,
    },
    statusCountBadge: {
      minWidth: 15,
      height: 15,
      paddingHorizontal: 2,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    statusCountBadgeSelected: {
      backgroundColor: colors.white,
    },
    statusCountText: {
      fontSize: 8,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    statusCountTextSelected: {
      color: colors.primary,
    },
    resultsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 22,
      marginBottom: 12,
    },
    resultsTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    resultsSubtitle: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    resultsCountPill: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
    },
    resultsCount: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    stateCard: {
      alignItems: "center",
      padding: 24,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    stateIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 10,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateMessage: {
      marginTop: 7,
      fontSize: 12,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 15,
      paddingHorizontal: 18,
      paddingVertical: 11,
      borderRadius: 11,
      backgroundColor: colors.primary,
    },
    disabledButton: {
      opacity: 0.6,
    },
    retryButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.white,
    },
    clearSearchButton: {
      marginTop: 14,
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
    },
    clearSearchText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    taskList: {
      gap: 12,
    },
    paginationNote: {
      marginTop: 8,
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: "center",
    },
  });
}
function createTaskCardStyles(colors: {
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryLight: string;
}) {
  return StyleSheet.create({
    taskCard: {
      position: "relative",
      overflow: "hidden",
      padding: 12,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    taskCardTopRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingLeft: 3,
    },
    taskMainPressable: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    taskTitleContainer: {
      flex: 1,
      minWidth: 0,
    },
    taskTitle: {
      fontSize: 14,
      lineHeight: 19,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    taskStatusBadge: {
      maxWidth: 112,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 5,
      borderRadius: 9,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    taskStatusText: {
      fontSize: 9,
      fontWeight: "800",
    },
    chatAction: {
      width: 35,
      height: 35,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    taskMetadata: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 13,
      marginTop: 8,
      paddingLeft: 3,
    },
    metadataItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    metadataText: {
      fontSize: 10,
      fontWeight: "700",
      color: colors.textSecondary,
    },
  });
}

*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function TasksScreen() {
  return <FeatureUnavailableScreen feature="Task management" />;
}