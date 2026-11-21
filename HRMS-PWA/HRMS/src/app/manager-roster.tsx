/*
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { AppText as Text } from "../components/InterTypography";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  type ManagerRosterDay,
  type ManagerRosterDayType,
  type ManagerRosterLeaveType,
  type ManagerRosterEmployee,
} from "../api/managerRoster";
import { useManagerRoster } from "../hooks/useManagerRoster";
import { useTheme } from "../theme/ThemeProvider";

type DateField = "from" | "to" | null;
type AssignmentType = ManagerRosterDayType;

const LEAVE_TYPES: ManagerRosterLeaveType[] = [
  "CASUAL",
  "SICK",
  "PL",
  "COMP_OFF",
  "LOP",
];

function toApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromApiDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value: string) {
  return fromApiDate(value).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatShortDate(value: Date) {
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getEmployeeName(employee: ManagerRosterEmployee) {
  const name = [employee.employeeFirstName, employee.employeeLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || employee.employeeID || `Employee #${employee.id}`;
}

function getAssignment(employee: ManagerRosterEmployee, date: string) {
  return employee.days.find((day) => day.workDate.slice(0, 10) === date);
}

function getAssignmentLabel(day?: ManagerRosterDay) {
  if (!day) return "Not assigned";

  if (day.dayType === "WORK") {
    return day.workShift?.workShiftName || "Assigned shift";
  }

  if (day.dayType === "WEEKLY_OFF") return "Weekly Off";

  return `Leave · ${(day.leaveType || "Leave").replaceAll("_", " ")}`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export default function ManagerRosterScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [selectedDate, setSelectedDate] = useState(() => toApiDate(new Date()));
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<number>>(
    new Set(),
  );

  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentFrom, setAssignmentFrom] = useState(new Date());
  const [assignmentTo, setAssignmentTo] = useState(new Date());
  const [assignmentType, setAssignmentType] = useState<AssignmentType>("WORK");
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [selectedLeaveType, setSelectedLeaveType] =
    useState<ManagerRosterLeaveType>("CASUAL");

  const [activeDateField, setActiveDateField] = useState<DateField>(null);
  const [pickerDate, setPickerDate] = useState(new Date());

  const {
    data,
    hasReportees,
    isScopeLoading,
    isScopeError,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    assignMutation,
    deleteMutation,
  } = useManagerRoster(selectedDate, selectedDate);

  const employees = data?.employees ?? [];
  const shifts = data?.shifts ?? [];

  const selectedEmployees = employees.filter((employee) =>
    selectedEmployeeIds.has(employee.id),
  );

  const compatibleShifts = shifts.filter(
    (shift) =>
      shift.isActive !== "0" &&
      selectedEmployees.every(
        (employee) =>
          Number(shift.companyID) === Number(employee.companyID) &&
          Number(shift.branchesID) === Number(employee.branchesID),
      ),
  );

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  const changeSelectedDate = (days: number) => {
    const nextDate = fromApiDate(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    setSelectedDate(toApiDate(nextDate));
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((previous) => {
      const next = new Set(previous);

      if (next.has(employeeId)) {
        next.delete(employeeId);
      } else {
        next.add(employeeId);
      }

      return next;
    });

    setSelectedShiftId(null);
  };

  const toggleAllEmployees = () => {
    setSelectedEmployeeIds((previous) =>
      previous.size === employees.length
        ? new Set()
        : new Set(employees.map((employee) => employee.id)),
    );

    setSelectedShiftId(null);
  };

  const openAssignmentModal = () => {
    if (selectedEmployeeIds.size === 0) {
      Alert.alert("Select employees", "Select at least one team member.");
      return;
    }

    const date = fromApiDate(selectedDate);

    setAssignmentFrom(date);
    setAssignmentTo(date);
    setAssignmentType("WORK");
    setSelectedShiftId(null);
    setSelectedLeaveType("CASUAL");
    setShowAssignmentModal(true);
  };

  const openDatePicker = (field: "from" | "to") => {
    setPickerDate(field === "from" ? assignmentFrom : assignmentTo);
    setActiveDateField(field);
  };

  const handleDateValueChange = (_event: unknown, date?: Date) => {
    if (!date) {
      if (Platform.OS === "android") setActiveDateField(null);
      return;
    }

    setPickerDate(date);

    if (activeDateField === "from") {
      setAssignmentFrom(date);

      if (assignmentTo < date) {
        setAssignmentTo(date);
      }
    } else if (activeDateField === "to") {
      setAssignmentTo(date);
    }

    if (Platform.OS === "android") {
      setActiveDateField(null);
    }
  };

  const handleAssignment = async () => {
    if (selectedEmployeeIds.size === 0) {
      Alert.alert("Select employees", "Select at least one employee.");
      return;
    }

    if (assignmentTo < assignmentFrom) {
      Alert.alert("Invalid dates", "To date cannot be before From date.");
      return;
    }

    if (assignmentType === "WORK") {
      if (!selectedShiftId) {
        Alert.alert("Select shift", "Please select a work shift.");
        return;
      }

      if (!compatibleShifts.some((shift) => shift.id === selectedShiftId)) {
        Alert.alert(
          "Invalid shift",
          "The selected shift is not available for all selected employees.",
        );
        return;
      }
    }

    let completed = 0;

    try {
      for (const employeeId of selectedEmployeeIds) {
        await assignMutation.mutateAsync({
          employeeID: employeeId,
          fromDate: toApiDate(assignmentFrom),
          toDate: toApiDate(assignmentTo),
          dayType: assignmentType,
          ...(assignmentType === "WORK"
            ? { workShiftID: selectedShiftId! }
            : {}),
          ...(assignmentType === "LEAVE"
            ? { leaveType: selectedLeaveType }
            : {}),
        });

        completed += 1;
      }

      setShowAssignmentModal(false);
      setSelectedEmployeeIds(new Set());

      Alert.alert(
        "Success",
        `Roster assigned to ${completed} employee${completed === 1 ? "" : "s"}.`,
      );
    } catch (assignmentError) {
      await refetch();

      Alert.alert(
        "Assignment incomplete",
        completed > 0
          ? `${completed} employee(s) were assigned. The next assignment failed: ${getErrorMessage(assignmentError)}`
          : getErrorMessage(assignmentError),
      );
    }
  };

  const handleDeleteAssignment = (day: ManagerRosterDay) => {
    if (day.isLocked) {
      Alert.alert(
        "Locked assignment",
        "This roster assignment cannot be removed.",
      );
      return;
    }

    Alert.alert(
      "Remove assignment?",
      "Do you want to remove this employee's roster assignment for this date?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(day.id);
            } catch (deleteError) {
              Alert.alert(
                "Unable to remove assignment",
                getErrorMessage(deleteError),
              );
            }
          },
        },
      ],
    );
  };

  const renderEmployee = (employee: ManagerRosterEmployee) => {
    const selected = selectedEmployeeIds.has(employee.id);
    const day = getAssignment(employee, selectedDate);

    return (
      <View
        key={employee.id}
        style={[styles.employeeCard, selected && styles.employeeCardSelected]}
      >
        <Pressable
          onPress={() => toggleEmployee(employee.id)}
          style={styles.employeeHeader}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          accessibilityLabel={`Select ${getEmployeeName(employee)}`}
        >
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName} numberOfLines={1}>
              {getEmployeeName(employee)}
            </Text>

            <Text style={styles.employeeMeta} numberOfLines={1}>
              {employee.employeeID || `ID: ${employee.id}`}
              {employee.departments?.departmentName
                ? ` · ${employee.departments.departmentName}`
                : ""}
            </Text>
          </View>

          <Ionicons
            name={selected ? "checkbox" : "square-outline"}
            size={23}
            color={selected ? colors.primary : colors.textMuted}
          />
        </Pressable>

        <View style={styles.assignmentRow}>
          <View
            style={[
              styles.assignmentStatus,
              day?.dayType === "WORK" && styles.workStatus,
              day?.dayType === "WEEKLY_OFF" && styles.offStatus,
              day?.dayType === "LEAVE" && styles.leaveStatus,
              !day && styles.unassignedStatus,
            ]}
          >
            <Text style={styles.assignmentLabel}>
              {getAssignmentLabel(day)}
            </Text>

            {day?.isLocked ? (
              <View style={styles.lockedLabel}>
                <Ionicons
                  name="lock-closed-outline"
                  size={12}
                  color={colors.textSecondary}
                />
                <Text style={styles.lockedText}>Locked</Text>
              </View>
            ) : null}
          </View>

          {day && !day.isLocked ? (
            <Pressable
              onPress={() => handleDeleteAssignment(day)}
              disabled={deleteMutation.isPending}
              style={styles.removeButton}
              accessibilityRole="button"
              accessibilityLabel="Remove roster assignment"
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  const isBusy = assignMutation.isPending;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>Team Roster</Text>
            <Text style={styles.subtitle}>Manage shifts and days off</Text>
          </View>
        </View>

        <View style={styles.dateCard}>
          <Pressable
            onPress={() => changeSelectedDate(-1)}
            style={styles.dateArrow}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>

          <Pressable
            onPress={() => setSelectedDate(toApiDate(new Date()))}
            style={styles.dateCenter}
            accessibilityRole="button"
            accessibilityLabel="Go to today"
          >
            <Text style={styles.dateLabel}>{formatDate(selectedDate)}</Text>
            <Text style={styles.todayHint}>Tap to return to today</Text>
          </Pressable>

          <Pressable
            onPress={() => changeSelectedDate(1)}
            style={styles.dateArrow}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.textPrimary}
            />
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <View>
            <Text style={styles.sectionTitle}>Employees</Text>
            <Text style={styles.sectionSubtitle}>
              {employees.length} team member{employees.length === 1 ? "" : "s"}
            </Text>
          </View>

          {employees.length > 0 ? (
            <Pressable
              onPress={toggleAllEmployees}
              style={styles.selectAllButton}
            >
              <Text style={styles.selectAllText}>
                {selectedEmployeeIds.size === employees.length
                  ? "Clear"
                  : "Select all"}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {selectedEmployeeIds.size > 0 ? (
          <Pressable
            onPress={openAssignmentModal}
            disabled={isBusy}
            style={({ pressed }) => [
              styles.assignButton,
              pressed && styles.pressed,
              isBusy && styles.disabledButton,
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={19} color={colors.white} />
            <Text style={styles.assignButtonText}>
              Assign roster ({selectedEmployeeIds.size})
            </Text>
          </Pressable>
        ) : null}

        <ScrollView
          style={styles.employeeList}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
            />
          }
        >
          {isScopeLoading || isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>Loading team roster…</Text>
            </View>
          ) : isScopeError ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={colors.danger}
              />
              <Text style={styles.stateTitle}>
                Unable to load manager access
              </Text>
              <Text style={styles.stateText}>
                Please try again or contact your administrator.
              </Text>
            </View>
          ) : isError ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="cloud-offline-outline"
                size={30}
                color={colors.textMuted}
              />
              <Text style={styles.stateTitle}>Couldn&apos;t load roster</Text>
              <Text style={styles.stateText}>{getErrorMessage(error)}</Text>
              <Pressable
                onPress={() => void refetch()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : !hasReportees ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="people-outline"
                size={32}
                color={colors.textMuted}
              />
              <Text style={styles.stateTitle}>No team members found</Text>
              <Text style={styles.stateText}>
                Roster management is available to employees with reportees.
              </Text>
            </View>
          ) : employees.length === 0 ? (
            <View style={styles.stateCard}>
              <Text style={styles.stateTitle}>No active employees</Text>
              <Text style={styles.stateText}>
                No active reportees are available for roster management.
              </Text>
            </View>
          ) : (
            employees.map(renderEmployee)
          )}
        </ScrollView>
      </View>

      <Modal
        visible={showAssignmentModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setActiveDateField(null);
          setShowAssignmentModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => {
              setActiveDateField(null);
              setShowAssignmentModal(false);
            }}
          />

          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeadingText}>
                <Text style={styles.modalTitle}>Assign roster</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedEmployeeIds.size} employee(s) selected
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  setActiveDateField(null);
                  setShowAssignmentModal(false);
                }}
                style={styles.closeButton}
                accessibilityRole="button"
                accessibilityLabel="Close assignment form"
              >
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              <Text style={styles.fieldLabel}>Assignment date range</Text>

              <View style={styles.dateFields}>
                <Pressable
                  onPress={() => openDatePicker("from")}
                  style={styles.dateField}
                >
                  <Text style={styles.dateFieldLabel}>From</Text>
                  <Text style={styles.dateFieldValue}>
                    {formatShortDate(assignmentFrom)}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => openDatePicker("to")}
                  style={styles.dateField}
                >
                  <Text style={styles.dateFieldLabel}>To</Text>
                  <Text style={styles.dateFieldValue}>
                    {formatShortDate(assignmentTo)}
                  </Text>
                </Pressable>
              </View>

              {activeDateField ? (
                <View style={styles.datePickerPanel}>
                  <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    minimumDate={
                      activeDateField === "to" ? assignmentFrom : undefined
                    }
                    onValueChange={handleDateValueChange}
                    onDismiss={() => setActiveDateField(null)}
                  />

                  {Platform.OS === "ios" ? (
                    <Pressable
                      onPress={() => setActiveDateField(null)}
                      style={styles.pickerDoneButton}
                    >
                      <Text style={styles.pickerDoneText}>Done</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Text style={styles.fieldLabel}>Assignment type</Text>

              <View style={styles.optionRow}>
                {(
                  [
                    ["WORK", "Shift"],
                    ["WEEKLY_OFF", "Weekly off"],
                    ["LEAVE", "Leave"],
                  ] as const
                ).map(([type, label]) => {
                  const selected = assignmentType === type;

                  return (
                    <Pressable
                      key={type}
                      onPress={() => {
                        setAssignmentType(type);
                        setSelectedShiftId(null);
                      }}
                      style={[
                        styles.optionButton,
                        selected && styles.optionButtonSelected,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {assignmentType === "WORK" ? (
                <>
                  <Text style={styles.fieldLabel}>Select shift</Text>

                  {compatibleShifts.length === 0 ? (
                    <Text style={styles.helperText}>
                      No common rotating shift is available for all selected
                      employees.
                    </Text>
                  ) : (
                    compatibleShifts.map((shift) => {
                      const selected = selectedShiftId === shift.id;

                      return (
                        <Pressable
                          key={shift.id}
                          onPress={() => setSelectedShiftId(shift.id)}
                          style={[
                            styles.shiftOption,
                            selected && styles.shiftOptionSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {shift.workShiftName || `Shift ${shift.id}`}
                          </Text>

                          <Ionicons
                            name={
                              selected ? "radio-button-on" : "radio-button-off"
                            }
                            size={19}
                            color={selected ? colors.primary : colors.textMuted}
                          />
                        </Pressable>
                      );
                    })
                  )}
                </>
              ) : null}

              {assignmentType === "LEAVE" ? (
                <>
                  <Text style={styles.fieldLabel}>Leave type</Text>

                  <View style={styles.optionRow}>
                    {LEAVE_TYPES.map((type) => {
                      const selected = selectedLeaveType === type;

                      return (
                        <Pressable
                          key={type}
                          onPress={() => setSelectedLeaveType(type)}
                          style={[
                            styles.optionButton,
                            selected && styles.optionButtonSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.optionText,
                              selected && styles.optionTextSelected,
                            ]}
                          >
                            {type.replaceAll("_", " ")}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <Text style={styles.helperText}>
                Existing assignments and approved leave dates cannot be
                overwritten. Remove an existing assignment first.
              </Text>

              <Pressable
                onPress={() => void handleAssignment()}
                disabled={isBusy}
                style={[styles.submitButton, isBusy && styles.disabledButton]}
                accessibilityRole="button"
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Apply to selected employees
                  </Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      paddingHorizontal: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      gap: 12,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    headerText: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    dateCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 17,
      padding: 8,
      marginTop: 8,
    },
    dateArrow: {
      width: 42,
      height: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
    },
    dateCenter: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 4,
    },
    dateLabel: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    todayHint: {
      marginTop: 3,
      fontSize: 10,
      color: colors.textMuted,
    },
    listHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginTop: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSecondary,
    },
    selectAllButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 11,
      backgroundColor: colors.primaryLight,
    },
    selectAllText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
    },
    assignButton: {
      minHeight: 46,
      borderRadius: 14,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      marginBottom: 12,
    },
    assignButtonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "800",
    },
    employeeList: {
      flex: 1,
    },
    listContent: {
      paddingBottom: 24,
      gap: 10,
    },
    employeeCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 13,
    },
    employeeCardSelected: {
      borderColor: colors.primary,
    },
    employeeHeader: {
      minHeight: 42,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    employeeInfo: {
      flex: 1,
      minWidth: 0,
    },
    employeeName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    employeeMeta: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    assignmentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 11,
    },
    assignmentStatus: {
      flex: 1,
      minHeight: 38,
      paddingHorizontal: 11,
      borderRadius: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    workStatus: {
      backgroundColor: colors.primaryLight,
    },
    offStatus: {
      backgroundColor: colors.successBackground,
    },
    leaveStatus: {
      backgroundColor: colors.warningBackground,
    },
    unassignedStatus: {
      backgroundColor: colors.surfaceSecondary,
    },
    assignmentLabel: {
      flex: 1,
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    lockedLabel: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    lockedText: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    removeButton: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: colors.dangerBackground,
      alignItems: "center",
      justifyContent: "center",
    },
    stateCard: {
      marginTop: 30,
      padding: 24,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: "center",
      gap: 9,
    },
    stateTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.white,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.35)",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    modalSheet: {
      maxHeight: "90%",
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 24,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    modalHeadingText: {
      flex: 1,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    modalSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSecondary,
    },
    closeButton: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },
    modalContent: {
      paddingBottom: 12,
      gap: 10,
    },
    fieldLabel: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    dateFields: {
      flexDirection: "row",
      gap: 10,
    },
    dateField: {
      flex: 1,
      minHeight: 58,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
    },
    dateFieldLabel: {
      fontSize: 10,
      color: colors.textSecondary,
    },
    dateFieldValue: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    datePickerPanel: {
      padding: 8,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      alignItems: "center",
    },
    pickerDoneButton: {
      alignSelf: "flex-end",
      paddingHorizontal: 18,
      paddingVertical: 9,
    },
    pickerDoneText: {
      color: colors.primary,
      fontWeight: "800",
    },
    optionRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    optionButton: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 11,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    optionButtonSelected: {
      backgroundColor: colors.primaryLight,
      borderColor: colors.primary,
    },
    optionText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    optionTextSelected: {
      color: colors.primary,
    },
    shiftOption: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    shiftOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    helperText: {
      fontSize: 11,
      lineHeight: 17,
      color: colors.textSecondary,
    },
    submitButton: {
      minHeight: 48,
      marginTop: 8,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    submitButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.white,
    },
    disabledButton: {
      opacity: 0.55,
    },
    pressed: {
      opacity: 0.72,
    },
  });
}
*/

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function ManagerRosterScreen() {
  return <FeatureUnavailableScreen feature="Manager roster" />;
}