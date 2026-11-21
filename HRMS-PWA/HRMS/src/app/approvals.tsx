/*
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Modal,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "../components/InterTypography";
import { useTeamApprovals } from "../hooks/useTeamApprovals";
import { useAuth } from "../auth/AuthProvider";
import {
  approveWorkflowRequest,
  decideTeamAdvance,
  rejectWorkflowRequest,
  decideTeamLeave,
  getTeamEmployeeLeaveContext,
  type TeamLeaveApproval,
  type TeamEmployeeLeaveContext,
} from "../api/approvals";
import {
  approveReimbursementItem,
  rejectReimbursementItem,
} from "../api/reimbursement";
import { useTheme } from "../theme/ThemeProvider";

import {
  buildLeaveDays,
  getAvailableLeaveTypes,
  toggleLeaveDay,
  buildLeaveApprovalPayload,
  type LeaveDayStatus,
  type LeaveApprovalType,
  restoreLeaveDays,
  restoreExistingLeaveDaysToBalance,
} from "../utils/leaveApproval";

type TeamColors = ReturnType<typeof useTheme>["colors"];
type ApprovalFilter =
  | "all"
  | "leave"
  | "reimbursement"
  | "advance"
  | "regularisation";

function getEmployeeName(
  employee?: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  } | null,
) {
  const name = [employee?.employeeFirstName, employee?.employeeLastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || employee?.employeeID || "Team member";
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const datePart = value.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) return value;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatAmount(value?: string | number | null) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return "₹0.00";

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ApprovalsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();
  const [actingAdvanceId, setActingAdvanceId] = useState<number | null>(null);
  const [actingReimbursementItemId, setActingReimbursementItemId] = useState<
    number | null
  >(null);
  const [actingRegularisationId, setActingRegularisationId] = useState<
    number | null
  >(null);
  const [rejectionTarget, setRejectionTarget] = useState<{
    id: number;
    requestId: number;
  } | null>(null);
  const [rejectionRemark, setRejectionRemark] = useState("");

  const [leaveApprovalTarget, setLeaveApprovalTarget] =
    useState<TeamLeaveApproval | null>(null);
  const [leaveApprovalContext, setLeaveApprovalContext] =
    useState<TeamEmployeeLeaveContext | null>(null);
  const [leaveApprovalDays, setLeaveApprovalDays] = useState<LeaveDayStatus[]>(
    [],
  );
  const [selectedLeaveType, setSelectedLeaveType] = useState<
    Exclude<LeaveApprovalType, ""> | ""
  >("");
  const [selectedLeaveDayType, setSelectedLeaveDayType] =
    useState<LeaveDayStatus["dayType"]>(undefined);
  const [loadingLeaveContext, setLoadingLeaveContext] = useState(false);
  const [actingLeaveId, setActingLeaveId] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<ApprovalFilter>("all");

  const { data, isLoading, isError, error, isRefetching, refetch } =
    useTeamApprovals();

  const handleAdvanceDecision = (
    id: number,
    status: "Approved" | "Rejected",
  ) => {
    if (!data?.employeeId || !accessToken) {
      Alert.alert(
        "Unable to continue",
        "Employee authentication is unavailable.",
      );
      return;
    }

    Alert.alert(
      `${status} salary advance?`,
      `Are you sure you want to ${status.toLowerCase()} this salary advance request?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: status,
          style: status === "Rejected" ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              setActingAdvanceId(id);

              try {
                await decideTeamAdvance(
                  data.employeeId,
                  id,
                  status,
                  accessToken,
                );

                await refetch();

                Alert.alert(
                  "Success",
                  `Salary advance request ${status.toLowerCase()} successfully.`,
                );
              } catch (decisionError) {
                Alert.alert(
                  "Unable to update request",
                  decisionError instanceof Error
                    ? decisionError.message
                    : "Please try again.",
                );
              } finally {
                setActingAdvanceId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleReimbursementDecision = (
    reimbursementId: number,
    itemId: number,
    status: "Approved" | "Rejected",
  ) => {
    if (!accessToken) {
      Alert.alert("Unable to continue", "Authentication is unavailable.");
      return;
    }

    Alert.alert(
      `${status} expense?`,
      `Are you sure you want to ${status.toLowerCase()} this expense item?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: status,
          style: status === "Rejected" ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              setActingReimbursementItemId(itemId);

              try {
                const payload = { actorRole: "MANAGER" };

                if (status === "Approved") {
                  await approveReimbursementItem(
                    reimbursementId,
                    itemId,
                    payload,
                    accessToken,
                  );
                } else {
                  await rejectReimbursementItem(
                    reimbursementId,
                    itemId,
                    payload,
                    accessToken,
                  );
                }

                await refetch();

                Alert.alert(
                  "Success",
                  `Expense ${status.toLowerCase()} successfully.`,
                );
              } catch (decisionError) {
                Alert.alert(
                  "Unable to update expense",
                  decisionError instanceof Error
                    ? decisionError.message
                    : "Please try again.",
                );
              } finally {
                setActingReimbursementItemId(null);
              }
            })();
          },
        },
      ],
    );
  };
  const handleRegularisationApproval = (id: number, requestId: number) => {
    if (!accessToken) {
      Alert.alert("Unable to continue", "Authentication is unavailable.");
      return;
    }

    Alert.alert(
      "Approve regularization?",
      "Are you sure you want to approve this attendance regularization?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => {
            void (async () => {
              setActingRegularisationId(id);

              try {
                await approveWorkflowRequest(requestId, "", accessToken);
                await refetch();

                Alert.alert("Success", "Regularization approved successfully.");
              } catch (decisionError) {
                Alert.alert(
                  "Unable to approve",
                  decisionError instanceof Error
                    ? decisionError.message
                    : "Please try again.",
                );
              } finally {
                setActingRegularisationId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleRegularisationRejection = async () => {
    if (!rejectionTarget || !accessToken) {
      Alert.alert("Unable to continue", "Authentication is unavailable.");
      return;
    }

    const remark = rejectionRemark.trim();

    if (!remark) {
      Alert.alert("Reason required", "Enter a reason before rejecting.");
      return;
    }

    const { id, requestId } = rejectionTarget;
    setActingRegularisationId(id);

    try {
      await rejectWorkflowRequest(requestId, remark, accessToken);
      setRejectionTarget(null);
      setRejectionRemark("");
      await refetch();

      Alert.alert("Success", "Regularization rejected successfully.");
    } catch (decisionError) {
      Alert.alert(
        "Unable to reject",
        decisionError instanceof Error
          ? decisionError.message
          : "Please try again.",
      );
    } finally {
      setActingRegularisationId(null);
    }
  };
  const openLeaveApproval = async (item: TeamLeaveApproval) => {
    if (!accessToken) {
      Alert.alert("Unable to continue", "Authentication is unavailable.");
      return;
    }

    setLeaveApprovalTarget(item);
    setLeaveApprovalContext(null);
    setLeaveApprovalDays(buildLeaveDays(item.fromDate, item.toDate));
    setSelectedLeaveType("");
    setSelectedLeaveDayType(undefined);
    setLoadingLeaveContext(true);

    try {
      const initialDays =
        item.status === "Partially Approved"
          ? restoreLeaveDays(item.fromDate, item.toDate, item.dayStatuses)
          : buildLeaveDays(item.fromDate, item.toDate);

      setLeaveApprovalDays(initialDays);

      const context = await getTeamEmployeeLeaveContext(
        item.manageEmployeeID,
        item.manageEmployee?.gender,
        accessToken,
      );

      const updatedContext =
        item.status === "Partially Approved"
          ? {
              ...context,
              balance: restoreExistingLeaveDaysToBalance(
                context.balance,
                initialDays,
              ),
            }
          : context;

      setLeaveApprovalContext(updatedContext);
    } catch (contextError) {
      setLeaveApprovalTarget(null);

      Alert.alert(
        "Unable to load leave balance",
        contextError instanceof Error
          ? contextError.message
          : "Please try again.",
      );
    } finally {
      setLoadingLeaveContext(false);
    }
  };

  const handleLeaveDayPress = (date: string) => {
    if (!leaveApprovalContext || !selectedLeaveType) {
      Alert.alert(
        "Select leave type",
        "Choose a leave type before assigning a day.",
      );
      return;
    }

    if (selectedLeaveType === "ShortLeave" && !selectedLeaveDayType) {
      Alert.alert(
        "Select day type",
        "Choose how the short leave should be marked.",
      );
      return;
    }

    const result = toggleLeaveDay(
      leaveApprovalDays,
      date,
      selectedLeaveType,
      leaveApprovalContext.balance,
      selectedLeaveDayType,
    );

    if (result.exceeded) {
      Alert.alert(
        "Insufficient balance",
        `No ${selectedLeaveType} leave balance remains.`,
      );
      return;
    }

    setLeaveApprovalDays(result.days);
  };

  const submitLeaveApproval = async () => {
    if (!leaveApprovalTarget || !leaveApprovalContext || !accessToken) {
      Alert.alert(
        "Unable to continue",
        "Leave approval information is unavailable.",
      );
      return;
    }

    const assigned = leaveApprovalDays.some((day) => day.status);

    if (!assigned) {
      Alert.alert(
        "No days assigned",
        "Assign at least one leave day before approval.",
      );
      return;
    }

    setActingLeaveId(leaveApprovalTarget.id);

    try {
      const payload = buildLeaveApprovalPayload(
        leaveApprovalDays,
        leaveApprovalContext.balance,
      );

      await decideTeamLeave(
        leaveApprovalTarget.id,
        {
          ...payload,
          actorRole: "MANAGER",
        },
        accessToken,
      );

      setLeaveApprovalTarget(null);
      setLeaveApprovalContext(null);
      setLeaveApprovalDays([]);
      await refetch();

      Alert.alert(
        "Success",
        payload.status === "Partially Approved"
          ? "Leave partially approved. Unassigned days were not approved."
          : "Leave approved successfully.",
      );
    } catch (decisionError) {
      Alert.alert(
        "Unable to approve leave",
        decisionError instanceof Error
          ? decisionError.message
          : "Please try again.",
      );
    } finally {
      setActingLeaveId(null);
    }
  };

  const rejectLeaveApproval = () => {
    if (!leaveApprovalTarget || !accessToken) {
      Alert.alert(
        "Unable to continue",
        "Leave approval information is unavailable.",
      );
      return;
    }

    Alert.alert(
      "Reject leave request?",
      "Are you sure you want to reject this leave request?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setActingLeaveId(leaveApprovalTarget.id);

              try {
                await decideTeamLeave(
                  leaveApprovalTarget.id,
                  {
                    status: "Rejected",
                    actorRole: "MANAGER",
                  },
                  accessToken,
                );

                setLeaveApprovalTarget(null);
                setLeaveApprovalContext(null);
                setLeaveApprovalDays([]);
                await refetch();

                Alert.alert("Success", "Leave request rejected.");
              } catch (decisionError) {
                Alert.alert(
                  "Unable to reject leave",
                  decisionError instanceof Error
                    ? decisionError.message
                    : "Please try again.",
                );
              } finally {
                setActingLeaveId(null);
              }
            })();
          },
        },
      ],
    );
  };

  const handleRevokeDecision = (
    item: TeamLeaveApproval,
    status: "Revoked" | "Approved",
  ) => {
    if (!accessToken) {
      Alert.alert("Unable to continue", "Authentication is unavailable.");
      return;
    }

    const approvingRevocation = status === "Revoked";

    Alert.alert(
      approvingRevocation ? "Approve revocation?" : "Keep leave approved?",
      approvingRevocation
        ? "This will revoke the employee's approved leave and restore the used leave balance."
        : "This will decline the revocation request and keep the original leave approved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: approvingRevocation ? "Approve Revocation" : "Keep Approved",
          style: approvingRevocation ? "destructive" : "default",
          onPress: () => {
            void (async () => {
              setActingLeaveId(item.id);

              try {
                await decideTeamLeave(
                  item.id,
                  {
                    status,
                    actorRole: "MANAGER",
                  },
                  accessToken,
                );

                await refetch();

                Alert.alert(
                  "Success",
                  approvingRevocation
                    ? "Leave revocation approved. The leave balance has been restored."
                    : "Revocation declined. The original leave remains approved.",
                );
              } catch (decisionError) {
                Alert.alert(
                  "Unable to process revocation",
                  decisionError instanceof Error
                    ? decisionError.message
                    : "Please try again.",
                );
              } finally {
                setActingLeaveId(null);
              }
            })();
          },
        },
      ],
    );
  };
  const counts = useMemo(
    () => ({
      all: data?.pendingCount ?? 0,
      leave: data?.pendingLeave.length ?? 0,
      reimbursement: data?.pendingReimbursements.length ?? 0,
      advance: data?.pendingAdvances.length ?? 0,
      regularisation: data?.pendingRegularisations.length ?? 0,
    }),
    [data],
  );

  const allFilters: {
    id: ApprovalFilter;
    label: string;
  }[] = [
    { id: "all", label: "All" },
    { id: "leave", label: "Leave" },
    { id: "reimbursement", label: "Reimbursement" },
    { id: "advance", label: "Loan Advance" },
    { id: "regularisation", label: "Regularization" },
  ];

  const filters = allFilters.filter((filter) => {
    if (filter.id === "all") return true;
    return data?.moduleAccess?.[filter.id] === true;
  });

  const visibleActiveFilter = filters.some(
    (filter) => filter.id === activeFilter,
  )
    ? activeFilter
    : "all";

  const showLeave =
    visibleActiveFilter === "all" || visibleActiveFilter === "leave";

  const showReimbursement =
    visibleActiveFilter === "all" || visibleActiveFilter === "reimbursement";

  const showAdvance =
    visibleActiveFilter === "all" || visibleActiveFilter === "advance";

  const showRegularisation =
    visibleActiveFilter === "all" || visibleActiveFilter === "regularisation";

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/my-team");
            }
          }}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={21} color={colors.textPrimary} />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>Team Approvals</Text>
          <Text style={styles.subtitle}>Review requests from your team</Text>
        </View>

        <Pressable
          onPress={() => void refetch()}
          style={styles.refreshButton}
          accessibilityRole="button"
          accessibilityLabel="Refresh approvals"
        >
          <Ionicons name="refresh-outline" size={21} color={colors.primary} />
        </Pressable>
      </View>

      {!isLoading && !isError && data?.hasApprovalsAccess && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons
              name="clipboard-outline"
              size={25}
              color={colors.primary}
            />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryLabel}>Pending approvals</Text>
            <Text style={styles.summaryDescription}>
              Requests currently waiting for review
            </Text>
          </View>

          <Text style={styles.summaryCount}>{data?.pendingCount ?? 0}</Text>
        </View>
      )}

      {data?.hasApprovalsAccess !== false && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterScroll}
        >
          {filters.map((filter) => {
            const selected = visibleActiveFilter === filter.id;

            return (
              <Pressable
                key={filter.id}
                onPress={() => setActiveFilter(filter.id)}
                style={[styles.filterChip, selected && styles.filterChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>

                <View
                  style={[
                    styles.filterCount,
                    selected && styles.filterCountActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterCountText,
                      selected && styles.filterCountTextActive,
                    ]}
                  >
                    {counts[filter.id]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.stateMessage}>Loading approvals...</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateContainer}>
          <Ionicons
            name="cloud-offline-outline"
            size={38}
            color={colors.textSecondary}
          />

          <Text style={styles.stateTitle}>Couldn't load approvals</Text>

          <Text style={styles.stateMessage}>
            {error instanceof Error
              ? error.message
              : "Please check your connection and try again."}
          </Text>

          <Pressable onPress={() => void refetch()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : data && !data.hasApprovalsAccess ? (
        <View style={styles.stateContainer}>
          <Ionicons
            name="lock-closed-outline"
            size={38}
            color={colors.textSecondary}
          />
          <Text style={styles.stateTitle}>Team Approvals unavailable</Text>
          <Text style={styles.stateMessage}>
            Your company plan does not include Team Approvals access. Please
            contact your company administrator.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isLoading}
              onRefresh={() => void refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          {showLeave &&
            data?.pendingLeave.map((item) => (
              <View key={`leave-${item.id}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.cardIcon,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={21}
                      color={colors.primary}
                    />
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.employeeName}>
                      {getEmployeeName(item.manageEmployee)}
                    </Text>
                    <Text style={styles.cardCategory}>
                      {item.status === "RevokePending"
                        ? "Leave revocation request"
                        : "Leave request"}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: colors.warningBackground },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: colors.warning }]}
                    >
                      {item.status === "RevokePending"
                        ? "Revoke Pending"
                        : item.status === "Partially Approved"
                          ? "Partially Approved"
                          : "Pending"}{" "}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.detailText}>
                    {item.appliedLeaveType || "Leave"}
                  </Text>
                  <Text style={styles.detailText}>
                    {formatDate(item.fromDate)} – {formatDate(item.toDate)}
                  </Text>
                  {item.purpose ? (
                    <Text style={styles.reasonText}>{item.purpose}</Text>
                  ) : null}
                </View>

                {item.status === "RevokePending" ? (
                  <View
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      marginTop: 12,
                    }}
                  >
                    <Pressable
                      disabled={actingLeaveId !== null}
                      onPress={() => handleRevokeDecision(item, "Approved")}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: colors.primaryLight,
                        opacity: actingLeaveId !== null ? 0.5 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Keep Approved
                      </Text>
                    </Pressable>

                    <Pressable
                      disabled={actingLeaveId !== null}
                      onPress={() => handleRevokeDecision(item, "Revoked")}
                      style={{
                        flex: 1,
                        paddingVertical: 12,
                        alignItems: "center",
                        borderRadius: 12,
                        backgroundColor: colors.dangerBackground,
                        opacity: actingLeaveId !== null ? 0.5 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: colors.danger,
                          fontWeight: "800",
                          fontSize: 12,
                        }}
                      >
                        Approve Revocation
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    disabled={loadingLeaveContext || actingLeaveId !== null}
                    onPress={() => void openLeaveApproval(item)}
                    style={{
                      marginTop: 12,
                      paddingVertical: 12,
                      alignItems: "center",
                      borderRadius: 12,
                      backgroundColor: colors.primary,
                      opacity:
                        loadingLeaveContext || actingLeaveId !== null ? 0.5 : 1,
                    }}
                  >
                    <Text
                      style={{
                        color: colors.white,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {loadingLeaveContext ? "Loading..." : "Review Leave"}
                    </Text>
                  </Pressable>
                )}
              </View>
            ))}

          {showReimbursement &&
            data?.pendingReimbursements.map((item) => {
              const pendingItems = (item.items ?? []).filter(
                (expense) => (expense.status ?? "Pending") === "Pending",
              );

              const total = item.items.reduce(
                (sum, expense) => sum + Number(expense.amount || 0),
                0,
              );

              return (
                <View key={`reimbursement-${item.id}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View
                      style={[
                        styles.cardIcon,
                        { backgroundColor: colors.successBackground },
                      ]}
                    >
                      <Ionicons
                        name="receipt-outline"
                        size={21}
                        color={colors.success}
                      />
                    </View>

                    <View style={styles.cardMain}>
                      <Text style={styles.employeeName}>
                        {getEmployeeName(item.manageEmployee)}
                      </Text>
                      <Text style={styles.cardCategory}>
                        Reimbursement request
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: colors.warningBackground },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: colors.warning }]}
                      >
                        {item.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDetails}>
                    <Text style={styles.amountText}>{formatAmount(total)}</Text>
                    <Text style={styles.detailText}>
                      Date: {formatDate(item.date)}
                    </Text>
                    <View style={{ gap: 12, marginTop: 6 }}>
                      {pendingItems.map((expense) => (
                        <View
                          key={expense.id}
                          style={{
                            paddingTop: 12,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            gap: 9,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              gap: 10,
                            }}
                          >
                            <View style={{ flex: 1, gap: 3 }}>
                              <Text style={styles.detailText}>
                                {expense.reimbursementType || "Expense"}
                              </Text>
                              {expense.description ? (
                                <Text style={styles.reasonText}>
                                  {expense.description}
                                </Text>
                              ) : null}
                            </View>

                            <Text style={styles.amountText}>
                              {formatAmount(expense.amount)}
                            </Text>
                          </View>

                          <View style={{ flexDirection: "row", gap: 9 }}>
                            <Pressable
                              disabled={actingReimbursementItemId !== null}
                              onPress={() =>
                                handleReimbursementDecision(
                                  item.id,
                                  expense.id,
                                  "Rejected",
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: "center",
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.danger,
                                opacity:
                                  actingReimbursementItemId !== null ? 0.5 : 1,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.danger,
                                  fontSize: 12,
                                  fontWeight: "800",
                                }}
                              >
                                {actingReimbursementItemId === expense.id
                                  ? "Processing..."
                                  : "Reject"}
                              </Text>
                            </Pressable>

                            <Pressable
                              disabled={actingReimbursementItemId !== null}
                              onPress={() =>
                                handleReimbursementDecision(
                                  item.id,
                                  expense.id,
                                  "Approved",
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 10,
                                alignItems: "center",
                                borderRadius: 10,
                                backgroundColor: colors.success,
                                opacity:
                                  actingReimbursementItemId !== null ? 0.5 : 1,
                              }}
                            >
                              <Text
                                style={{
                                  color: colors.white,
                                  fontSize: 12,
                                  fontWeight: "800",
                                }}
                              >
                                {actingReimbursementItemId === expense.id
                                  ? "Processing..."
                                  : "Approve"}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })}

          {showAdvance &&
            data?.pendingAdvances.map((item) => (
              <View key={`advance-${item.id}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.cardIcon,
                      { backgroundColor: colors.warningBackground },
                    ]}
                  >
                    <Ionicons
                      name="wallet-outline"
                      size={21}
                      color={colors.warning}
                    />
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.employeeName}>
                      {getEmployeeName(item.manageEmployee)}
                    </Text>
                    <Text style={styles.cardCategory}>
                      Loan advance request
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: colors.warningBackground },
                    ]}
                  >
                    <Text
                      style={[styles.statusText, { color: colors.warning }]}
                    >
                      {item.status === "RevokePending"
                        ? "Revoke Pending"
                        : "Pending"}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.amountText}>
                    {formatAmount(item.advanceAmount)}
                  </Text>
                  {item.reason ? (
                    <Text style={styles.reasonText}>{item.reason}</Text>
                  ) : null}
                </View>
              </View>
            ))}

          {showRegularisation &&
            data?.pendingRegularisations.map((item) => (
              <View key={`regularisation-${item.id}`} style={styles.card}>
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.cardIcon,
                      { backgroundColor: colors.dangerBackground },
                    ]}
                  >
                    <Ionicons
                      name="time-outline"
                      size={21}
                      color={colors.danger}
                    />
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.employeeName}>
                      {getEmployeeName(item.manageEmployee)}
                    </Text>
                    <Text style={styles.cardCategory}>
                      Attendance regularization
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDetails}>
                  <Text style={styles.detailText}>
                    Date: {formatDate(item.attendanceDate)}
                  </Text>
                  <Text style={styles.detailText}>
                    {item.actualStatus || "—"} → {item.requestedStatus || "—"}
                  </Text>
                  {item.canApprove && item.approval ? (
                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 10 }}
                    >
                      {item.approval.canReject && (
                        <Pressable
                          disabled={actingRegularisationId !== null}
                          onPress={() => {
                            setRejectionRemark("");
                            setRejectionTarget({
                              id: item.id,
                              requestId: item.approval!.requestID,
                            });
                          }}
                          style={{
                            flex: 1,
                            paddingVertical: 12,
                            alignItems: "center",
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: colors.danger,
                            backgroundColor: colors.surface,
                            opacity: actingRegularisationId !== null ? 0.5 : 1,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.danger,
                              fontSize: 12,
                              fontWeight: "800",
                            }}
                          >
                            Reject
                          </Text>
                        </Pressable>
                      )}

                      <Pressable
                        disabled={actingRegularisationId !== null}
                        onPress={() =>
                          handleRegularisationApproval(
                            item.id,
                            item.approval!.requestID,
                          )
                        }
                        style={{
                          flex: 1,
                          paddingVertical: 12,
                          alignItems: "center",
                          borderRadius: 12,
                          backgroundColor: colors.success,
                          opacity: actingRegularisationId !== null ? 0.5 : 1,
                        }}
                      >
                        <Text
                          style={{
                            color: colors.white,
                            fontSize: 12,
                            fontWeight: "800",
                          }}
                        >
                          {actingRegularisationId === item.id
                            ? "Processing..."
                            : "Approve"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        alignSelf: "flex-start",
                        backgroundColor: item.canApprove
                          ? colors.warningBackground
                          : colors.surfaceSecondary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: item.canApprove
                            ? colors.warning
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {item.canApprove
                        ? "Awaiting your action"
                        : "Waiting for approval step"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

          {counts[visibleActiveFilter] === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="checkmark-done-outline"
                  size={30}
                  color={colors.success}
                />
              </View>

              <Text style={styles.emptyTitle}>No pending approvals</Text>

              <Text style={styles.emptyMessage}>
                There are no requests in this category right now.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
      <Modal
        visible={rejectionTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (actingRegularisationId === null) {
            setRejectionTarget(null);
            setRejectionRemark("");
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,

            width: "100%",
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.48)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 18,
              padding: 20,
              gap: 12,
            }}
          >
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              Reject regularization
            </Text>

            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
              Enter the reason for rejecting this attendance regularization.
            </Text>

            <TextInput
              value={rejectionRemark}
              onChangeText={setRejectionRemark}
              placeholder="Enter rejection reason"
              placeholderTextColor={colors.textSecondary}
              multiline
              editable={actingRegularisationId === null}
              style={{
                minHeight: 110,
                textAlignVertical: "top",
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                padding: 12,
                color: colors.textPrimary,
                fontSize: 14,
              }}
            />

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                disabled={actingRegularisationId !== null}
                onPress={() => {
                  setRejectionTarget(null);
                  setRejectionRemark("");
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  actingRegularisationId !== null || !rejectionRemark.trim()
                }
                onPress={() => void handleRegularisationRejection()}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: "center",
                  borderRadius: 12,
                  backgroundColor: colors.danger,
                  opacity:
                    actingRegularisationId !== null || !rejectionRemark.trim()
                      ? 0.5
                      : 1,
                }}
              >
                <Text style={{ color: colors.white, fontWeight: "800" }}>
                  {actingRegularisationId !== null
                    ? "Processing..."
                    : "Confirm Reject"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal
        visible={leaveApprovalTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (actingLeaveId === null) {
            setLeaveApprovalTarget(null);
            setLeaveApprovalContext(null);
            setLeaveApprovalDays([]);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            width: "100%",
            justifyContent: "center",
            padding: 12,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 20,
              maxHeight: "92%",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                padding: 18,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: 18,
                    fontWeight: "800",
                  }}
                >
                  Review Leave
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  {leaveApprovalTarget
                    ? getEmployeeName(leaveApprovalTarget.manageEmployee)
                    : "Leave request"}
                </Text>
              </View>

              <Pressable
                disabled={actingLeaveId !== null}
                onPress={() => {
                  setLeaveApprovalTarget(null);
                  setLeaveApprovalContext(null);
                  setLeaveApprovalDays([]);
                }}
                style={{ padding: 8 }}
              >
                <Ionicons name="close" size={23} color={colors.textPrimary} />
              </Pressable>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 16, gap: 16 }}
            >
              {loadingLeaveContext || !leaveApprovalContext ? (
                <View style={{ padding: 30, alignItems: "center", gap: 10 }}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={{ color: colors.textSecondary }}>
                    Loading employee leave balance...
                  </Text>
                </View>
              ) : (
                <>
                  <View style={{ gap: 5 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      Leave balance
                    </Text>

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      {(
                        [
                          ["Sick", leaveApprovalContext.balance.sick],
                          ["Casual", leaveApprovalContext.balance.casual],
                          [
                            "Privileged",
                            leaveApprovalContext.balance.privileged,
                          ],
                          ["Comp Off", leaveApprovalContext.balance.compOff],
                          ["Maternity", leaveApprovalContext.balance.maternity],
                          ["Paternity", leaveApprovalContext.balance.paternity],
                        ] as const
                      ).map(([label, entry]) => (
                        <View
                          key={label}
                          style={{
                            width: "31%",
                            padding: 10,
                            borderRadius: 12,
                            backgroundColor: colors.surface,
                            borderWidth: 1,
                            borderColor: colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color: colors.textSecondary,
                              fontSize: 10,
                            }}
                          >
                            {label}
                          </Text>
                          <Text
                            style={{
                              color: colors.textPrimary,
                              fontSize: 19,
                              fontWeight: "800",
                            }}
                          >
                            {entry.remaining}
                          </Text>
                          <Text
                            style={{ color: colors.textSecondary, fontSize: 9 }}
                          >
                            days remaining
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>

                  <View style={{ gap: 9 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      Select leave type
                    </Text>

                    <View
                      style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                    >
                      {getAvailableLeaveTypes(
                        leaveApprovalContext.balance,
                        leaveApprovalContext.gender,
                      ).map((type) => (
                        <Pressable
                          key={type}
                          onPress={() => {
                            setSelectedLeaveType(type);
                            setSelectedLeaveDayType(undefined);
                          }}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 9,
                            borderRadius: 10,
                            backgroundColor:
                              selectedLeaveType === type
                                ? colors.primary
                                : colors.surface,
                            borderWidth: 1,
                            borderColor:
                              selectedLeaveType === type
                                ? colors.primary
                                : colors.border,
                          }}
                        >
                          <Text
                            style={{
                              color:
                                selectedLeaveType === type
                                  ? colors.white
                                  : colors.textPrimary,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {type === "LoP" ? "Loss of Pay" : type}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {selectedLeaveType === "ShortLeave" && (
                    <View style={{ gap: 8 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Short leave day type
                      </Text>

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 7,
                        }}
                      >
                        {(
                          ["Present", "LateMark", "Halfday", "Absent"] as const
                        ).map((type) => (
                          <Pressable
                            key={type}
                            onPress={() => setSelectedLeaveDayType(type)}
                            style={{
                              padding: 9,
                              borderRadius: 9,
                              borderWidth: 1,
                              borderColor:
                                selectedLeaveDayType === type
                                  ? colors.primary
                                  : colors.border,
                              backgroundColor:
                                selectedLeaveDayType === type
                                  ? colors.primaryLight
                                  : colors.surface,
                            }}
                          >
                            <Text
                              style={{
                                color: colors.textPrimary,
                                fontSize: 11,
                                fontWeight: "600",
                              }}
                            >
                              {type === "LateMark"
                                ? "Late Mark"
                                : type === "Halfday"
                                  ? "Half Day"
                                  : type}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={{ gap: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: 13,
                          fontWeight: "800",
                        }}
                      >
                        Assign leave day by day
                      </Text>
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {leaveApprovalDays.filter((day) => day.status).length}/
                        {leaveApprovalDays.length}
                      </Text>
                    </View>

                    <View
                      style={{
                        maxHeight: 230,
                        borderRadius: 12,
                        overflow: "hidden",
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      {leaveApprovalDays.map((day) => (
                        <Pressable
                          key={day.date}
                          disabled={
                            !selectedLeaveType || actingLeaveId !== null
                          }
                          onPress={() => handleLeaveDayPress(day.date)}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: day.status
                              ? colors.successBackground
                              : colors.surface,
                            borderBottomWidth: 1,
                            borderBottomColor: colors.border,
                          }}
                        >
                          <Text
                            style={{ color: colors.textPrimary, fontSize: 12 }}
                          >
                            {formatDate(day.date)}
                          </Text>

                          <Text
                            style={{
                              color: day.status
                                ? colors.success
                                : colors.textSecondary,
                              fontSize: 11,
                              fontWeight: "700",
                            }}
                          >
                            {day.status || "Not approved"}
                            {day.status === "ShortLeave" && day.dayType
                              ? ` (${day.dayType})`
                              : ""}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                      Unassigned days will not be approved. Tap an assigned day
                      again to clear it.
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <View
              style={{
                padding: 14,
                flexDirection: "row",
                gap: 8,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <Pressable
                disabled={actingLeaveId !== null || loadingLeaveContext}
                onPress={rejectLeaveApproval}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 11,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.danger,
                }}
              >
                <Text
                  style={{
                    color: colors.danger,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  Reject
                </Text>
              </Pressable>

              <Pressable
                disabled={actingLeaveId !== null}
                onPress={() => {
                  setLeaveApprovalTarget(null);
                  setLeaveApprovalContext(null);
                  setLeaveApprovalDays([]);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 11,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: colors.border,
                }}
              >
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                disabled={
                  !leaveApprovalContext ||
                  loadingLeaveContext ||
                  actingLeaveId !== null ||
                  !leaveApprovalDays.some((day) => day.status)
                }
                onPress={() => void submitLeaveApproval()}
                style={{
                  flex: 1.2,
                  paddingVertical: 12,
                  borderRadius: 11,
                  alignItems: "center",
                  backgroundColor: colors.success,
                  opacity:
                    !leaveApprovalContext ||
                    loadingLeaveContext ||
                    actingLeaveId !== null ||
                    !leaveApprovalDays.some((day) => day.status)
                      ? 0.5
                      : 1,
                }}
              >
                <Text
                  style={{
                    color: colors.white,
                    fontWeight: "800",
                    fontSize: 12,
                  }}
                >
                  {actingLeaveId !== null ? "Processing..." : "Submit"}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(colors: TeamColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      width: "100%",
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 17,
      paddingTop: 10,
      paddingBottom: 15,
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
      marginRight: 12,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    subtitle: {
      marginTop: 3,
      fontSize: 12,
      color: colors.textSecondary,
    },
    refreshButton: {
      width: 40,
      height: 40,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    summaryCard: {
      marginHorizontal: 17,
      marginBottom: 14,
      padding: 15,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    summaryIcon: {
      width: 45,
      height: 45,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    summaryText: {
      flex: 1,
      minWidth: 0,
    },
    summaryLabel: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    summaryDescription: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    summaryCount: {
      fontSize: 25,
      fontWeight: "900",
      color: colors.primary,
    },
    filterScroll: {
      flexGrow: 0,
      marginBottom: 12,
    },
    filterContent: {
      paddingHorizontal: 17,
      gap: 8,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 13,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    filterText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    filterTextActive: {
      color: colors.white,
    },
    filterCount: {
      minWidth: 21,
      height: 21,
      paddingHorizontal: 5,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
    },
    filterCountActive: {
      backgroundColor: "rgba(255,255,255,0.2)",
    },
    filterCountText: {
      fontSize: 10,
      fontWeight: "800",
      color: colors.textSecondary,
    },
    filterCountTextActive: {
      color: colors.white,
    },
    list: {
      flex: 1,
      width: "100%",
    },
    listContent: {
      paddingHorizontal: 17,
      paddingBottom: 35,
      gap: 11,
    },
    card: {
      padding: 15,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
    },
    cardIcon: {
      width: 43,
      height: 43,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
    },
    cardMain: {
      flex: 1,
      minWidth: 0,
    },
    employeeName: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    cardCategory: {
      marginTop: 3,
      fontSize: 11,
      color: colors.textSecondary,
    },
    statusBadge: {
      paddingHorizontal: 9,
      paddingVertical: 6,
      borderRadius: 9,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "800",
    },
    cardDetails: {
      marginTop: 13,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 6,
    },
    detailText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    reasonText: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textPrimary,
    },
    amountText: {
      fontSize: 18,
      fontWeight: "900",
      color: colors.textPrimary,
    },

    stateContainer: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 25,
    },
    stateTitle: {
      marginTop: 13,
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateMessage: {
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 17,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.white,
    },
    emptyContainer: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 25,
      paddingVertical: 55,
    },
    emptyIcon: {
      width: 62,
      height: 62,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.successBackground,
    },
    emptyTitle: {
      marginTop: 14,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    emptyMessage: {
      marginTop: 6,
      fontSize: 12,
      lineHeight: 18,
      textAlign: "center",
      color: colors.textSecondary,
    },
  });
}

*/

import FeatureUnavailableScreen from "../components/FeatureUnavailableScreen";

export default function ApprovalsScreen() {
  return <FeatureUnavailableScreen feature="Team approvals" />;
}