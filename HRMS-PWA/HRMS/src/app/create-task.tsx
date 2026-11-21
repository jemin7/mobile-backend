/*
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  AppText as Text,
  AppTextInput as TextInput,
} from "../components/InterTypography";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  useCreateTask,
  useTaskCustomers,
  useTaskCustomerSites,
} from "../hooks/useTasks";
import { useManagerScope } from "../hooks/useManagerScope";
import { useTheme } from "../theme/ThemeProvider";

type Priority = "Low" | "Medium" | "High" | "Urgent";
type PickerMode = "date" | "time" | null;
type TaskType = "Internal Task" | "Site Visit";
type SelectionModal = "customer" | "site" | null;

const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];
function formatDate(date: Date) {
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getEmployeeName(employee: {
  id: number;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeeID?: string | null;
}) {
  return (
    [employee.employeeFirstName, employee.employeeLastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    employee.employeeID ||
    `Employee #${employee.id}`
  );
}

export default function CreateTaskScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const {
    data: managerScope,
    hasReportees,
    isLoading: isScopeLoading,
    isError: isScopeError,
    refetch: refetchScope,
  } = useManagerScope();

  const createMutation = useCreateTask();

  const reportees = managerScope?.reportees ?? [];

  const [taskName, setTaskName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("Medium");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerMode>(null);
  const [taskType, setTaskType] = useState<TaskType>("Internal Task");
  const [selectedCustomerID, setSelectedCustomerID] = useState<number | null>(
    null,
  );
  const [selectedSiteID, setSelectedSiteID] = useState<number | null>(null);
  const [activeSelection, setActiveSelection] = useState<SelectionModal>(null);
  const [selectionSearch, setSelectionSearch] = useState("");

  const [dueAt, setDueAt] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(17, 0, 0, 0);
    return date;
  });

  const customerQuery = useTaskCustomers();
  const siteQuery = useTaskCustomerSites(selectedCustomerID);

  const customers = customerQuery.data ?? [];
  const sites = siteQuery.data ?? [];

  const selectedCustomer = customers.find(
    (item) => item.id === selectedCustomerID,
  );
  const selectedSite = sites.find((item) => item.id === selectedSiteID);
  const filteredCustomers = customers.filter((item) =>
    item.customerName
      .toLowerCase()
      .includes(selectionSearch.trim().toLowerCase()),
  );

  const filteredSites = sites.filter((item) =>
    item.branchName
      .toLowerCase()
      .includes(selectionSearch.trim().toLowerCase()),
  );

  const normalizedEmployeeSearch = employeeSearch.trim().toLowerCase();

  const filteredReportees = reportees.filter((employee) => {
    const name = getEmployeeName(employee).toLowerCase();
    const employeeCode = (employee.employeeID ?? "").toLowerCase();

    return (
      !normalizedEmployeeSearch ||
      name.includes(normalizedEmployeeSearch) ||
      employeeCode.includes(normalizedEmployeeSearch)
    );
  });

  const styles = createStyles(colors);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";

    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showListener = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
    });

    const hideListener = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/tasks");
    }
  };

  const toggleEmployee = (employeeId: number) => {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  };

  const openSelection = (type: Exclude<SelectionModal, null>) => {
    setSelectionSearch("");
    setActiveSelection(type);
  };

  const selectCustomer = (id: number) => {
    setSelectedCustomerID(id);
    setSelectedSiteID(null);
    setActiveSelection(null);
  };

  const selectSite = (id: number) => {
    setSelectedSiteID(id);
    setActiveSelection(null);
  };

  const handlePickerChange = (_event: unknown, selectedDate?: Date) => {
    if (selectedDate) {
      setDueAt(selectedDate);
    }

    if (Platform.OS === "android") {
      setActivePicker(null);
    }
  };

  const handleSubmit = async () => {
    if (!taskName.trim()) {
      Alert.alert("Task name required", "Enter a name for this task.");
      return;
    }
    if (taskType === "Site Visit" && !selectedCustomerID) {
      Alert.alert("Customer required", "Please select a customer.");
      return;
    }

    if (taskType === "Site Visit" && !selectedSiteID) {
      Alert.alert("Site required", "Please select a site.");
      return;
    }
    if (selectedEmployeeIds.length === 0) {
      Alert.alert(
        "Select employees",
        "Choose at least one employee from your team.",
      );
      return;
    }

    if (dueAt.getTime() <= Date.now()) {
      Alert.alert(
        "Invalid due date",
        "The due date and time must be in the future.",
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        taskType: taskType === "Site Visit" ? "Site Visit" : "General",
        customerID:
          taskType === "Site Visit"
            ? (selectedCustomerID ?? undefined)
            : undefined,
        siteID:
          taskType === "Site Visit" ? (selectedSiteID ?? undefined) : undefined,
        taskName: taskName.trim(),
        description: description.trim() || undefined,
        priority,
        dueAt: dueAt.toISOString(),
        assignedEmployeeIds: selectedEmployeeIds,
      });

      Alert.alert(
        "Task created",
        "The task has been created and assigned successfully.",
        [{ text: "Done", onPress: handleBack }],
      );
    } catch (error) {
      Alert.alert(
        "Unable to create task",
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the task.",
      );
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "left", "right", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
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
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Create Task</Text>
            <Text style={styles.headerSubtitle}>Assign work to your team</Text>
          </View>
        </View>

        {isScopeLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateText}>Loading your team...</Text>
          </View>
        ) : isScopeError ? (
          <View style={styles.stateContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={38}
              color={colors.textMuted}
            />
            <Text style={styles.stateTitle}>Unable to load your team</Text>
            <Text style={styles.stateText}>
              Your reportee list could not be loaded.
            </Text>
            <Pressable
              onPress={() => void refetchScope()}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>Try again</Text>
            </Pressable>
          </View>
        ) : !hasReportees ? (
          <View style={styles.stateContainer}>
            <Ionicons
              name="people-outline"
              size={38}
              color={colors.textMuted}
            />
            <Text style={styles.stateTitle}>No team members found</Text>
            <Text style={styles.stateText}>
              Task creation is available to managers with reportees.
            </Text>
            <Pressable onPress={handleBack} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Go back</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.content}
            >
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Task type *</Text>

                <View style={styles.taskTypeRow}>
                  {(["Internal Task", "Site Visit"] as TaskType[]).map(
                    (item) => {
                      const selected = taskType === item;

                      return (
                        <Pressable
                          key={item}
                          onPress={() => setTaskType(item)}
                          style={[
                            styles.taskTypeOption,
                            selected && styles.taskTypeOptionSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                        >
                          <Text
                            style={[
                              styles.taskTypeText,
                              selected && styles.taskTypeTextSelected,
                            ]}
                          >
                            {item}
                          </Text>
                          {selected && (
                            <Ionicons
                              name="checkmark-circle"
                              size={17}
                              color={colors.primary}
                            />
                          )}
                        </Pressable>
                      );
                    },
                  )}
                </View>
              </View>

              {taskType === "Site Visit" && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Site visit details</Text>

                  <Text style={styles.fieldLabel}>Customer *</Text>
                  <Pressable
                    onPress={() => openSelection("customer")}
                    style={styles.selectionField}
                  >
                    <Text style={styles.selectionValue}>
                      {selectedCustomer?.customerName || "Select customer"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Text style={styles.fieldLabel}>Site *</Text>
                  <Pressable
                    onPress={() => openSelection("site")}
                    disabled={!selectedCustomerID}
                    style={[
                      styles.selectionField,
                      !selectedCustomerID && styles.selectionFieldDisabled,
                    ]}
                  >
                    <Text style={styles.selectionValue}>
                      {!selectedCustomerID
                        ? "Select customer first"
                        : selectedSite?.branchName ||
                          (siteQuery.isLoading
                            ? "Loading sites..."
                            : "Select site")}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={18}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              )}

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Task details</Text>
                <Text style={styles.fieldLabel}>Task name *</Text>
                <TextInput
                  value={taskName}
                  onChangeText={setTaskName}
                  placeholder="Enter task name"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                  maxLength={150}
                />

                <Text style={styles.fieldLabel}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Add task instructions or details..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                  style={styles.descriptionInput}
                  maxLength={1000}
                />
                <Text style={styles.characterCount}>
                  {description.length}/1000
                </Text>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Priority</Text>

                <View style={styles.priorityRow}>
                  {PRIORITIES.map((item) => {
                    const selected = priority === item;
                    const priorityColor =
                      item === "Urgent"
                        ? colors.danger
                        : item === "High"
                          ? colors.warning
                          : item === "Medium"
                            ? colors.primary
                            : colors.success;
                    return (
                      <Pressable
                        key={item}
                        onPress={() => setPriority(item)}
                        style={[
                          styles.priorityOption,
                          selected && {
                            borderColor: priorityColor,
                            backgroundColor: colors.surfaceSecondary,
                          },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <View
                          style={[
                            styles.priorityDot,
                            { backgroundColor: priorityColor },
                          ]}
                        />
                        <Text
                          style={[
                            styles.priorityText,
                            selected && { color: priorityColor },
                          ]}
                        >
                          {item}
                        </Text>
                        {selected ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={14}
                            color={priorityColor}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Due date and time *</Text>

                <View style={styles.dateTimeRow}>
                  <Pressable
                    onPress={() => setActivePicker("date")}
                    style={styles.dateTimeField}
                    accessibilityRole="button"
                    accessibilityLabel="Select due date"
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={colors.primary}
                    />
                    <View style={styles.dateTimeTextWrap}>
                      <Text style={styles.dateTimeLabel}>Due date</Text>
                      <Text style={styles.dateTimeValue}>
                        {formatDate(dueAt)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>

                  <Pressable
                    onPress={() => setActivePicker("time")}
                    style={styles.dateTimeField}
                    accessibilityRole="button"
                    accessibilityLabel="Select due time"
                  >
                    <Ionicons
                      name="time-outline"
                      size={19}
                      color={colors.primary}
                    />
                    <View style={styles.dateTimeTextWrap}>
                      <Text style={styles.dateTimeLabel}>Due time</Text>
                      <Text style={styles.dateTimeValue}>
                        {formatTime(dueAt)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-down"
                      size={17}
                      color={colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.assigneeHeader}>
                  <View style={styles.assigneeTitleWrap}>
                    <Text style={styles.sectionTitle}>Assign employees *</Text>
                  </View>
                  <View style={styles.selectedCount}>
                    <Text style={styles.selectedCountText}>
                      {selectedEmployeeIds.length} selected
                    </Text>
                  </View>
                </View>

                <View style={styles.employeeSearchWrap}>
                  <Ionicons
                    name="search-outline"
                    size={19}
                    color={colors.textMuted}
                  />

                  <TextInput
                    value={employeeSearch}
                    onChangeText={setEmployeeSearch}
                    placeholder="Search employee name or ID"
                    placeholderTextColor={colors.textMuted}
                    style={styles.employeeSearchInput}
                  />

                  {employeeSearch.length > 0 && (
                    <Pressable
                      onPress={() => setEmployeeSearch("")}
                      accessibilityRole="button"
                      accessibilityLabel="Clear employee search"
                    >
                      <Ionicons
                        name="close-circle"
                        size={19}
                        color={colors.textMuted}
                      />
                    </Pressable>
                  )}
                </View>

                {filteredReportees.map((employee) => {
                  const selected = selectedEmployeeIds.includes(employee.id);
                  const employeeName = getEmployeeName(employee);

                  return (
                    <Pressable
                      key={employee.id}
                      onPress={() => toggleEmployee(employee.id)}
                      style={[
                        styles.employeeRow,
                        selected && styles.employeeRowSelected,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={`Assign ${employeeName}`}
                    >
                      <View
                        style={[
                          styles.employeeAvatar,
                          selected && styles.employeeAvatarSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.employeeAvatarText,
                            selected && styles.employeeAvatarTextSelected,
                          ]}
                        >
                          {employeeName.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>{employeeName}</Text>
                        {employee.employeeID ? (
                          <Text style={styles.employeeCode}>
                            {employee.employeeID}
                          </Text>
                        ) : null}
                      </View>

                      <Ionicons
                        name={selected ? "checkbox" : "square-outline"}
                        size={22}
                        color={selected ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  );
                })}

                {filteredReportees.length === 0 && (
                  <Text style={styles.noEmployeesText}>
                    No employees match your search.
                  </Text>
                )}
              </View>
            </ScrollView>

            {!isKeyboardVisible && (
              <View style={styles.submitFooter}>
                <Pressable
                  onPress={handleSubmit}
                  disabled={createMutation.isPending}
                  style={[
                    styles.submitButton,
                    createMutation.isPending && styles.submitButtonDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Create and assign task"
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Ionicons
                      name="add-circle-outline"
                      size={20}
                      color={colors.white}
                    />
                  )}

                  <Text style={styles.submitButtonText}>
                    {createMutation.isPending
                      ? "Creating task..."
                      : "Create and assign task"}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}

        {activePicker && Platform.OS === "android" ? (
          <DateTimePicker
            value={dueAt}
            mode={activePicker}
            display="default"
            minimumDate={activePicker === "date" ? new Date() : undefined}
            onValueChange={handlePickerChange}
            onDismiss={() => setActivePicker(null)}
          />
        ) : null}

        <Modal
          visible={activePicker !== null && Platform.OS === "ios"}
          transparent
          animationType="slide"
          onRequestClose={() => setActivePicker(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setActivePicker(null)}
            />
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {activePicker === "date"
                    ? "Select due date"
                    : "Select due time"}
                </Text>
                <Pressable onPress={() => setActivePicker(null)} hitSlop={10}>
                  <Ionicons name="close" size={23} color={colors.textPrimary} />
                </Pressable>
              </View>

              {activePicker ? (
                <DateTimePicker
                  value={dueAt}
                  mode={activePicker}
                  display="spinner"
                  minimumDate={activePicker === "date" ? new Date() : undefined}
                  onValueChange={handlePickerChange}
                  onDismiss={() => setActivePicker(null)}
                  style={styles.iosPicker}
                />
              ) : null}

              <Pressable
                onPress={() => setActivePicker(null)}
                style={styles.pickerDoneButton}
              >
                <Text style={styles.pickerDoneText}>Done</Text>
              </Pressable>
            </View>
          </View>
        </Modal>

        <Modal
          visible={activeSelection !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setActiveSelection(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={styles.modalBackdrop}
              onPress={() => setActiveSelection(null)}
            />

            <View style={styles.selectionSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {activeSelection === "customer"
                    ? "Select Customer"
                    : "Select Site"}
                </Text>
                <Pressable onPress={() => setActiveSelection(null)}>
                  <Ionicons name="close" size={23} color={colors.textPrimary} />
                </Pressable>
              </View>

              <View style={styles.employeeSearchWrap}>
                <Ionicons
                  name="search-outline"
                  size={19}
                  color={colors.textMuted}
                />
                <TextInput
                  value={selectionSearch}
                  onChangeText={setSelectionSearch}
                  placeholder="Search..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.employeeSearchInput}
                />
              </View>

              <ScrollView
                style={styles.selectionList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {activeSelection === "customer" ? (
                  customerQuery.isLoading ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : customerQuery.isError ? (
                    <Pressable
                      onPress={() => void customerQuery.refetch()}
                      style={styles.retryButton}
                    >
                      <Text style={styles.retryButtonText}>
                        Retry loading customers
                      </Text>
                    </Pressable>
                  ) : filteredCustomers.length === 0 ? (
                    <Text style={styles.selectionEmpty}>
                      No customers found.
                    </Text>
                  ) : (
                    filteredCustomers.map((item) => (
                      <Pressable
                        key={item.id}
                        onPress={() => selectCustomer(item.id)}
                        style={[
                          styles.selectionOption,
                          selectedCustomerID === item.id &&
                            styles.selectionOptionSelected,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.selectionOptionText}>
                            {item.customerName}
                          </Text>
                          {item.customerCode ? (
                            <Text style={styles.selectionOptionMeta}>
                              {item.customerCode}
                            </Text>
                          ) : null}
                        </View>
                        {selectedCustomerID === item.id && (
                          <Ionicons
                            name="checkmark-circle"
                            size={21}
                            color={colors.primary}
                          />
                        )}
                      </Pressable>
                    ))
                  )
                ) : siteQuery.isLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : siteQuery.isError ? (
                  <Pressable
                    onPress={() => void siteQuery.refetch()}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryButtonText}>
                      Retry loading sites
                    </Text>
                  </Pressable>
                ) : filteredSites.length === 0 ? (
                  <Text style={styles.selectionEmpty}>No sites found.</Text>
                ) : (
                  filteredSites.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => selectSite(item.id)}
                      style={[
                        styles.selectionOption,
                        selectedSiteID === item.id &&
                          styles.selectionOptionSelected,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectionOptionText}>
                          {item.branchName}
                        </Text>
                        <Text style={styles.selectionOptionMeta}>
                          {[item.siteCode, item.city]
                            .filter(Boolean)
                            .join(" • ")}
                        </Text>
                      </View>
                      {selectedSiteID === item.id && (
                        <Ionicons
                          name="checkmark-circle"
                          size={21}
                          color={colors.primary}
                        />
                      )}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  success: string;
  warning: string;
  danger: string;
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
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 12,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },
    headerText: {
      flex: 1,
    },
    headerTitle: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    headerSubtitle: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSecondary,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 24,
    },
    formScroll: {
      flex: 1,
    },
    submitFooter: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    section: {
      marginTop: 3,
    },
    taskTypeRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    taskTypeOption: {
      flex: 1,
      minHeight: 50,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    taskTypeOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    taskTypeText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    taskTypeTextSelected: {
      color: colors.primary,
    },
    selectionSheet: {
      maxHeight: "75%",
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      backgroundColor: colors.surface,
    },
    selectionList: {
      maxHeight: 400,
      marginTop: 12,
    },
    selectionOption: {
      minHeight: 60,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 13,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    selectionOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    selectionOptionText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    selectionOptionMeta: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textMuted,
    },
    selectionEmpty: {
      paddingVertical: 24,
      textAlign: "center",
      fontSize: 13,
      color: colors.textMuted,
    },
    selectionField: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    selectionFieldDisabled: {
      opacity: 0.55,
    },
    selectionValue: {
      flex: 1,
      fontSize: 14,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    sectionTitle: {
      marginTop: 2,
      marginBottom: 4,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    fieldLabel: {
      marginBottom: 7,
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    input: {
      minHeight: 54,
      paddingHorizontal: 14,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: 17,
    },
    descriptionInput: {
      minHeight: 120,
      paddingHorizontal: 14,
      paddingTop: 13,
      paddingBottom: 13,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textPrimary,
    },
    characterCount: {
      marginTop: 6,
      textAlign: "right",
      fontSize: 11,
      color: colors.textMuted,
    },
    priorityRow: {
      flexDirection: "row",
      gap: 8,
    },
    priorityOption: {
      flex: 1,
      minWidth: 0,
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 3,
    },
    priorityDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    priorityText: {
      flexShrink: 1,
      fontSize: 10.5,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    dateTimeRow: {
      flexDirection: "row",
      gap: 10,
    },
    dateTimeField: {
      flex: 1,
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 10,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateTimeTextWrap: {
      flex: 1,
    },
    dateTimeLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginBottom: 4,
    },
    dateTimeValue: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    employeeSearchWrap: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 13,
      marginBottom: 12,
      borderRadius: 13,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    employeeSearchInput: {
      flex: 1,
      minHeight: 44,
      paddingVertical: 0,
      fontSize: 13,
      color: colors.textPrimary,
    },
    noEmployeesText: {
      paddingVertical: 14,
      textAlign: "center",
      fontSize: 12,
      color: colors.textMuted,
    },
    assigneeHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    assigneeTitleWrap: {
      flex: 1,
    },
    selectedCount: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: colors.primaryLight,
      marginLeft: 8,
    },
    selectedCountText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.primary,
    },
    employeeRow: {
      minHeight: 67,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 15,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    employeeRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    employeeAvatar: {
      width: 39,
      height: 39,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
      marginRight: 11,
    },
    employeeAvatarSelected: {
      backgroundColor: colors.surface,
    },
    employeeAvatarText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    employeeAvatarTextSelected: {
      color: colors.primary,
    },
    employeeInfo: {
      flex: 1,
    },
    employeeName: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    employeeCode: {
      marginTop: 3,
      fontSize: 10,
      color: colors.textMuted,
    },
    submitButton: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      marginTop: 0,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    submitButtonDisabled: {
      opacity: 0.65,
    },
    submitButtonText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.white,
    },
    stateContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 30,
    },
    stateTitle: {
      marginTop: 15,
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateText: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 18,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.38)",
    },
    modalBackdrop: {
      ...StyleSheet.absoluteFill,
    },
    pickerSheet: {
      paddingTop: 18,
      paddingHorizontal: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      backgroundColor: colors.surface,
    },
    pickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    pickerTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    iosPicker: {
      alignSelf: "center",
    },
    pickerDoneButton: {
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 10,
      borderRadius: 15,
      backgroundColor: colors.primary,
    },
    pickerDoneText: {
      fontSize: 15,
      fontWeight: "800",
      color: colors.white,
    },
    pressed: {
      opacity: 0.75,
    },
  });
}

*/

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function CreateTaskScreen() {
  return <FeatureUnavailableScreen feature="Task creation" />;
}