/*
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import * as FileSystem from "expo-file-system/legacy";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  View,
} from "react-native";
import { useInfinitePayslips } from "../../hooks/usePayout";
import type { PayslipRecord } from "../../api/payout";
import { AppText as Text } from "../../components/InterTypography";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  downloadPayslipPdf as fetchPayslipPdf,
  startPayslipDownload,
} from "../../api/payout";
import {
  downloadPayslipPdf as savePayslipPdf,
  viewPayslipPdf,
} from "../../utils/payslipPdf";
import { useTheme } from "../../theme/ThemeProvider";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getMonthKey = (date: Date | null) =>
  date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    : undefined;

const getMonthLabel = (date: Date | null) =>
  date
    ? `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`
    : "Select month";

export default function PayoutScreen() {
  const router = useRouter();
  const handleBack = () => {
    router.replace("/(tabs)");
  };

  const { accessToken } = useAuth();

  const [activePdfAction, setActivePdfAction] = useState<{
    id: number;
    action: "view" | "download";
  } | null>(null);

  const handlePdfAction = async (id: number, action: "view" | "download") => {
    if (activePdfAction) return;

    setActivePdfAction({ id, action });

    let fileUri: string | null = null;

    try {
      const fileName = `EN-Time-HR-Payslip-${id}.pdf`;

      // Android: use the system Download Manager directly.
      if (action === "download" && Platform.OS === "android") {
        await startPayslipDownload(id, accessToken);

        Alert.alert(
          "Download started",
          "Your payslip is downloading. Check the Downloads folder or notification panel.",
        );
        return;
      }

      // View and iOS download use the authenticated app-cache download.
      fileUri = await fetchPayslipPdf(id, accessToken);

      if (action === "view") {
        await viewPayslipPdf(fileUri, fileName);
        return;
      }

      // iOS: the user can select Save to Files.
      const result = await savePayslipPdf(fileUri, fileName);

      if (result === "cancelled") {
        Alert.alert("Download cancelled", "No folder was selected.");
      } else if (result === "saved") {
        Alert.alert("Payslip downloaded", "Your PDF has been saved.");
      }
    } catch (error) {
      Alert.alert(
        action === "view" ? "Unable to open payslip" : "Download failed",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      if (fileUri && action === "download") {
        await FileSystem.deleteAsync(fileUri, {
          idempotent: true,
        }).catch(() => undefined);
      }

      setActivePdfAction(null);
    }
  };

  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [fromMonth, setFromMonth] = useState<Date | null>(null);
  const [toMonth, setToMonth] = useState<Date | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"from" | "to" | null>(null);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

  const fromMonthKey =
    fromMonth && toMonth ? getMonthKey(fromMonth) : undefined;
  const toMonthKey = fromMonth && toMonth ? getMonthKey(toMonth) : undefined;

  const openMonthPicker = (target: "from" | "to") => {
    const selected = target === "from" ? fromMonth : toMonth;
    setPickerYear(selected?.getFullYear() ?? new Date().getFullYear());
    setPickerTarget(target);
  };

  const selectMonth = (monthIndex: number) => {
    const selected = new Date(pickerYear, monthIndex, 1);

    if (pickerTarget === "from") {
      setFromMonth(selected);
      if (toMonth && selected > toMonth) setToMonth(selected);
    } else if (pickerTarget === "to") {
      setToMonth(selected);
      if (fromMonth && selected < fromMonth) setFromMonth(selected);
    }

    setPickerTarget(null);
  };

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfinitePayslips(fromMonthKey, toMonthKey);
  const visiblePayslips = data?.pages.flatMap((page) => page.items) ?? [];

  const listRef = useRef<FlatList<PayslipRecord>>(null);

  useEffect(() => {
    listRef.current?.scrollToOffset({
      offset: 0,
      animated: false,
    });
  }, [fromMonthKey, toMonthKey]);

  const fetchNextPageRef = useRef<() => Promise<unknown>>(
    async () => undefined,
  );

  const hasNextPageRef = useRef(false);
  const isFetchingNextPageRef = useRef(false);
  const loadedCountRef = useRef(0);
  const loadMoreLock = useRef(false);

  fetchNextPageRef.current = fetchNextPage;
  hasNextPageRef.current = Boolean(hasNextPage);
  isFetchingNextPageRef.current = isFetchingNextPage;
  loadedCountRef.current = visiblePayslips.length;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index?: number }> }) => {
      const triggerIndex = Math.max(0, loadedCountRef.current - 3);

      const reachedEighth = viewableItems.some(
        ({ index }) => typeof index === "number" && index >= triggerIndex,
      );
      if (
        reachedEighth &&
        hasNextPageRef.current &&
        !isFetchingNextPageRef.current &&
        !loadMoreLock.current
      ) {
        loadMoreLock.current = true;

        void fetchNextPageRef
          .current()
          .catch(() => undefined)
          .finally(() => {
            loadMoreLock.current = false;
          });
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <FlatList
        ref={listRef}
        data={visiblePayslips}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item: record }) => (
          <View style={styles.payslipCard}>
            <View style={styles.payslipDetails}>
              <Text style={styles.payslipPeriod}>{record.monthPeriod}</Text>

              <Text style={styles.payslipMeta}>
                {record.paymentDate
                  ? `Payment date: ${record.paymentDate}`
                  : "Salary statement generated"}
              </Text>
            </View>

            <View style={styles.payslipActions}>
              <Pressable
                disabled={activePdfAction !== null}
                onPress={() => void handlePdfAction(record.id, "view")}
                style={({ pressed }) => [
                  styles.payslipActionButton,
                  pressed && styles.pressed,
                  activePdfAction !== null && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`View payslip for ${record.monthPeriod}`}
              >
                {activePdfAction?.id === record.id &&
                activePdfAction?.action === "view" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="eye-outline"
                    size={21}
                    color={colors.primary}
                  />
                )}
              </Pressable>

              <Pressable
                disabled={activePdfAction !== null}
                onPress={() => void handlePdfAction(record.id, "download")}
                style={({ pressed }) => [
                  styles.payslipActionButton,
                  pressed && styles.pressed,
                  activePdfAction !== null && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Download payslip for ${record.monthPeriod}`}
              >
                {activePdfAction?.id === record.id &&
                activePdfAction?.action === "download" ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={21}
                    color={colors.primary}
                  />
                )}
              </Pressable>

              <View
                style={[
                  styles.statusBadge,
                  (record.status || "").trim().toLowerCase() === "paid" &&
                    styles.statusBadgePaid,
                  (record.status || "").trim().toLowerCase() === "pending" &&
                    styles.statusBadgePending,
                ]}
                accessibilityLabel={`Payslip status: ${record.status || "Generated"}`}
              >
                <View
                  style={[
                    styles.statusDot,
                    (record.status || "").trim().toLowerCase() === "paid" &&
                      styles.statusDotPaid,
                    (record.status || "").trim().toLowerCase() === "pending" &&
                      styles.statusDotPending,
                  ]}
                />

                <Text
                  style={[
                    styles.statusBadgeText,
                    (record.status || "").trim().toLowerCase() === "paid" &&
                      styles.statusBadgeTextPaid,
                    (record.status || "").trim().toLowerCase() === "pending" &&
                      styles.statusBadgeTextPending,
                  ]}
                >
                  {record.status || "Generated"}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListHeaderComponent={
          <>
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

              <View style={styles.headerText}>
                <Text style={styles.title}>Payout</Text>
              </View>
            </View>

            <View style={styles.monthRangeRow}>
              <Pressable
                onPress={() => openMonthPicker("from")}
                style={styles.monthRangeField}
                accessibilityRole="button"
                accessibilityLabel={`From month: ${getMonthLabel(fromMonth)}`}
              >
                <Text style={styles.monthRangeLabel}>FROM MONTH</Text>
                <View style={styles.monthRangeValueRow}>
                  <Text
                    style={[
                      styles.monthRangeValue,
                      fromMonth && styles.monthRangeValueSelected,
                    ]}
                  >
                    {getMonthLabel(fromMonth)}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              </Pressable>

              <Pressable
                onPress={() => openMonthPicker("to")}
                style={styles.monthRangeField}
                accessibilityRole="button"
                accessibilityLabel={`To month: ${getMonthLabel(toMonth)}`}
              >
                <Text style={styles.monthRangeLabel}>TO MONTH</Text>
                <View style={styles.monthRangeValueRow}>
                  <Text
                    style={[
                      styles.monthRangeValue,
                      toMonth && styles.monthRangeValueSelected,
                    ]}
                  >
                    {getMonthLabel(toMonth)}
                  </Text>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              </Pressable>
            </View>

            <View style={styles.monthRangeFooter}>
              {(fromMonth || toMonth) && (
                <Pressable
                  onPress={() => {
                    setFromMonth(null);
                    setToMonth(null);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Clear month range"
                >
                  <Text style={styles.clearRangeText}>Clear</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payslips</Text>

              <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>
                  {data?.pages[0]?.total ?? 0} total
                </Text>
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyTitle}>Loading payslips...</Text>
            </View>
          ) : isError ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="cloud-offline-outline"
                size={34}
                color={colors.textSecondary}
              />
              <Text style={styles.emptyTitle}>Couldn't load payslips</Text>
              <Text style={styles.emptyMessage}>
                {error instanceof Error
                  ? error.message
                  : "Please check your connection and try again."}
              </Text>
              <Pressable
                onPress={() => void refetch()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons
                name="document-text-outline"
                size={34}
                color={colors.primary}
              />
              <Text style={styles.emptyTitle}>
                {fromMonthKey && toMonthKey
                  ? "No payslips in this month range"
                  : "No payslips available"}
              </Text>
              <Text style={styles.emptyMessage}>
                {fromMonthKey && toMonthKey
                  ? "Try selecting a different month range."
                  : "Your payslips will appear here once available."}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <View>
            {isFetchingNextPage && (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.emptyMessage}>
                  Loading more payslips...
                </Text>
              </View>
            )}

            {isFetchNextPageError && (
              <Pressable
                onPress={() => void fetchNextPage()}
                style={styles.retryButton}
              >
                <Text style={styles.retryButtonText}>Retry loading more</Text>
              </Pressable>
            )}

            {!hasNextPage && visiblePayslips.length > 0 && (
              <Text style={styles.endText}>All payslips loaded</Text>
            )}

            <View style={styles.infoRow}></View>
          </View>
        }
      />

      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.monthPickerModal}>
            <View style={styles.monthPickerHeader}>
              <Text style={styles.monthPickerTitle}>
                {pickerTarget === "from"
                  ? "Select From Month"
                  : "Select To Month"}
              </Text>

              <Pressable
                onPress={() => setPickerTarget(null)}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close month picker"
              >
                <Ionicons name="close" size={21} color={colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.yearPickerRow}>
              <Pressable
                onPress={() => setPickerYear((year) => year - 1)}
                style={styles.yearPickerButton}
                accessibilityRole="button"
                accessibilityLabel="Previous year"
              >
                <Ionicons
                  name="chevron-back"
                  size={20}
                  color={colors.textPrimary}
                />
              </Pressable>

              <Text style={styles.yearPickerText}>{pickerYear}</Text>

              <Pressable
                onPress={() => setPickerYear((year) => year + 1)}
                style={styles.yearPickerButton}
                accessibilityRole="button"
                accessibilityLabel="Next year"
              >
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_NAMES.map((month, index) => {
                const selectedMonth =
                  pickerTarget === "from" ? fromMonth : toMonth;

                const isSelected =
                  selectedMonth?.getFullYear() === pickerYear &&
                  selectedMonth?.getMonth() === index;

                return (
                  <Pressable
                    key={month}
                    onPress={() => selectMonth(index)}
                    style={[
                      styles.monthOption,
                      isSelected && styles.monthOptionSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${month} ${pickerYear}`}
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.monthOptionText,
                        isSelected && styles.monthOptionTextSelected,
                      ]}
                    >
                      {month.slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setPickerTarget(null)}
              style={styles.modalCancelButton}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  success: string;
  successBackground: string;
  warning: string;
  warningBackground: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 150,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 24,
      gap: 12,
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
    headerText: {
      flex: 1,
    },
    monthRangeRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 8,
    },
    monthRangeField: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 12,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthRangeLabel: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      color: colors.textMuted,
      marginBottom: 8,
    },
    monthRangeValueRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 4,
    },
    monthRangeValue: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: colors.textMuted,
    },
    monthRangeValueSelected: {
      color: colors.textPrimary,
    },
    monthRangeFooter: {
      minHeight: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },
    clearRangeText: {
      fontSize: 12,
      fontWeight: "700",
      color: colors.primary,
      paddingLeft: 10,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    monthPickerModal: {
      width: "100%",
      maxWidth: 360,
      padding: 20,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthPickerHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    monthPickerTitle: {
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    modalCloseButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    yearPickerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 18,
    },
    yearPickerButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    yearPickerText: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
      marginTop: 18,
    },
    monthOption: {
      width: "31%",
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthOptionSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    monthOptionText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    monthOptionTextSelected: {
      color: "#FFFFFF",
    },
    modalCancelButton: {
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
      paddingVertical: 12,
    },
    modalCancelText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    loadingMore: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      paddingVertical: 18,
    },
    endText: {
      fontSize: 12,
      textAlign: "center",
      color: colors.textMuted,
      paddingVertical: 16,
    },
    title: {
      fontSize: 22,
      lineHeight: 34,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    monthSelector: {
      minHeight: 76,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingLeft: 14,
      paddingRight: 8,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthLeft: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    calendarIconContainer: {
      width: 42,
      height: 42,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
      backgroundColor: colors.surfaceSecondary,
    },
    monthLabels: {
      flex: 1,
    },
    monthCaption: {
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      color: colors.textMuted,
      marginBottom: 3,
    },
    monthText: {
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    monthActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    monthButton: {
      width: 40,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledMonthButton: {
      opacity: 0.55,
    },
    section: {
      marginTop: 30,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 13,
    },
    sectionTitle: {
      fontSize: 19,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    sectionBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionBadgeText: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 26,
      paddingTop: 34,
      paddingBottom: 32,
      borderRadius: 22,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyIllustration: {
      width: 86,
      height: 86,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    documentIconContainer: {
      width: 72,
      height: 72,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptySparkle: {
      position: "absolute",
      top: 3,
      right: 2,
      width: 18,
      height: 18,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
      color: colors.textPrimary,
    },
    emptyMessage: {
      maxWidth: 270,
      marginTop: 8,
      fontSize: 13,
      lineHeight: 20,
      textAlign: "center",
      color: colors.textSecondary,
    },
    infoRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      marginTop: 16,
      paddingHorizontal: 4,
    },
    infoText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },

    payslipList: {
      gap: 12,
    },
    payslipCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      padding: 14,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    payslipDetails: {
      flex: 1,
      minWidth: 0,
    },
    payslipCardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    payslipPeriod: {
      flex: 1,
      fontSize: 14,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    statusBadge: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceSecondary,
    },
    statusBadgePaid: {
      borderColor: colors.successBackground,
      backgroundColor: colors.successBackground,
    },
    statusBadgePending: {
      borderColor: colors.warningBackground,
      backgroundColor: colors.warningBackground,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.textMuted,
    },
    statusDotPaid: {
      backgroundColor: colors.success,
    },
    statusDotPending: {
      backgroundColor: colors.warning,
    },
    statusBadgeText: {
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
      color: colors.textSecondary,
    },
    statusBadgeTextPaid: {
      color: colors.success,
    },
    statusBadgeTextPending: {
      color: colors.warning,
    },
    payslipMeta: {
      marginTop: 9,
      fontSize: 12,
      color: colors.textSecondary,
    },
    retryButton: {
      marginTop: 14,
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: colors.primary,
    },
    retryButtonText: {
      color: "#FFFFFF",
      fontSize: 13,
      fontWeight: "700",
    },
    payslipCardAction: {
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    payslipCardActionLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    payslipCardActionText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    payslipActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 8,
    },

    payslipActionButton: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },

    payslipActionText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },

    actionDisabled: {
      opacity: 0.5,
    },
  });
}
*/

import FeatureUnavailableScreen from "../../components/FeatureUnavailableScreen";

export default function PayoutScreen() {
  return <FeatureUnavailableScreen feature="Payout and payslips" />;
}