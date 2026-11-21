import { useEffect } from "react";
import * as Location from "expo-location";
import { Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";

import { LOCATION_TASK_NAME } from "./backgroundLocationTask";
import { useAuth } from "../auth/AuthProvider";
import { syncPendingAttendanceEvents } from "./attendanceSync";
import { syncServerTime } from "./serverTime";

export function useLocationSyncLifecycle(): void {
  const { accessToken, user, isLoading } = useAuth();
  const employeeId = user?.employee?.id;

  // Stop any previously registered background GPS task.
  // This runs even when the employee is logged out.
  useEffect(() => {
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      return;
    }

    let cancelled = false;
    let stopped = false;
    let retryInterval: ReturnType<typeof setInterval> | undefined;

    async function stopLegacyTracking(): Promise<void> {
      if (cancelled || stopped) return;

      try {
        const isTracking =
          await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

        if (isTracking) {
          await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        }

        stopped = true;

        if (retryInterval) {
          clearInterval(retryInterval);
        }

        console.log("[HRMS_LOCATION] Legacy background tracking stopped.");
      } catch (error) {
        console.warn(
          "[HRMS_LOCATION] Could not stop legacy tracking. Retrying:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    void stopLegacyTracking();

    retryInterval = setInterval(() => {
      void stopLegacyTracking();
    }, 10000);

    return () => {
      cancelled = true;

      if (retryInterval) {
        clearInterval(retryInterval);
      }
    };
  }, []);

  // Preserve offline attendance punch synchronization.
  useEffect(() => {
    if (
      isLoading ||
      !accessToken ||
      typeof employeeId !== "number" ||
      !Number.isSafeInteger(employeeId) ||
      employeeId <= 0
    ) {
      return;
    }

    let cancelled = false;
    let running = false;

    async function syncWhenPossible(): Promise<void> {
      if (cancelled || running) return;

      running = true;

      try {
        const network = await NetInfo.fetch();

        if (!network.isConnected || network.isInternetReachable === false) {
          return;
        }

        try {
          await syncServerTime(accessToken!);
        } catch (error) {
          console.warn(
            "Could not refresh trusted server time:",
            error instanceof Error ? error.message : String(error),
          );
        }

        if (!cancelled) {
          await syncPendingAttendanceEvents(employeeId!, accessToken!);
        }
      } catch (error) {
        console.warn(
          "Attendance sync will retry when connectivity returns:",
          error instanceof Error ? error.message : String(error),
        );
      } finally {
        running = false;
      }
    }

    void syncWhenPossible();

    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncWhenPossible();
      }
    });

    const interval = setInterval(() => {
      void syncWhenPossible();
    }, 30000);

    return () => {
      cancelled = true;
      unsubscribeNetwork();
      clearInterval(interval);
    };
  }, [accessToken, employeeId, isLoading]);
}
