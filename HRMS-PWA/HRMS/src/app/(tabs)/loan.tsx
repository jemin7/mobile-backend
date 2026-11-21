
/*
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import { AppText as Text } from "../../components/InterTypography";
import { useMyLoanAdvances, useCreateMyLoanAdvance } from "../../hooks/useLoan";
import { useTheme } from "../../theme/ThemeProvider";

export default function LoanScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };
  const {
    data: loans = [],
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useMyLoanAdvances();

  const createMutation = useCreateMyLoanAdvance();

  const [modalVisible, setModalVisible] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const submitRequest = async () => {
    const value = Number(amount);

    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      Alert.alert("Invalid amount", "Enter a valid loan amount.");
      return;
    }

    if (!reason.trim()) {
      Alert.alert(
        "Missing reason",
        "Please enter the reason for your request.",
      );
      return;
    }

    try {
      await createMutation.mutateAsync({
        advanceAmount: amount.trim(),
        reason: reason.trim(),
      });

      setModalVisible(false);
      setAmount("");
      setReason("");

      Alert.alert(
        "Request submitted",
        "Your loan request was submitted successfully.",
      );
    } catch (error) {
      Alert.alert(
        "Submission failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View style={styles.header}>
            <Pressable
              onPress={handleBack}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <Ionicons
                name="arrow-back"
                size={21}
                color={colors.textPrimary}
              />
            </Pressable>
            <View style={styles.headerIcon}>
              <Ionicons
                name="wallet-outline"
                size={25}
                color={colors.primary}
              />
            </View>

            <View style={styles.headerText}>
              <Text style={styles.title}>Loans & Advances</Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Your requests</Text>
              <Text style={styles.sectionSubtitle}>
                {loans.length} {loans.length === 1 ? "request" : "requests"}
              </Text>
            </View>

            {isFetching && !isLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.stateCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.stateText}>
                Loading your loan requests...
              </Text>
            </View>
          ) : isError ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="cloud-offline-outline"
                size={32}
                color={colors.textSecondary}
              />
              <Text style={styles.stateTitle}>Couldn't load requests</Text>
              <Pressable
                onPress={() => void refetch()}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Try again</Text>
              </Pressable>
            </View>
          ) : loans.length === 0 ? (
            <View style={styles.stateCard}>
              <Ionicons
                name="wallet-outline"
                size={35}
                color={colors.textSecondary}
              />
              <Text style={styles.stateTitle}>No loan requests yet</Text>
              <Text style={styles.stateText}>
                Your loan requests will appear here.
              </Text>
              <Pressable
                onPress={() => setModalVisible(true)}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>Request a loan</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {loans.map((loan) => (
                <View key={loan.id} style={styles.loanCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.loanIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={21}
                        color={colors.primary}
                      />
                    </View>

                    <View style={styles.cardMain}>
                      <Text style={styles.cardTitle}>
                        Loan request #{loan.id}
                      </Text>
                      <Text style={styles.cardDate}>
                        {formatDate(loan.createdAt)}
                      </Text>
                    </View>

                    <StatusPill status={loan.status} colors={colors} />
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.amountLabel}>Requested amount</Text>
                  <Text style={styles.amountValue}>
                    {formatCurrency(loan.advanceAmount)}
                  </Text>

                  <Text style={styles.reasonLabel}>Reason</Text>
                  <Text style={styles.reasonText}>{loan.reason || "—"}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        <Pressable
          onPress={() => setModalVisible(true)}
          style={[styles.fab, { bottom: Math.max(insets.bottom + 8, 16) + 84 }]}
          accessibilityRole="button"
          accessibilityLabel="Request a new loan"
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>

        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>New Loan Request</Text>
                  <Text style={styles.modalSubtitle}>
                    Enter your request details
                  </Text>
                </View>

                <Pressable
                  onPress={() => setModalVisible(false)}
                  disabled={createMutation.isPending}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={27}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>Loan amount *</Text>
              <View style={styles.amountInput}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                  style={styles.textInput}
                />
              </View>

              <Text style={styles.inputLabel}>Reason for loan *</Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder="Enter your reason"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={500}
                textAlignVertical="top"
                style={styles.reasonInput}
              />

              <Pressable
                onPress={() => void submitRequest()}
                disabled={createMutation.isPending}
                style={[
                  styles.submitButton,
                  createMutation.isPending && styles.disabledButton,
                ]}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Ionicons
                    name="send-outline"
                    size={18}
                    color={colors.white}
                  />
                )}
                <Text style={styles.submitText}>
                  {createMutation.isPending
                    ? "Submitting..."
                    : "Submit Request"}
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

function StatusPill({ status, colors }: { status: string; colors: any }) {
  const normalized = status.toLowerCase();

  const background =
    normalized === "approved" || normalized === "paid"
      ? colors.successBackground
      : normalized === "rejected"
        ? colors.dangerBackground
        : colors.warningBackground;

  const foreground =
    normalized === "approved" || normalized === "paid"
      ? colors.success
      : normalized === "rejected"
        ? colors.danger
        : colors.warning;

  return (
    <View
      style={{
        backgroundColor: background,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
      }}
    >
      <Text style={{ color: foreground, fontSize: 10, fontWeight: "800" }}>
        {status}
      </Text>
    </View>
  );
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(value: string | number) {
  const amount = Number(value);

  return `₹${Number.isFinite(amount) ? amount.toLocaleString("en-IN") : value}`;
}

function createStyles(colors: any) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 150,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 28,
      gap: 13,
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
    headerIcon: {
      width: 49,
      height: 49,
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
      fontWeight: "800",
      color: colors.textPrimary,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    sectionSubtitle: {
      fontSize: 12,
      marginTop: 3,
      color: colors.textSecondary,
    },
    list: {
      gap: 12,
    },
    loanCard: {
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    loanIcon: {
      width: 43,
      height: 43,
      borderRadius: 13,
      backgroundColor: colors.primaryLight,
      alignItems: "center",
      justifyContent: "center",
    },
    cardMain: {
      flex: 1,
    },
    cardTitle: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    cardDate: {
      fontSize: 11,
      marginTop: 4,
      color: colors.textSecondary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 15,
    },
    amountLabel: {
      fontSize: 11,
      color: colors.textMuted,
    },
    amountValue: {
      fontSize: 22,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 4,
    },
    reasonLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 14,
    },
    reasonText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      marginTop: 4,
    },
    stateCard: {
      minHeight: 190,
      padding: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    stateTitle: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
      marginTop: 12,
    },
    stateText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 8,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 16,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
    },
    retryText: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.primary,
    },
    fab: {
      position: "absolute",
      right: 20,
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      elevation: 6,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    modalCard: {
      padding: 22,
      paddingBottom: 32,
      borderTopLeftRadius: 25,
      borderTopRightRadius: 25,
      backgroundColor: colors.surface,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    modalSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
      marginBottom: 8,
    },
    amountInput: {
      height: 52,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      marginBottom: 20,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
    },
    currency: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      marginRight: 9,
    },
    textInput: {
      flex: 1,
      fontSize: 14,
      color: colors.textPrimary,
    },
    reasonInput: {
      minHeight: 100,
      padding: 14,
      marginBottom: 22,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
      color: colors.textPrimary,
      fontSize: 14,
    },
    submitButton: {
      minHeight: 53,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      borderRadius: 14,
      backgroundColor: colors.primary,
    },
    submitText: {
      fontSize: 14,
      fontWeight: "800",
      color: colors.white,
    },
    disabledButton: {
      opacity: 0.6,
    },
  });
}

*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function LoanScreen() {
  return <FeatureUnavailableScreen feature="Loans and advances" />;
}
