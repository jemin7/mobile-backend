/*
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText as Text } from "../../components/InterTypography";
import { usePayslip } from "../../hooks/usePayout";
import { useTheme } from "../../theme/ThemeProvider";

export default function PayslipDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Number(params.id);

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const { data: record, isLoading, isError, error, refetch } = usePayslip(id);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Back to Payout</Text>
        </Pressable>

        {isLoading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.stateTitle}>Loading payslip...</Text>
          </View>
        ) : isError || !record ? (
          <View style={styles.stateCard}>
            <Ionicons
              name="alert-circle-outline"
              size={34}
              color={colors.danger}
            />
            <Text style={styles.stateTitle}>Payslip unavailable</Text>
            <Text style={styles.stateMessage}>
              {error instanceof Error
                ? error.message
                : "This payslip could not be found."}
            </Text>
            <Pressable
              onPress={() => void refetch()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.titleSection}>
              <View style={styles.documentIcon}>
                <Ionicons
                  name="document-text-outline"
                  size={27}
                  color={colors.primary}
                />
              </View>

              <Text style={styles.eyebrow}>SALARY SLIP</Text>
              <Text style={styles.title}>{record.monthPeriod}</Text>
            </View>

            <View style={styles.divider} />

            <DetailRow
              label="Salary status"
              value={record.status || "Pending"}
              styles={styles}
            />

            {record.paymentDate ? (
              <DetailRow
                label="Payment date"
                value={record.paymentDate}
                styles={styles}
              />
            ) : null}

            {record.paymentMode ? (
              <DetailRow
                label="Payment mode"
                value={record.paymentMode}
                styles={styles}
              />
            ) : null}

            {record.paymentType ? (
              <DetailRow
                label="Payment type"
                value={record.paymentType}
                styles={styles}
              />
            ) : null}

            {record.paymentRemark ? (
              <DetailRow
                label="Payment remark"
                value={record.paymentRemark}
                styles={styles}
              />
            ) : null}

            <View style={styles.note}>
              <Ionicons
                name="information-circle-outline"
                size={19}
                color={colors.textSecondary}
              />
              <Text style={styles.noteText}>
                Earnings, deductions and net salary breakdown will be shown in
                the full payslip.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  styles,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function createStyles(colors: {
  background: string;
  surface: string;
  surfaceSecondary: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  danger: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 20,
      paddingBottom: 50,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 20,
      paddingVertical: 8,
    },
    backText: {
      fontSize: 14,
      fontWeight: "700",
      color: colors.primary,
    },
    card: {
      padding: 20,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    titleSection: {
      alignItems: "center",
      paddingBottom: 18,
    },
    documentIcon: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
      marginBottom: 14,
    },
    eyebrow: {
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.5,
      color: colors.textSecondary,
    },
    title: {
      marginTop: 7,
      fontSize: 21,
      fontWeight: "800",
      textAlign: "center",
      color: colors.textPrimary,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: 8,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    label: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
    },
    value: {
      flex: 1,
      fontSize: 13,
      fontWeight: "700",
      textAlign: "right",
      color: colors.textPrimary,
    },
    note: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      marginTop: 18,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    noteText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    stateCard: {
      minHeight: 220,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    stateTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
      textAlign: "center",
    },
    stateMessage: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 8,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryText: {
      color: "#FFFFFF",
      fontWeight: "700",
    },
  });
}

*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function PayslipDetailsScreen() {
  return <FeatureUnavailableScreen feature="Payslip details" />;
}
