import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Alert, AppState, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./InterTypography";

import {
  getTrustedPunchTime,
  getTrustedClockSnapshot,
} from "../location/serverTime";
import {
  getLatestAttendanceEvent,
  getLatestCheckInEventForDate,
  getOpenPunchInEvent,
  saveAttendanceEvent,
  type AttendanceQueueEvent,
} from "../location/attendanceQueue";

import { syncPendingAttendanceEvents } from "../location/attendanceSync";

import { useAuth } from "../auth/AuthProvider";

import NetInfo from "@react-native-community/netinfo";

import LiveClock from "./LiveClock";
import { useAttendanceToday, usePunchAttendance } from "../hooks/useAttendance";
import { useTheme } from "../theme/ThemeProvider";

export default function AttendanceHero() {
  const { user, accessToken } = useAuth();
  const { colors } = useTheme();
  const {
    data: attendance,
    isLoading,
    isError,
    error,
    isRefetching,
    refetch,
  } = useAttendanceToday();
  const punchMutation = usePunchAttendance();
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [latestLocalEvent, setLatestLocalEvent] =
    useState<AttendanceQueueEvent | null>(null);
  const [localCheckInEvent, setLocalCheckInEvent] =
    useState<AttendanceQueueEvent | null>(null);

  const [trustedTodayKey, setTrustedTodayKey] = useState<string | null>(null);

  useEffect(() => {
    const employeeId = user?.employee?.id;

    if (
      typeof employeeId !== "number" ||
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0
    ) {
      setLatestLocalEvent(null);
      return;
    }

    const validEmployeeId: number = employeeId;

    let cancelled = false;

    async function refreshLocalEvent() {
      try {
        const event = await getLatestAttendanceEvent(validEmployeeId);

        if (!cancelled) {
          setLatestLocalEvent(event);
        }
      } catch (loadError: unknown) {
        console.warn(
          "[HRMS_ATTENDANCE] Could not refresh local attendance state:",
          loadError,
        );
      }
    }

    void refreshLocalEvent();

    const timer = setInterval(() => {
      void refreshLocalEvent();
    }, 15000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshLocalEvent();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, [user?.employee?.id, attendance?.checkIn?.id, attendance?.checkOut?.id]);

  const styles = createStyles(colors);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;

    async function refreshTrustedDate() {
      if (cancelled || refreshing) {
        return;
      }

      refreshing = true;

      try {
        const snapshot = await getTrustedClockSnapshot();

        if (!cancelled) {
          setTrustedTodayKey(snapshot.indiaWallClock.slice(0, 10));
        }
      } catch {
        if (!cancelled) {
          setTrustedTodayKey(null);
        }
      } finally {
        refreshing = false;
      }
    }

    void refreshTrustedDate();

    const timer = setInterval(() => {
      void refreshTrustedDate();
    }, 15000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshTrustedDate();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const todayKey = trustedTodayKey;

  useEffect(() => {
    const employeeId = user?.employee?.id;

    if (!Number.isSafeInteger(employeeId) || !employeeId || !todayKey) {
      setLocalCheckInEvent(null);
      return;
    }

    let cancelled = false;

    void getLatestCheckInEventForDate(employeeId, todayKey)
      .then((event) => {
        if (!cancelled) {
          setLocalCheckInEvent(event);
        }
      })
      .catch((loadError: unknown) => {
        console.warn(
          "[HRMS_ATTENDANCE] Could not load today's local check-in:",
          loadError,
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    user?.employee?.id,
    todayKey,
    attendance?.checkIn?.id,
    latestLocalEvent?.id,
  ]);

  const hasLocalEventForToday = Boolean(
    todayKey && latestLocalEvent?.punchTime.slice(0, 10) === todayKey,
  );

  const rejectedLocalEventForToday =
    hasLocalEventForToday && latestLocalEvent?.permanentFailure === 1;

  const hasAcceptedLocalEventForToday =
    hasLocalEventForToday && !rejectedLocalEventForToday;

  const isCheckedIn = hasAcceptedLocalEventForToday
    ? true
    : (attendance?.isCheckedIn ?? false);

  const isCheckedOut = hasAcceptedLocalEventForToday
    ? latestLocalEvent?.checkType === "CHECK_OUT"
    : (attendance?.isCheckedOut ?? false);

  const checkInTime = formatAttendanceTime(
    (localCheckInEvent?.permanentFailure !== 1
      ? localCheckInEvent?.punchTime.replace(" ", "T")
      : undefined) ?? attendance?.checkIn?.time,
  );

  const localCheckOutTime =
    hasLocalEventForToday &&
    latestLocalEvent?.checkType === "CHECK_OUT" &&
    latestLocalEvent.permanentFailure !== 1
      ? latestLocalEvent.punchTime.replace(" ", "T")
      : undefined;

  const checkOutTime = formatAttendanceTime(
    localCheckOutTime ?? attendance?.checkOut?.time,
  );

  const localCheckOutLocation =
    hasAcceptedLocalEventForToday &&
    latestLocalEvent?.checkType === "CHECK_OUT" &&
    latestLocalEvent.permanentFailure !== 1
      ? latestLocalEvent.address?.trim()
      : undefined;

  const serverCheckOutLocation = attendance?.checkOutLocation?.trim();

  const checkOutLocation = localCheckOutLocation || serverCheckOutLocation;

  const localCheckInLocation =
    localCheckInEvent?.permanentFailure !== 1
      ? localCheckInEvent?.address?.trim()
      : undefined;

  const serverCheckInLocation = attendance?.checkInLocation?.trim();

  const checkInLocation = hasAcceptedLocalEventForToday
    ? localCheckInLocation ||
      (localCheckInEvent?.status === "SYNCED" &&
      localCheckInEvent.permanentFailure !== 1
        ? serverCheckInLocation
        : "")
    : serverCheckInLocation;

  const location = checkOutLocation || checkInLocation || "—";

  const locationLabel = checkOutLocation
    ? "Check-out location"
    : "Check-in location";

  const hasLocation = location !== "—";

  const statusText = rejectedLocalEventForToday
    ? latestLocalEvent?.checkType === "CHECK_OUT"
      ? "CHECK-OUT REJECTED"
      : "CHECK-IN REJECTED"
    : hasAcceptedLocalEventForToday
      ? isCheckedOut
        ? "CHECKED OUT"
        : "CHECKED IN"
      : isError
        ? "ATTENDANCE UNAVAILABLE"
        : isLoading
          ? "LOADING ATTENDANCE"
          : isCheckedOut
            ? "CHECKED OUT"
            : isCheckedIn
              ? "CHECKED IN"
              : "NOT MARKED";

  const buttonLabel = punchMutation.isPending
    ? "PROCESSING..."
    : isGettingLocation
      ? "SAVING..."
      : isLoading && !attendance && !hasAcceptedLocalEventForToday
        ? "LOADING..."
        : isCheckedIn && !isCheckedOut
          ? "CHECK OUT"
          : "CHECK IN";

  async function handleAttendancePress() {
    if (
      (isLoading && !attendance && !hasAcceptedLocalEventForToday) ||
      punchMutation.isPending ||
      isGettingLocation
    ) {
      return;
    }

    const checkType = isCheckedIn && !isCheckedOut ? "CHECK_OUT" : "CHECK_IN";

    const employeeId = user?.employee?.id;

    if (
      typeof employeeId !== "number" ||
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0
    ) {
      Alert.alert(
        "Attendance",
        "Employee information is unavailable. Please sign in again.",
      );
      return;
    }

    setIsGettingLocation(true);

    let localPunchSaved = false;

    try {
      const coordinates = await getCurrentCoordinates();

      // Legacy server check-in: it has no local event ID to reference.
      // Preserve online checkout for this case only.
      if (checkType === "CHECK_OUT") {
        const referenceEventId = await getOpenPunchInEvent(employeeId);

        if (!referenceEventId) {
          const latestQueuedEvent = await getLatestAttendanceEvent(employeeId);

          if (
            latestQueuedEvent?.checkType === "CHECK_OUT" &&
            latestQueuedEvent.status !== "SYNCED" &&
            latestQueuedEvent.permanentFailure !== 1
          ) {
            setLatestLocalEvent(latestQueuedEvent);

            throw new Error(
              "Your previous checkout is still waiting for backend confirmation. Please let it sync before submitting another checkout.",
            );
          }

          const network = await NetInfo.fetch();

          if (!attendance?.isCheckedIn || attendance.isCheckedOut) {
            throw new Error(
              "A matching local check-in was not found. Refresh attendance while connected before checking out.",
            );
          }

          if (!network.isConnected || network.isInternetReachable === false) {
            throw new Error(
              "This check-in does not have a local offline reference. Reconnect to the internet to check out this existing session.",
            );
          }

          await punchMutation.mutateAsync({
            checkType,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            accuracy: coordinates.accuracy,
            address: coordinates.address,
          });

          try {
            await refetch();
          } catch (refreshError) {
            console.warn(
              "[HRMS_ATTENDANCE] Could not refresh legacy checkout:",
              refreshError,
            );
          }

          return;
        }

        // Save checkout locally before contacting the server.
        const trustedTime = await getTrustedPunchTime();
        await saveAttendanceEvent({
          employeeId,
          checkType: "CHECK_OUT",
          referenceEventId,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          accuracy: coordinates.accuracy,
          address: coordinates.address,
          punchTime: trustedTime.punchTime,
          timeProof: trustedTime.timeProof,
          monotonicTime: trustedTime.monotonicTime,
        });

        localPunchSaved = true;

        try {
          setLatestLocalEvent(await getLatestAttendanceEvent(employeeId));
        } catch (refreshError) {
          console.warn(
            "[HRMS_ATTENDANCE] Could not refresh local checkout state:",
            refreshError,
          );
        }

        if (accessToken) {
          try {
            await syncPendingAttendanceEvents(employeeId, accessToken);
          } catch (syncError) {
            console.warn(
              "[HRMS_ATTENDANCE] Checkout remains queued:",
              syncError,
            );
          }
        }

        let latestEvent: AttendanceQueueEvent | null = null;

        try {
          latestEvent = await getLatestAttendanceEvent(employeeId);
          setLatestLocalEvent(latestEvent);
        } catch (refreshError) {
          console.warn(
            "[HRMS_ATTENDANCE] Could not refresh checkout sync status:",
            refreshError,
          );
        }

        try {
          await refetch();
        } catch (refreshError) {
          console.warn(
            "[HRMS_ATTENDANCE] Could not refresh server attendance:",
            refreshError,
          );
        }

        if (latestEvent?.permanentFailure === 1) {
          Alert.alert(
            "Checkout rejected",
            latestEvent.lastError ??
              "The server rejected this checkout. Review the attendance error before trying again.",
          );
        } else if (latestEvent?.status !== "SYNCED") {
          Alert.alert(
            "Checkout saved locally",
            "Your checkout is saved on this device and will sync when a connection is available.",
          );
        }

        return;
      }

      // Save check-in locally first. The backend will record the
      // original punch time when the queued event eventually syncs.
      const trustedTime = await getTrustedPunchTime();

      await saveAttendanceEvent({
        employeeId,
        checkType: "CHECK_IN",
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        accuracy: coordinates.accuracy,
        address: coordinates.address,
        punchTime: trustedTime.punchTime,
        timeProof: trustedTime.timeProof,
        monotonicTime: trustedTime.monotonicTime,
      });

      localPunchSaved = true;

      try {
        setLatestLocalEvent(await getLatestAttendanceEvent(employeeId));
      } catch (refreshError) {
        console.warn(
          "[HRMS_ATTENDANCE] Could not refresh local check-in state:",
          refreshError,
        );
      }

      if (accessToken) {
        try {
          await syncPendingAttendanceEvents(employeeId, accessToken);
        } catch (syncError) {
          console.warn("[HRMS_ATTENDANCE] Check-in remains queued:", syncError);
        }
      }

      let latestEvent: AttendanceQueueEvent | null = null;

      try {
        latestEvent = await getLatestAttendanceEvent(employeeId);
        setLatestLocalEvent(latestEvent);
      } catch (refreshError) {
        console.warn(
          "[HRMS_ATTENDANCE] Could not refresh check-in sync status:",
          refreshError,
        );
      }

      try {
        await refetch();
      } catch (refreshError) {
        console.warn(
          "[HRMS_ATTENDANCE] Could not refresh server attendance:",
          refreshError,
        );
      }

      if (latestEvent?.permanentFailure === 1) {
        Alert.alert(
          "Check-in rejected",
          latestEvent.lastError ??
            "The server rejected this check-in. Review the attendance error before trying again.",
        );
      } else {
        const syncMessage =
          latestEvent?.status === "SYNCED"
            ? "Your check-in synced successfully."
            : "Your check-in is saved on this device and will sync when a connection is available.";
        if (latestEvent?.status !== "SYNCED") {
          Alert.alert("Check-in saved locally", syncMessage);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to update attendance.";

      Alert.alert(
        localPunchSaved ? "Attendance saved locally" : "Attendance",
        localPunchSaved
          ? `Your punch is saved on this device. Some follow-up steps could not finish. It will sync when a connection is available.\n\n${message}`
          : message,
      );
    } finally {
      setIsGettingLocation(false);
    }
  }

  async function handleRetry() {
    try {
      await refetch();
    } catch {
      // React Query exposes the failed request through its query state.
    }
  }

  const displayedError =
    error instanceof Error && error.message.trim()
      ? error.message
      : "We couldn't load today's attendance. Please try again.";

  const buttonDisabled =
    (isLoading && !attendance && !hasAcceptedLocalEventForToday) ||
    punchMutation.isPending ||
    isGettingLocation;

  return (
    <View style={styles.card}>
      {statusText !== "NOT MARKED" && (
        <View style={styles.statusContainer}>
          <View style={styles.statusDetails}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    !isError && isCheckedIn && !isCheckedOut
                      ? colors.success
                      : colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    !isError && isCheckedIn && !isCheckedOut
                      ? colors.success
                      : colors.textSecondary,
                },
              ]}
            >
              {statusText}
            </Text>
          </View>
        </View>
      )}

      {isError && (
        <View style={styles.errorPanel}>
          <Ionicons
            name="cloud-offline-outline"
            size={20}
            color={colors.textSecondary}
          />
          <View style={styles.errorContent}>
            <Text style={styles.errorMessage}>{displayedError}</Text>
            <Pressable
              onPress={() => void handleRetry()}
              disabled={isRefetching}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && !isRefetching && styles.buttonPressed,
                isRefetching && styles.buttonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Retry loading attendance"
              accessibilityState={{
                disabled: isRefetching,
                busy: isRefetching,
              }}
            >
              {isRefetching ? (
                <>
                  <Ionicons
                    name="sync-outline"
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.retryText}>Retrying...</Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name="refresh-outline"
                    size={15}
                    color={colors.primary}
                  />
                  <Text style={styles.retryText}>Try again</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      <View>
        <View style={styles.clockSection}>
          {todayKey ? (
            <Text style={styles.date}>
              {new Date(`${todayKey}T00:00:00.000Z`).toLocaleDateString(
                "en-GB",
                {
                  timeZone: "UTC",
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                },
              )}
            </Text>
          ) : null}
          <LiveClock />
        </View>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>IN</Text>
            <Text style={styles.metricValue}>
              {isLoading || isError ? "—" : checkInTime}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.metric}>
            <Text style={styles.metricLabel}>OUT</Text>
            <Text style={styles.metricValue}>
              {isLoading || isError ? "—" : checkOutTime}
            </Text>
          </View>
        </View>

        <View style={styles.locationSlot}>
          {hasLocation && (
            <View style={styles.location}>
              <View style={styles.locationIcon}>
                <Ionicons name="checkmark" size={16} color={colors.success} />
              </View>
              <View style={styles.locationContent}>
                <Text style={styles.locationTitle}>{locationLabel}</Text>
                <Text style={styles.locationSubtitle} numberOfLines={2}>
                  {location}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <Pressable
        onPress={() => void handleAttendancePress()}
        disabled={buttonDisabled}
        style={({ pressed }) => [
          styles.button,
          buttonDisabled && styles.buttonDisabled,
          pressed && !buttonDisabled && styles.buttonPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={buttonLabel}
        accessibilityState={{
          disabled: buttonDisabled,
          busy: punchMutation.isPending || isGettingLocation,
        }}
      >
        <Text style={styles.buttonText}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}

async function getCurrentCoordinates(): Promise<{
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
}> {
  let permission = await Location.getForegroundPermissionsAsync();

  if (permission.status !== "granted") {
    permission = await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== "granted") {
    throw new Error(
      permission.canAskAgain
        ? "Location permission is required to record attendance. Allow location access and try again."
        : "Location permission is blocked. Enable location access for this app in your device settings, then try again.",
    );
  }

  const servicesEnabled = await Location.hasServicesEnabledAsync();
  if (!servicesEnabled) {
    throw new Error(
      "Turn on your device's Location/GPS service and try again.",
    );
  }

  const position = await getCurrentPositionWithTimeout(20_000);

  let address: string | undefined;

  try {
    const placemarks = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });

    const place = placemarks[0];

    if (place) {
      const street = [place.streetNumber, place.street]
        .filter(Boolean)
        .join(" ");

      const parts = [
        place.name,
        street,
        place.district,
        place.city,
        place.subregion,
        place.region,
        place.postalCode,
        place.country,
      ]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part));

      address = [...new Set(parts)].join(", ") || undefined;
    }
  } catch (error) {
    console.warn(
      "[HRMS_LOCATION_DIAG] Device reverse geocoding failed; backend will try.",
      error,
    );
  }

  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy ?? undefined,
    address,
  };
}

function getCurrentPositionWithTimeout(
  timeoutMs: number,
): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          "Couldn't get your current location within 20 seconds. Check your GPS signal and try again.",
        ),
      );
    }, timeoutMs);

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then((position) => {
        if (timedOut) return;
        clearTimeout(timeoutId);
        resolve(position);
      })
      .catch((error: unknown) => {
        if (timedOut) return;
        clearTimeout(timeoutId);
        reject(
          error instanceof Error
            ? error
            : new Error("Unable to read your current location."),
        );
      });
  });
}

function formatAttendanceTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) {
    return value;
  }

  const hours = Number(match[1]);
  const minutes = match[2];
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${displayHour}:${minutes} ${period}`;
}

function createStyles(colors: {
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  success: string;
  successBackground: string;
  white: string;
}) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingTop: 1,
      paddingBottom: 32,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 12,
      elevation: 3,
    },

    statusContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    statusDetails: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 1,
    },

    statusDot: { width: 9, height: 9, borderRadius: 5 },
    statusText: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
    errorPanel: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 15,
      padding: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    errorContent: { flex: 1 },
    errorMessage: {
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    retryButton: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 8,
      paddingVertical: 4,
    },
    retryText: { fontSize: 12, fontWeight: "800", color: colors.primary },
    clockSection: { alignItems: "center", marginTop: 14 },
    clockLabel: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textMuted,
      letterSpacing: 1.2,
    },
    date: { marginTop: 6, fontSize: 14, color: colors.textSecondary },
    metrics: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 16,
    },
    metric: { flex: 1, alignItems: "center" },
    metricLabel: { fontSize: 10, fontWeight: "600", color: colors.textMuted },
    metricValue: {
      marginTop: 1,
      fontSize: 14,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    divider: { width: 1, height: 36, backgroundColor: colors.border },
    locationSlot: {
      height: 68,
      justifyContent: "flex-end",
    },
    location: {
      height: 68,
      flexDirection: "row",
      alignItems: "center",
      padding: 10,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
    },
    locationIcon: {
      width: 28,
      height: 28,
      marginRight: 10,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.successBackground,
    },
    locationIconUnavailable: { backgroundColor: colors.surface },
    locationContent: { flex: 1 },
    locationTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    locationSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: colors.textSecondary,
    },
    button: {
      height: 42,
      marginTop: 10,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: colors.white,
      fontSize: 14,
      fontWeight: "800",
      letterSpacing: 0.5,
    },
    buttonDisabled: { opacity: 0.55 },
    buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  });
}
