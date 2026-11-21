/*
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { AttendancePunchRecord } from "../../api/attendance";

import { SafeAreaView } from "react-native-safe-area-context";

import type { LeaveRequest } from "../../api/leave";
import type { TaskProject } from "../../api/tasks";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../../components/InterTypography";
import { useAuth } from "../../auth/AuthProvider";
import {
  useAttendanceMonth,
  useAttendancePunches,
} from "../../hooks/useAttendance";
import { useHolidays } from "../../hooks/useHolidays";
import { useLeaveRequests } from "../../hooks/useLeave";
import { useTasks } from "../../hooks/useTasks";
import { useWeeklyOff } from "../../hooks/useWeeklyOff";
import { useTheme } from "../../theme/ThemeProvider";
import { useRouter } from "expo-router";

type EventType = "attendance" | "leave" | "holiday" | "weeklyOff" | "task";

type CalendarEvent = {
  id: string;
  type: EventType;
  title: string;
  detail: string;
};

type CalendarTodoItem = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
};

type CalendarTodoStore = Record<string, CalendarTodoItem[]>;

function calendarTodoStorageKey(employeeId: number) {
  return `hrms-calendar-todos:${employeeId}`;
}

type CalendarColors = ReturnType<typeof useTheme>["colors"];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateKey(value?: string | null) {
  if (!value) return "";

  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return "";

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );

  if (Number.isNaN(date.getTime()) || toDateKey(date) !== match[0]) {
    return "";
  }

  return match[0];
}

function getDateRange(start: string, end: string) {
  const dates: string[] = [];

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    start > end
  ) {
    return dates;
  }

  const cursor = new Date(startDate);

  while (cursor.getTime() <= endDate.getTime()) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function getApprovedLeaveDates(request: LeaveRequest) {
  if (request.status === "Partially Approved") {
    let raw: unknown = request.dayStatuses;

    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        return [];
      }
    }

    if (!Array.isArray(raw)) return [];

    return raw.flatMap((item: unknown) => {
      if (!item || typeof item !== "object") return [];

      const day = item as {
        date?: unknown;
        status?: unknown;
      };

      const date = getDateKey(typeof day.date === "string" ? day.date : null);

      const status = typeof day.status === "string" ? day.status.trim() : "";

      return date && status ? [{ date, status }] : [];
    });
  }

  if (request.status === "Approved" || request.status === "Accepted") {
    return getDateRange(request.fromDateKey, request.toDateKey).map((date) => ({
      date,
      status: request.status,
    }));
  }

  return [];
}

function addCalendarEvent(
  events: Record<string, CalendarEvent[]>,
  date: string,
  event: CalendarEvent,
) {
  if (!date) return;

  const existing = events[date] ?? [];
  events[date] = [...existing, event];
}

function getEventColor(type: EventType, colors: CalendarColors) {
  switch (type) {
    case "attendance":
      return colors.success;
    case "leave":
      return colors.primary;
    case "holiday":
      return colors.danger;
    case "weeklyOff":
      return colors.warning;
    case "task":
      return colors.textSecondary;
  }
}

function getEventIcon(type: EventType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "attendance":
      return "time-outline";
    case "leave":
      return "calendar-outline";
    case "holiday":
      return "sunny-outline";
    case "weeklyOff":
      return "bed-outline";
    case "task":
      return "checkbox-outline";
  }
}

function formatFullDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatPunchTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "--:--";

  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${minutes} ${period}`;
}

function getPunchLabel(type: string) {
  switch (type) {
    case "CHECK_IN":
      return "Check in";
    case "CHECK_OUT":
      return "Check out";
    case "BREAK_IN":
      return "Break in";
    case "BREAK_OUT":
      return "Break out";
    default:
      return type.replace(/_/g, " ");
  }
}

function getPunchIcon(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "CHECK_IN":
      return "log-in-outline";
    case "CHECK_OUT":
      return "log-out-outline";
    case "BREAK_IN":
      return "cafe-outline";
    case "BREAK_OUT":
      return "play-outline";
    default:
      return "time-outline";
  }
}

function getPunchLocation(record: AttendancePunchRecord) {
  if (record.address?.trim()) {
    return record.address.trim();
  }

  if (record.latitude != null && record.longitude != null) {
    return `${record.latitude.toFixed(5)}, ${record.longitude.toFixed(5)}`;
  }

  return "Location not available";
}

function formatMonth(value: Date) {
  return value.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function buildCalendarEvents(
  attendance: {
    id: number;
    date: string;
    checkIn: string | null;
    checkOut: string | null;
    workHours: string;
  }[],
  leaveRequests: LeaveRequest[],
  holidays: {
    id: number | string;
    name: string;
    startDate: string;
    endDate?: string | null;
  }[],
  weeklyOffs: {
    id: number;
    date: string;
  }[],
  tasks: TaskProject[],
) {
  const events: Record<string, CalendarEvent[]> = {};

  attendance.forEach((item) => {
    const date = getDateKey(item.date);

    addCalendarEvent(events, date, {
      id: `attendance-${item.id}`,
      type: "attendance",
      title: "Attendance marked",
      detail: `In: ${item.checkIn ?? "--:--"} · Out: ${
        item.checkOut ?? "--:--"
      } · Work: ${item.workHours}`,
    });
  });

  leaveRequests.forEach((request) => {
    getApprovedLeaveDates(request).forEach((day) => {
      addCalendarEvent(events, day.date, {
        id: `leave-${request.id}-${day.date}`,
        type: "leave",
        title: `${request.type} leave`,
        detail: `${request.status} · ${day.status}`,
      });
    });
  });

  holidays.forEach((holiday) => {
    const start = getDateKey(holiday.startDate);
    const end = getDateKey(holiday.endDate ?? holiday.startDate);

    getDateRange(start, end).forEach((date) => {
      addCalendarEvent(events, date, {
        id: `holiday-${holiday.id}-${date}`,
        type: "holiday",
        title: holiday.name,
        detail: "Public holiday",
      });
    });
  });

  weeklyOffs.forEach((item) => {
    const date = getDateKey(item.date);

    addCalendarEvent(events, date, {
      id: `weekly-off-${item.id}`,
      type: "weeklyOff",
      title: "Weekly off",
      detail: "Scheduled weekly off",
    });
  });

  tasks.forEach((task) => {
    const date = getDateKey(
      task.scheduleDateTime ?? task.dueAt ?? task.dueDate,
    );

    if (!date) return;

    addCalendarEvent(events, date, {
      id: `task-${task.id}`,
      type: "task",
      title: task.taskName?.trim() || `Task #${task.id}`,
      detail: `Due date · ${task.status?.trim() || "Status unavailable"}`,
    });
  });

  return events;
}

export default function CalendarScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const employeeId = user?.employee?.id ?? 0;
  const styles = createStyles(colors);

  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));

  const [activeDaySection, setActiveDaySection] = useState<
    "events" | "punches" | "sites" | "tasks" | "todo"
  >("punches");

  const [calendarTodos, setCalendarTodos] = useState<CalendarTodoStore>({});

  const [todoDraft, setTodoDraft] = useState("");
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoDraft, setEditingTodoDraft] = useState("");

  const [todoLoading, setTodoLoading] = useState(true);
  useEffect(() => {
    setEditingTodoId(null);
    setTodoDraft("");
    setEditingTodoDraft("");
  }, [selectedDate]);
  const [todoSaving, setTodoSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    setCalendarTodos({});
    setTodoLoading(true);

    if (!employeeId) {
      setTodoLoading(false);
      return () => {
        cancelled = true;
      };
    }

    AsyncStorage.getItem(calendarTodoStorageKey(employeeId))
      .then((stored) => {
        if (cancelled) return;

        if (!stored) {
          setCalendarTodos({});
          return;
        }

        try {
          const parsed: unknown = JSON.parse(stored);

          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            setCalendarTodos({});
            return;
          }

          const validStore: CalendarTodoStore = {};

          Object.entries(parsed as Record<string, unknown>).forEach(
            ([date, items]) => {
              if (!Array.isArray(items)) return;

              validStore[date] = items.filter(
                (item): item is CalendarTodoItem => {
                  if (!item || typeof item !== "object") return false;

                  const todo = item as Partial<CalendarTodoItem>;

                  return (
                    typeof todo.id === "string" &&
                    typeof todo.text === "string" &&
                    typeof todo.completed === "boolean" &&
                    typeof todo.createdAt === "string"
                  );
                },
              );
            },
          );

          setCalendarTodos(validStore);
        } catch {
          setCalendarTodos({});
        }
      })
      .catch(() => {
        if (!cancelled) setCalendarTodos({});
      })
      .finally(() => {
        if (!cancelled) setTodoLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);
  const fromDate = toDateKey(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1),
  );

  const toDate = toDateKey(
    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0),
  );

  const attendanceQuery = useAttendanceMonth(fromDate, toDate);

  const punchQuery = useAttendancePunches(selectedDate);
  const leaveQuery = useLeaveRequests();
  const holidayQuery = useHolidays();
  const weeklyOffQuery = useWeeklyOff();
  const taskQuery = useTasks({ page: 1, limit: 100 });

  const attendance = attendanceQuery.data ?? [];
  const leaveRequests = leaveQuery.data ?? [];
  const holidays = holidayQuery.data ?? [];
  const weeklyOffs = weeklyOffQuery.data ?? [];
  const tasks = taskQuery.data?.items ?? [];

  const eventMap = useMemo(
    () =>
      buildCalendarEvents(
        attendance,
        leaveRequests,
        holidays,
        weeklyOffs,
        tasks,
      ),
    [attendance, leaveRequests, holidays, weeklyOffs, tasks],
  );

  const selectedEvents = eventMap[selectedDate] ?? [];

  const selectedDayTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const taskDate = getDateKey(
          task.scheduleDateTime ?? task.dueAt ?? task.dueDate,
        );

        return taskDate === selectedDate;
      }),
    [tasks, selectedDate],
  );

  const selectedSiteVisits = selectedDayTasks.filter((task) => {
    const type = (task.taskType ?? "").toLowerCase();

    return type.includes("site visit") || type.includes("customer visit");
  });

  const selectedRegularTasks = selectedDayTasks.filter(
    (task) => !selectedSiteVisits.some((visit) => visit.id === task.id),
  );

  const selectedDateTodos = calendarTodos[selectedDate] ?? [];

  const persistCalendarTodos = async (nextStore: CalendarTodoStore) => {
    if (!employeeId) {
      Alert.alert(
        "Employee account unavailable",
        "Please sign in again to manage your ToDos.",
      );
      return false;
    }

    try {
      await AsyncStorage.setItem(
        calendarTodoStorageKey(employeeId),
        JSON.stringify(nextStore),
      );

      setCalendarTodos(nextStore);
      return true;
    } catch {
      Alert.alert(
        "ToDo not saved",
        "We couldn't save this item on your device. Please try again.",
      );
      return false;
    }
  };
  const addCalendarTodo = async () => {
    const trimmed = todoDraft.trim();

    if (!trimmed || !employeeId || todoSaving) return;

    setTodoSaving(true);

    const newTodo: CalendarTodoItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text: trimmed,
      completed: false,
      createdAt: new Date().toISOString(),
    };

    const nextStore: CalendarTodoStore = {
      ...calendarTodos,
      [selectedDate]: [...selectedDateTodos, newTodo],
    };

    try {
      const saved = await persistCalendarTodos(nextStore);
      if (saved) setTodoDraft("");
    } finally {
      setTodoSaving(false);
    }
  };

  const saveEditedCalendarTodo = async () => {
    const trimmed = editingTodoDraft.trim();

    if (!trimmed || !editingTodoId || !employeeId || todoSaving) return;

    setTodoSaving(true);

    try {
      const nextItems = selectedDateTodos.map((todo) =>
        todo.id === editingTodoId ? { ...todo, text: trimmed } : todo,
      );

      const saved = await persistCalendarTodos({
        ...calendarTodos,
        [selectedDate]: nextItems,
      });

      if (saved) {
        setEditingTodoId(null);
        setEditingTodoDraft("");
      }
    } finally {
      setTodoSaving(false);
    }
  };
  const toggleCalendarTodo = async (todoId: string) => {
    const nextItems = selectedDateTodos.map((todo) =>
      todo.id === todoId ? { ...todo, completed: !todo.completed } : todo,
    );

    await persistCalendarTodos({
      ...calendarTodos,
      [selectedDate]: nextItems,
    });
  };

  const deleteCalendarTodo = async (todoId: string) => {
    const nextItems = selectedDateTodos.filter((todo) => todo.id !== todoId);

    const nextStore = { ...calendarTodos };

    if (nextItems.length > 0) {
      nextStore[selectedDate] = nextItems;
    } else {
      delete nextStore[selectedDate];
    }

    await persistCalendarTodos(nextStore);
  };
  const todayKey = toDateKey(new Date());

  const firstWeekday = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();

  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();

  const calendarCells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null);
  }

  const hasError =
    attendanceQuery.isError ||
    leaveQuery.isError ||
    holidayQuery.isError ||
    weeklyOffQuery.isError ||
    taskQuery.isError;

  const isLoading =
    attendanceQuery.isLoading ||
    leaveQuery.isLoading ||
    holidayQuery.isLoading ||
    weeklyOffQuery.isLoading ||
    taskQuery.isLoading;

  const changeMonth = (offset: number) => {
    const nextMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + offset,
      1,
    );

    setVisibleMonth(nextMonth);
    setSelectedDate(toDateKey(nextMonth));
  };

  const goToToday = () => {
    const today = new Date();

    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(toDateKey(today));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          scrollsChildToFocus
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Back to Home"
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={colors.textPrimary}
              />
            </Pressable>

            <View style={styles.headerIcon}>
              <Ionicons name="calendar" size={24} color={colors.primary} />
            </View>

            <View style={styles.headerText}>
              <Text style={styles.title}>Calendar</Text>
            </View>
          </View>

          {hasError ? (
            <View style={styles.warningBanner}>
              <Ionicons
                name="alert-circle-outline"
                size={18}
                color={colors.warning}
              />
              <Text style={styles.warningText}>
                Some calendar information could not be loaded. Please check your
                connection and try again later.
              </Text>
            </View>
          ) : null}

          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              style={styles.monthArrow}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons
                name="chevron-back"
                size={21}
                color={colors.textPrimary}
              />
            </Pressable>

            <Text style={styles.monthTitle}>{formatMonth(visibleMonth)}</Text>

            <Pressable
              onPress={() => changeMonth(1)}
              style={styles.monthArrow}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons
                name="chevron-forward"
                size={21}
                color={colors.textPrimary}
              />
            </Pressable>

            <Pressable onPress={goToToday} style={styles.todayButton}>
              <Text style={styles.todayButtonText}>Today</Text>
            </Pressable>
          </View>

          <View style={styles.calendarCard}>
            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => (
                <View key={day} style={styles.weekdayCell}>
                  <Text style={styles.weekdayText}>{day}</Text>
                </View>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return (
                    <View key={`empty-${index}`} style={styles.emptyDay} />
                  );
                }

                const date = toDateKey(
                  new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day,
                  ),
                );

                const isSelected = selectedDate === date;
                const isToday = todayKey === date;
                const dayEvents = eventMap[date] ?? [];

                const eventTypes = Array.from(
                  new Set(dayEvents.map((event) => event.type)),
                ).slice(0, 3);

                return (
                  <Pressable
                    key={date}
                    onPress={() => {
                      setSelectedDate(date);
                    }}
                    style={({ pressed }) => [
                      styles.dayCell,
                      pressed && styles.dayPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${formatFullDate(date)}, ${dayEvents.length} events`}
                  >
                    <View
                      style={[
                        styles.dayNumberCircle,
                        isSelected && styles.selectedDayCircle,
                        isToday && !isSelected && styles.todayCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNumber,
                          isSelected && styles.selectedDayNumber,
                          isToday && !isSelected && styles.todayNumber,
                        ]}
                      >
                        {day}
                      </Text>
                    </View>

                    <View style={styles.eventDots}>
                      {eventTypes.map((type) => (
                        <View
                          key={type}
                          style={[
                            styles.eventDot,
                            { backgroundColor: getEventColor(type, colors) },
                          ]}
                        />
                      ))}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.detailsSection}>
            <View style={styles.daySectionTabs}>
              {(
                [
                  { id: "punches", label: "Attendance", icon: "time-outline" },
                  { id: "sites", label: "Visits", icon: "location-outline" },
                  { id: "tasks", label: "Tasks", icon: "checkbox-outline" },
                  { id: "todo", label: "ToDo", icon: "list-outline" },
                ] as const
              ).map((section) => {
                const active = activeDaySection === section.id;

                return (
                  <Pressable
                    key={section.id}
                    onPress={() => setActiveDaySection(section.id)}
                    style={[
                      styles.daySectionTab,
                      active && styles.daySectionTabActive,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={section.icon}
                      size={13}
                      color={active ? colors.primary : colors.textSecondary}
                    />

                    <Text
                      numberOfLines={1}
                      style={[
                        styles.daySectionTabText,
                        active && styles.daySectionTabTextActive,
                      ]}
                    >
                      {section.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetScroll}>
              {activeDaySection === "events" ? (
                <>
                  <View style={styles.punchSectionHeader}>
                    <Text style={styles.punchSectionTitle}>
                      Events for this date
                    </Text>
                    <Text style={styles.punchCount}>
                      {selectedEvents.length} events
                    </Text>
                  </View>

                  {selectedEvents.length === 0 ? (
                    <View style={styles.punchEmpty}>
                      <Ionicons
                        name="calendar-clear-outline"
                        size={30}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.punchEmptyTitle}>
                        No events recorded
                      </Text>
                      <Text style={styles.punchEmptyText}>
                        There are no calendar events recorded for this date.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.eventList}>
                      {selectedEvents.map((event) => {
                        const eventColor = getEventColor(event.type, colors);

                        return (
                          <View key={event.id} style={styles.eventCard}>
                            <View
                              style={[
                                styles.eventIcon,
                                { backgroundColor: `${eventColor}18` },
                              ]}
                            >
                              <Ionicons
                                name={getEventIcon(event.type)}
                                size={20}
                                color={eventColor}
                              />
                            </View>

                            <View style={styles.eventInfo}>
                              <Text style={styles.eventTitle}>
                                {event.title}
                              </Text>
                              <Text style={styles.eventDetail}>
                                {event.detail}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : activeDaySection === "punches" ? (
                <>
                  <View style={styles.punchSectionHeader}>
                    <Text style={styles.punchSectionTitle}>
                      Attendance punches
                    </Text>

                    <Text style={styles.punchCount}>
                      {punchQuery.data?.length ?? 0} records
                    </Text>
                  </View>

                  {punchQuery.isLoading ? (
                    <View style={styles.punchEmpty}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.punchEmptyText}>
                        Loading attendance punches...
                      </Text>
                    </View>
                  ) : punchQuery.isError ? (
                    <View style={styles.punchEmpty}>
                      <Ionicons
                        name="alert-circle-outline"
                        size={28}
                        color={colors.warning}
                      />
                      <Text style={styles.punchEmptyText}>
                        Unable to load attendance punches.
                      </Text>

                      <Pressable
                        onPress={() => void punchQuery.refetch()}
                        style={styles.retryButton}
                      >
                        <Text style={styles.retryButtonText}>Try again</Text>
                      </Pressable>
                    </View>
                  ) : !punchQuery.data?.length ? (
                    <View style={styles.punchEmpty}>
                      <Ionicons
                        name="time-outline"
                        size={30}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.punchEmptyTitle}>
                        No punches recorded
                      </Text>
                      <Text style={styles.punchEmptyText}>
                        No attendance punches were found for this date.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.punchList}>
                      {punchQuery.data.map((punch) => (
                        <View key={punch.id} style={styles.punchRow}>
                          <View style={styles.punchIcon}>
                            <Ionicons
                              name={getPunchIcon(punch.checkType)}
                              size={20}
                              color={colors.primary}
                            />
                          </View>

                          <View style={styles.punchContent}>
                            <View style={styles.punchTopRow}>
                              <Text style={styles.punchType}>
                                {getPunchLabel(punch.checkType)}
                              </Text>

                              <Text style={styles.punchTime}>
                                {formatPunchTime(punch.checkinTime)}
                              </Text>
                            </View>

                            <View style={styles.punchLocationRow}>
                              <Ionicons
                                name="location-outline"
                                size={13}
                                color={colors.textSecondary}
                              />
                              <Text style={styles.punchLocation}>
                                {getPunchLocation(punch)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : activeDaySection === "tasks" ? (
                <>
                  <View style={styles.punchSectionHeader}>
                    <Text style={styles.punchSectionTitle}>Tasks</Text>
                    <Text style={styles.punchCount}>
                      {selectedRegularTasks.length} tasks
                    </Text>
                  </View>

                  {selectedRegularTasks.length === 0 ? (
                    <View style={styles.punchEmpty}>
                      <Ionicons
                        name="checkbox-outline"
                        size={30}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.punchEmptyTitle}>
                        No tasks for this day
                      </Text>
                      <Text style={styles.punchEmptyText}>
                        No assigned tasks are scheduled for this date.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dayTaskList}>
                      {selectedRegularTasks.map((task) => (
                        <View key={String(task.id)} style={styles.dayTaskCard}>
                          <View style={styles.dayTaskIcon}>
                            <Ionicons
                              name="clipboard-outline"
                              size={19}
                              color={colors.primary}
                            />
                          </View>

                          <View style={styles.dayTaskInfo}>
                            <Text style={styles.dayTaskTitle}>
                              {task.taskName?.trim() || `Task #${task.id}`}
                            </Text>

                            <Text style={styles.dayTaskMeta}>
                              {task.taskCode || "Assigned task"}
                              {task.priority
                                ? ` · ${task.priority} priority`
                                : ""}
                            </Text>
                          </View>

                          <Text style={styles.dayTaskStatus}>
                            {task.status || "Unknown"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : activeDaySection === "sites" ? (
                <>
                  <View style={styles.punchSectionHeader}>
                    <Text style={styles.punchSectionTitle}>Site visits</Text>
                    <Text style={styles.punchCount}>
                      {selectedSiteVisits.length} visits
                    </Text>
                  </View>

                  {selectedSiteVisits.length === 0 ? (
                    <View style={styles.punchEmpty}>
                      <Ionicons
                        name="location-outline"
                        size={30}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.punchEmptyTitle}>
                        No site visits for this day
                      </Text>
                      <Text style={styles.punchEmptyText}>
                        No assigned site visits are scheduled for this date.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.dayTaskList}>
                      {selectedSiteVisits.map((task) => (
                        <View key={String(task.id)} style={styles.dayTaskCard}>
                          <View style={styles.dayTaskIcon}>
                            <Ionicons
                              name="location-outline"
                              size={19}
                              color={colors.primary}
                            />
                          </View>

                          <View style={styles.dayTaskInfo}>
                            <Text style={styles.dayTaskTitle}>
                              {task.taskName?.trim() || `Visit #${task.id}`}
                            </Text>

                            <Text style={styles.dayTaskMeta}>
                              {task.site?.branchName ||
                                task.site?.city ||
                                "Site details unavailable"}
                            </Text>
                          </View>

                          <Text style={styles.dayTaskStatus}>
                            {task.status || "Unknown"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <>
                  <View style={styles.punchSectionHeader}>
                    <View>
                      <Text style={styles.punchSectionTitle}>My ToDo</Text>
                    </View>

                    <Text style={styles.punchCount}>
                      {
                        selectedDateTodos.filter((todo) => !todo.completed)
                          .length
                      }{" "}
                      left
                    </Text>
                  </View>

                  {todoLoading ? (
                    <View style={styles.punchEmpty}>
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.punchEmptyText}>
                        Loading your ToDos...
                      </Text>
                    </View>
                  ) : !employeeId ? (
                    <View style={styles.punchEmpty}>
                      <Text style={styles.punchEmptyText}>
                        Employee account unavailable. Please sign in again.
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.todoComposer}>
                        <TextInput
                          value={todoDraft}
                          onChangeText={setTodoDraft}
                          placeholder="Add a reminder..."
                          placeholderTextColor={colors.textMuted}
                          style={styles.todoInput}
                          maxLength={150}
                          returnKeyType="done"
                          onSubmitEditing={() => void addCalendarTodo()}
                        />

                        <Pressable
                          onPress={() => void addCalendarTodo()}
                          disabled={!todoDraft.trim() || todoSaving}
                          style={[
                            styles.todoAddButton,
                            (!todoDraft.trim() || todoSaving) &&
                              styles.todoAddButtonDisabled,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Add ToDo"
                        >
                          {todoSaving ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.white}
                            />
                          ) : (
                            <Ionicons
                              name="add"
                              size={23}
                              color={colors.white}
                            />
                          )}
                        </Pressable>
                      </View>

                      {selectedDateTodos.length === 0 ? (
                        <View style={styles.punchEmpty}>
                          <Ionicons
                            name="list-outline"
                            size={30}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.punchEmptyTitle}>
                            No ToDos for this day
                          </Text>
                          <Text style={styles.punchEmptyText}>
                            Add a personal reminder using the field above.
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.todoList}>
                          {selectedDateTodos.map((todo) => (
                            <View key={todo.id} style={styles.todoItem}>
                              <Pressable
                                onPress={() => void toggleCalendarTodo(todo.id)}
                                style={styles.todoCheckButton}
                                accessibilityRole="checkbox"
                                accessibilityState={{
                                  checked: todo.completed,
                                }}
                                accessibilityLabel={
                                  todo.completed
                                    ? "Mark ToDo incomplete"
                                    : "Mark ToDo complete"
                                }
                              >
                                <Ionicons
                                  name={
                                    todo.completed
                                      ? "checkmark-circle"
                                      : "ellipse-outline"
                                  }
                                  size={23}
                                  color={
                                    todo.completed
                                      ? colors.success
                                      : colors.textMuted
                                  }
                                />
                              </Pressable>

                              {editingTodoId === todo.id ? (
                                <>
                                  <TextInput
                                    value={editingTodoDraft}
                                    onChangeText={setEditingTodoDraft}
                                    style={styles.todoInlineInput}
                                    maxLength={150}
                                    returnKeyType="done"
                                    onSubmitEditing={() =>
                                      void saveEditedCalendarTodo()
                                    }
                                    autoFocus
                                  />

                                  <Pressable
                                    onPress={() =>
                                      void saveEditedCalendarTodo()
                                    }
                                    disabled={
                                      !editingTodoDraft.trim() || todoSaving
                                    }
                                    style={styles.todoDeleteButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Save ToDo"
                                  >
                                    <Ionicons
                                      name="checkmark-circle"
                                      size={21}
                                      color={colors.success}
                                    />
                                  </Pressable>

                                  <Pressable
                                    onPress={() => {
                                      setEditingTodoId(null);
                                      setEditingTodoDraft("");
                                    }}
                                    disabled={todoSaving}
                                    style={styles.todoDeleteButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel editing"
                                  >
                                    <Ionicons
                                      name="close-circle"
                                      size={21}
                                      color={colors.textSecondary}
                                    />
                                  </Pressable>
                                </>
                              ) : (
                                <>
                                  <Pressable
                                    style={styles.todoInlineTextButton}
                                    onPress={() => {
                                      setEditingTodoId(todo.id);
                                      setEditingTodoDraft(todo.text);
                                    }}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Edit ToDo: ${todo.text}`}
                                  >
                                    <Text
                                      style={[
                                        styles.todoItemText,
                                        todo.completed &&
                                          styles.todoItemTextCompleted,
                                      ]}
                                    >
                                      {todo.text}
                                    </Text>
                                  </Pressable>

                                  <Pressable
                                    onPress={() =>
                                      void deleteCalendarTodo(todo.id)
                                    }
                                    style={styles.todoDeleteButton}
                                    accessibilityRole="button"
                                    accessibilityLabel="Delete ToDo"
                                  >
                                    <Ionicons
                                      name="trash-outline"
                                      size={18}
                                      color={colors.textSecondary}
                                    />
                                  </Pressable>
                                </>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: CalendarColors) {
  return StyleSheet.create({
    modalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },

    modalBackdrop: {
      ...StyleSheet.absoluteFill,
      backgroundColor: "rgba(0,0,0,0.45)",
    },

    daySectionTabActive: {
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
    },

    daySectionTabTextActive: {
      color: colors.primary,
    },

    daySectionTabs: {
      width: "100%",
      flexDirection: "row",
      gap: 5,
      paddingBottom: 14,
    },

    daySectionTab: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 3,
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
    },

    daySectionTabText: {
      fontSize: 9,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    dayTaskList: {
      gap: 10,
    },
    todoHelperText: {
      marginTop: 4,
      fontSize: 10,
      color: colors.textSecondary,
    },

    todoComposer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      marginBottom: 15,
    },

    todoInput: {
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 13,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 13,
      color: colors.textPrimary,
    },

    todoAddButton: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },

    todoAddButtonDisabled: {
      opacity: 0.5,
    },

    todoList: {
      gap: 9,
    },

    todoItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    todoCheckButton: {
      width: 30,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    todoItemText: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    todoInlineTextButton: {
      flex: 1,
      minHeight: 34,
      justifyContent: "center",
    },

    todoInlineInput: {
      flex: 1,
      paddingHorizontal: 9,
      paddingVertical: 0,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.primary,
      backgroundColor: colors.background,
      color: colors.textPrimary,
      fontSize: 13,
      lineHeight: 42,
      textAlignVertical: "center",
    },
    todoItemTextCompleted: {
      textDecorationLine: "line-through",
      color: colors.textMuted,
    },

    todoDeleteButton: {
      width: 32,
      height: 34,
      alignItems: "center",
      justifyContent: "center",
    },

    dayTaskCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    dayTaskIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },

    dayTaskInfo: {
      flex: 1,
    },

    dayTaskTitle: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    dayTaskMeta: {
      marginTop: 4,
      fontSize: 10,
      color: colors.textSecondary,
    },

    dayTaskStatus: {
      maxWidth: 85,
      fontSize: 10,
      fontWeight: "700",
      color: colors.primary,
      textAlign: "right",
    },

    dayDetailsSheet: {
      width: "100%",
      maxHeight: "88%",
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      backgroundColor: colors.background,
    },

    sheetHandle: {
      width: 42,
      height: 5,
      borderRadius: 3,
      alignSelf: "center",
      marginBottom: 18,
      backgroundColor: colors.border,
    },

    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 22,
    },

    sheetHeaderText: {
      flex: 1,
    },

    sheetTitle: {
      fontSize: 21,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    sheetDate: {
      marginTop: 5,
      fontSize: 12,
      color: colors.textSecondary,
    },

    sheetClose: {
      width: 38,
      height: 38,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },

    sheetScroll: {
      paddingBottom: 5,
    },
    punchSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    punchSectionTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    punchCount: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    punchList: {
      gap: 2,
    },

    punchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },

    punchIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },

    punchContent: {
      flex: 1,
      gap: 6,
    },

    punchTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },

    punchType: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },

    punchTime: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
      fontVariant: ["tabular-nums"],
    },

    punchLocationRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 4,
    },

    punchLocation: {
      flex: 1,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },

    punchEmpty: {
      minHeight: 160,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 20,
      borderRadius: 17,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    punchEmptyTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    punchEmptyText: {
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: colors.textSecondary,
    },

    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 11,
      backgroundColor: colors.primaryLight,
    },

    retryButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },

    content: {
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 150,
    },

    backButton: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 22,
      gap: 12,
    },

    headerIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 20,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    warningBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      padding: 12,
      marginBottom: 14,
      borderRadius: 13,
      backgroundColor: colors.warningBackground,
    },
    warningText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textPrimary,
    },

    monthHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
      gap: 8,
    },

    monthArrow: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    monthTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },

    todayButton: {
      paddingHorizontal: 13,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
    },

    todayButtonText: {
      fontSize: 12,
      fontWeight: "800",
      color: colors.primary,
    },

    calendarCard: {
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: -10,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    weekdayRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },

    weekdayCell: {
      width: "13.4%",
      alignItems: "center",
    },

    weekdayText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
    },

    daysGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
    },

    emptyDay: {
      width: "13.4%",
      height: 44,
      marginBottom: 2,
    },

    dayCell: {
      width: "13.4%",
      height: 44,
      alignItems: "center",
      justifyContent: "flex-start",
      marginBottom: 2,
      borderRadius: 12,
    },

    dayPressed: {
      opacity: 0.65,
    },

    dayNumberCircle: {
      width: 31,
      height: 31,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
    },

    selectedDayCircle: {
      backgroundColor: colors.primary,
    },

    todayCircle: {
      borderWidth: 1.5,
      borderColor: colors.primary,
    },

    dayNumber: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },

    selectedDayNumber: {
      color: colors.white,
      fontWeight: "800",
    },

    todayNumber: {
      color: colors.primary,
      fontWeight: "800",
    },

    eventDots: {
      height: 7,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      marginTop: 3,
    },

    eventDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },

    legend: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 13,
      marginTop: 17,
      marginBottom: 25,
      paddingHorizontal: 3,
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },

    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },

    legendText: {
      fontSize: 11,
      color: colors.textSecondary,
    },

    detailsSection: {
      marginTop: -5,
      marginHorizontal: -18,
      padding: 16,
      borderRadius: 0,
      backgroundColor: "transparent",
    },
    detailsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 13,
      gap: 10,
    },

    detailsHeading: {
      flex: 1,
    },

    detailsTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    detailsDate: {
      marginTop: 4,
      fontSize: 12,
      color: colors.textSecondary,
    },

    eventCount: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },

    eventList: {
      gap: 10,
    },

    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      gap: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    eventIcon: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },

    eventInfo: {
      flex: 1,
    },

    eventTitle: {
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    eventDetail: {
      marginTop: 4,
      fontSize: 11,
      lineHeight: 17,
      color: colors.textSecondary,
    },

    emptyState: {
      minHeight: 165,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
      paddingVertical: 24,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },

    emptyStateIcon: {
      width: 54,
      height: 54,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
      backgroundColor: colors.surfaceSecondary,
    },

    emptyStateTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
    },

    emptyStateText: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: colors.textSecondary,
    },

    pressed: {
      opacity: 0.7,
    },
  });
}

*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function CalendarScreen() {
  return <FeatureUnavailableScreen feature="Calendar" />;
}