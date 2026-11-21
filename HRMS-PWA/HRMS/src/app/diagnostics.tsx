import { Ionicons } from "@expo/vector-icons";
import { Redirect, Stack, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useState } from "react";

import { AppText as Text } from "../components/InterTypography";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../auth/AuthProvider";

import {
  getDiagnosticEvents,
  type DiagnosticLogEntry,
} from "../location/diagnosticLog";

import NetInfo from "@react-native-community/netinfo";
import { ApiError, apiRequest } from "../api/client";
import { getTrustedClockSnapshot } from "../location/serverTime";

type NetworkStatusSnapshot = {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  connectionType: string;
  backendResponded: boolean | null;
  backendHttpStatus: number | null;
  backendMessage: string;
  checkedAt: string;
};

type TrustedClockStatus = {
  available: boolean;
  indiaWallClock: string | null;
  message: string;
  checkedAt: string;
};

function formatDiagnosticDetails(detailsJson: string | null): string | null {
  if (!detailsJson) {
    return null;
  }

  try {
    return JSON.stringify(JSON.parse(detailsJson), null, 2);
  } catch {
    return detailsJson;
  }
}

function DiagnosticsContent() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { accessToken } = useAuth();

  const [networkStatus, setNetworkStatus] =
    useState<NetworkStatusSnapshot | null>(null);
  const [isNetworkRefreshing, setIsNetworkRefreshing] = useState(false);
  const [networkStatusError, setNetworkStatusError] = useState<string | null>(
    null,
  );

  const [trustedClockStatus, setTrustedClockStatus] =
    useState<TrustedClockStatus | null>(null);
  const [isTrustedClockRefreshing, setIsTrustedClockRefreshing] =
    useState(false);

  const refreshTrustedClock = useCallback(async () => {
    setIsTrustedClockRefreshing(true);

    try {
      const snapshot = await getTrustedClockSnapshot();

      setTrustedClockStatus({
        available: true,
        indiaWallClock: snapshot.indiaWallClock,
        message: "Saved trusted server time is available.",
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      setTrustedClockStatus({
        available: false,
        indiaWallClock: null,
        message:
          error instanceof Error
            ? error.message
            : "Unable to read trusted server time.",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setIsTrustedClockRefreshing(false);
    }
  }, []);

  const refreshNetworkStatus = useCallback(async () => {
    setIsNetworkRefreshing(true);
    setNetworkStatusError(null);

    try {
      const network = await NetInfo.fetch();

      let backendResponded: boolean | null = null;
      let backendHttpStatus: number | null = null;
      let backendMessage = "Backend check was not performed.";

      if (!accessToken) {
        backendMessage =
          "No access token is available for the authenticated backend check.";
      } else {
        try {
          await apiRequest<unknown>("/api/mobile/v1/auth/me", {
            method: "GET",
            token: accessToken,
          });

          backendResponded = true;
          backendMessage =
            "The authenticated API endpoint responded successfully.";
        } catch (error) {
          if (error instanceof ApiError) {
            backendResponded = true;
            backendHttpStatus = error.status;
            backendMessage = `The API endpoint returned HTTP ${error.status}.`;
          } else {
            backendMessage =
              "Unable to confirm a valid response from the API endpoint.";
          }
        }
      }

      setNetworkStatus({
        isConnected: network.isConnected,
        isInternetReachable: network.isInternetReachable,
        connectionType: String(network.type),
        backendResponded,
        backendHttpStatus,
        backendMessage,
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      setNetworkStatusError("Unable to check network connectivity.");

      console.warn(
        "[HRMS_NETWORK_DIAGNOSTICS_FAILURE]",
        error instanceof Error ? error.name : typeof error,
      );
    } finally {
      setIsNetworkRefreshing(false);
    }
  }, [accessToken]);

  const [events, setEvents] = useState<DiagnosticLogEntry[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshEvents = useCallback(async () => {
    setIsRefreshing(true);
    setLoadError(null);

    try {
      const latestEvents = await getDiagnosticEvents(100);
      setEvents(latestEvents);
    } catch (error) {
      setLoadError(
        "Unable to load diagnostic events from local SQLite storage.",
      );

      console.warn(
        "[HRMS_DIAGNOSTICS_READ_FAILURE]",
        error instanceof Error ? error.name : typeof error,
      );
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const [isCopyingEvents, setIsCopyingEvents] = useState(false);
  const copyAllEvents = useCallback(async () => {
    setIsCopyingEvents(true);

    try {
      const allEvents = await getDiagnosticEvents(250);

      const diagnosticReport = {
        reportGeneratedAt: new Date().toISOString(),

        trustedServerTime: trustedClockStatus ?? {
          status: "Not checked",
        },

        networkAndBackend: networkStatus ?? {
          status: "Not checked",
          error: networkStatusError,
        },

        diagnosticEvents: {
          totalEvents: allEvents.length,
          loadError,
          events: allEvents.map((event) => ({
            id: event.id,
            occurredAt: event.occurredAt,
            level: event.level,
            source: event.source,
            event: event.event,
            message: event.message,
            details: formatDiagnosticDetails(event.detailsJson),
          })),
        },
      };

      const exportText = JSON.stringify(diagnosticReport, null, 2);

      await Clipboard.setStringAsync(exportText, {
        android: { isSensitive: true },
      });

      setEvents(allEvents);

      Alert.alert(
        "Diagnostics copied",
        `Complete diagnostic report copied successfully.\n\n${allEvents.length} events included.`,
      );
    } catch (error) {
      Alert.alert(
        "Copy failed",
        error instanceof Error
          ? error.message
          : "Unable to copy diagnostic report.",
      );
    } finally {
      setIsCopyingEvents(false);
    }
  }, [trustedClockStatus, networkStatus, networkStatusError, loadError]);
  useEffect(() => {
    void refreshEvents();
  }, [refreshEvents]);

  useEffect(() => {
    void refreshNetworkStatus();
  }, [refreshNetworkStatus]);

  useEffect(() => {
    void refreshTrustedClock();
  }, [refreshTrustedClock]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
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
              <Ionicons
                name="arrow-back"
                size={22}
                color={colors.textPrimary}
              />
            </Pressable>

            <Text style={styles.headerTitle}>Diagnostics</Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pulse-outline" size={22} color={colors.primary} />
              <Text style={styles.sectionTitle}>Application diagnostics</Text>
            </View>

            <Text style={styles.bodyText}>
              Check network connectivity, authenticated backend connectivity and
              application diagnostic events.
            </Text>
          </View>
          <View style={styles.networkCard}>
            <View style={styles.networkHeader}>
              <Text style={styles.networkTitle}>Trusted server time</Text>

              <Pressable
                onPress={() => void refreshTrustedClock()}
                disabled={isTrustedClockRefreshing}
                style={styles.refreshButton}
                accessibilityRole="button"
                accessibilityLabel="Refresh trusted clock status"
              >
                {isTrustedClockRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={colors.primary}
                  />
                )}
                <Text style={styles.refreshText}>
                  {isTrustedClockRefreshing ? "Checking..." : "Refresh"}
                </Text>
              </Pressable>
            </View>

            {trustedClockStatus ? (
              <>
                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>Availability</Text>
                  <Text style={styles.networkValue}>
                    {trustedClockStatus.available ? "Available" : "Unavailable"}
                  </Text>
                </View>

                {trustedClockStatus.indiaWallClock ? (
                  <View style={styles.networkRow}>
                    <Text style={styles.networkLabel}>Trusted India time</Text>
                    <Text style={styles.networkValue}>
                      {trustedClockStatus.indiaWallClock}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.networkMessage}>
                  {trustedClockStatus.message}
                </Text>

                <Text style={styles.networkLastChecked}>
                  Last checked:{" "}
                  {new Date(trustedClockStatus.checkedAt).toLocaleString()}
                </Text>
              </>
            ) : (
              <Text style={styles.bodyText}>
                Trusted time has not been checked yet.
              </Text>
            )}
          </View>
          <View style={styles.networkCard}>
            <View style={styles.networkHeader}>
              <Text style={styles.networkTitle}>Network & backend</Text>

              <Pressable
                onPress={() => void refreshNetworkStatus()}
                disabled={isNetworkRefreshing}
                accessibilityRole="button"
                accessibilityLabel="Refresh network and backend status"
                style={({ pressed }) => [
                  styles.refreshButton,
                  pressed && !isNetworkRefreshing && styles.pressed,
                  isNetworkRefreshing && styles.disabledButton,
                ]}
              >
                {isNetworkRefreshing ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={colors.primary}
                  />
                )}

                <Text style={styles.refreshText}>
                  {isNetworkRefreshing ? "Checking..." : "Refresh"}
                </Text>
              </Pressable>
            </View>

            {networkStatusError ? (
              <Text style={styles.loadErrorText}>{networkStatusError}</Text>
            ) : null}

            {!networkStatus && isNetworkRefreshing ? (
              <Text style={styles.bodyText}>
                Checking network connection...
              </Text>
            ) : null}

            {!networkStatus && !isNetworkRefreshing && !networkStatusError ? (
              <Text style={styles.bodyText}>
                Network status has not been checked yet.
              </Text>
            ) : null}

            {networkStatus ? (
              <>
                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>Network connection</Text>
                  <Text style={styles.networkValue}>
                    {networkStatus.isConnected === null
                      ? "Unknown"
                      : networkStatus.isConnected
                        ? "Connected"
                        : "Disconnected"}
                  </Text>
                </View>

                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>Internet reachability</Text>
                  <Text style={styles.networkValue}>
                    {networkStatus.isInternetReachable === null
                      ? "Unknown"
                      : networkStatus.isInternetReachable
                        ? "Reachable"
                        : "Not reachable"}
                  </Text>
                </View>

                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>Connection type</Text>
                  <Text style={styles.networkValue}>
                    {networkStatus.connectionType}
                  </Text>
                </View>

                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>Backend endpoint</Text>
                  <Text style={styles.networkValue}>
                    {networkStatus.backendResponded === null
                      ? "Not confirmed"
                      : networkStatus.backendResponded
                        ? "Responded"
                        : "No response"}
                  </Text>
                </View>

                <View style={styles.networkRow}>
                  <Text style={styles.networkLabel}>HTTP status</Text>
                  <Text style={styles.networkValue}>
                    {networkStatus.backendHttpStatus === null
                      ? "Not available"
                      : String(networkStatus.backendHttpStatus)}
                  </Text>
                </View>

                <Text style={styles.networkMessage}>
                  {networkStatus.backendMessage}
                </Text>

                <Text style={styles.networkLastChecked}>
                  Last checked:{" "}
                  {new Date(networkStatus.checkedAt).toLocaleString()}
                </Text>
              </>
            ) : null}
          </View>

          <View style={styles.eventsCard}>
            <View style={styles.eventsHeader}>
              <Text style={styles.eventsTitle}>Recent diagnostic events</Text>

              <View style={styles.eventActions}>
                <Pressable
                  onPress={() => void refreshEvents()}
                  disabled={isRefreshing}
                  accessibilityRole="button"
                  accessibilityLabel="Refresh diagnostic events"
                  style={({ pressed }) => [
                    styles.refreshButton,
                    pressed && !isRefreshing && styles.pressed,
                    isRefreshing && styles.disabledButton,
                  ]}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="refresh-outline"
                      size={18}
                      color={colors.primary}
                    />
                  )}

                  <Text style={styles.refreshText}>
                    {isRefreshing ? "Loading..." : "Refresh"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void copyAllEvents()}
                  disabled={isCopyingEvents}
                  accessibilityRole="button"
                  accessibilityLabel="Copy complete diagnostic report"
                  style={({ pressed }) => [
                    styles.refreshButton,
                    pressed && !isCopyingEvents && styles.pressed,
                    isCopyingEvents && styles.disabledButton,
                  ]}
                >
                  {isCopyingEvents ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons
                      name="copy-outline"
                      size={18}
                      color={colors.primary}
                    />
                  )}

                  <Text style={styles.refreshText}>
                    {isCopyingEvents ? "Preparing..." : "Copy diagnostics"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {loadError ? (
              <Text style={styles.loadErrorText}>{loadError}</Text>
            ) : null}

            {!loadError && events.length === 0 ? (
              <Text style={styles.bodyText}>
                {isRefreshing
                  ? "Loading diagnostic history..."
                  : "No diagnostic events have been recorded yet."}
              </Text>
            ) : null}

            {events.map((event) => (
              <View key={event.id} style={styles.eventItem}>
                <Text style={styles.eventType}>
                  {event.level} · {event.event}
                </Text>

                <Text style={styles.eventTime}>
                  {new Date(event.occurredAt).toLocaleString()}
                </Text>

                <Text style={styles.eventSource}>{event.source}</Text>

                <Text style={styles.eventMessage}>{event.message}</Text>

                {event.detailsJson ? (
                  <Text selectable style={styles.eventDetails}>
                    {formatDiagnosticDetails(event.detailsJson)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

function createStyles(colors: {
  background: string;
  surface: string;
  surfaceSecondary: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  primary: string;
}) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 40,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 24,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 12,
    },
    pressed: {
      opacity: 0.78,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    infoCard: {
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 12,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    bodyText: {
      fontSize: 14,
      lineHeight: 21,
      color: colors.textSecondary,
    },
    networkCard: {
      marginTop: 18,
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    networkHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12,
    },
    networkTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    networkRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingVertical: 11,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    networkLabel: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    networkValue: {
      maxWidth: "48%",
      fontSize: 13,
      fontWeight: "700",
      textAlign: "right",
      color: colors.textPrimary,
    },
    networkMessage: {
      marginTop: 12,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    networkLastChecked: {
      marginTop: 10,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    eventsCard: {
      marginTop: 18,
      padding: 18,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    eventsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 12,
    },
    eventActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    eventsTitle: {
      flex: 1,
      fontSize: 16,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    refreshButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: colors.surfaceSecondary,
    },
    refreshText: {
      fontSize: 13,
      fontWeight: "700",
      color: colors.primary,
    },
    disabledButton: {
      opacity: 0.55,
    },
    loadErrorText: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    eventItem: {
      paddingVertical: 13,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    eventType: {
      fontSize: 13,
      fontWeight: "800",
      color: colors.textPrimary,
    },
    eventTime: {
      marginTop: 5,
      fontSize: 11,
      color: colors.textSecondary,
    },
    eventSource: {
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
      color: colors.primary,
    },
    eventMessage: {
      marginTop: 4,
      fontSize: 13,
      lineHeight: 19,
      color: colors.textSecondary,
    },
    eventDetails: {
      marginTop: 8,
      padding: 10,
      borderRadius: 8,
      backgroundColor: colors.surfaceSecondary,
      fontSize: 11,
      lineHeight: 16,
      color: colors.textSecondary,
    },
  });
}

export default function DiagnosticsScreen() {
  const { user } = useAuth();

  const normalizedRole = String(user?.role ?? "").toUpperCase();

  const canAccessDiagnostics =
    [
      "SUPERADMIN",
      "SERVICE_PROVIDER",
      "COMPANY_ADMIN",
      "MULTI_COMPANY_ADMIN",
      "ADMIN",
      "BRANCH_ADMIN",
    ].includes(normalizedRole) ||
    (normalizedRole === "EMPLOYEE" &&
      user?.type === "employee" &&
      user?.isCompanyOwner === true);

  if (!__DEV__ && !canAccessDiagnostics) {
    return <Redirect href="/(tabs)" />;
  }

  return <DiagnosticsContent />;
}
