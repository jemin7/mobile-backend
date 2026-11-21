import NetInfo from "@react-native-community/netinfo";

import { syncQueuedAttendancePunch } from "../api/attendance";

import {
  getAttendanceEventByClientEventId,
  getPendingAttendanceEvents,
  markAttendanceEventSynced,
  markAttendanceEventSyncing,
  recoverInterruptedAttendanceEvents,
  returnAttendanceEventToPending,
  markAttendanceEventRejected,
} from "./attendanceQueue";

import { ApiError } from "../api/client";

const recoveredEmployees = new Set<number>();
const activeSyncs = new Map<number, Promise<number>>();

function isPermanentAttendanceRejection(error: unknown): boolean {
  if (!(error instanceof ApiError)) {
    return false;
  }

  if ([400, 403, 409, 422].includes(error.status)) {
    return true;
  }

  return false;
}

async function performAttendanceSync(
  employeeId: number,
  token: string,
): Promise<number> {
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    throw new Error("A valid employee ID is required for attendance sync.");
  }

  if (!token.trim()) {
    throw new Error("Authentication is required for attendance sync.");
  }

  const network = await NetInfo.fetch();

  if (!network.isConnected || network.isInternetReachable === false) {
    return 0;
  }

  if (!recoveredEmployees.has(employeeId)) {
    await recoverInterruptedAttendanceEvents(employeeId);
    recoveredEmployees.add(employeeId);
  }

  const pendingEvents = await getPendingAttendanceEvents(employeeId);
  let syncedCount = 0;

  for (const event of pendingEvents) {
    if (!event.timeProof?.trim()) {
      await markAttendanceEventRejected(
        event.id,
        "This punch has no signed server time proof and requires administrator review.",
      );
      continue;
    }

    if (event.checkType === "CHECK_OUT") {
      if (!event.referenceEventId) {
        await markAttendanceEventRejected(
          event.id,
          "Checkout has no reference to its original check-in.",
        );
        continue;
      }

      const checkIn = await getAttendanceEventByClientEventId(
        employeeId,
        event.referenceEventId,
      );

      if (!checkIn || checkIn.checkType !== "CHECK_IN") {
        await markAttendanceEventRejected(
          event.id,
          "The referenced check-in event could not be found.",
        );
        continue;
      }

      if (checkIn.permanentFailure === 1) {
        await markAttendanceEventRejected(
          event.id,
          `Checkout rejected because its check-in failed: ${
            checkIn.lastError ?? "Check-in was not accepted."
          }`,
        );
        continue;
      }

      // Wait until the original check-in is confirmed by the server.
      if (checkIn.status !== "SYNCED" || !checkIn.serverPunchId) {
        break;
      }
    }

    await markAttendanceEventSyncing(event.id);

    try {
      const punch = await syncQueuedAttendancePunch(
        {
          clientEventId: event.clientEventId,
          referenceEventId: event.referenceEventId,
          checkType: event.checkType,
          punchTime: event.punchTime,
          latitude: event.latitude,
          longitude: event.longitude,
          accuracy: event.accuracy,
          address: event.address,
          timeProof: event.timeProof,
        },
        token,
      );

      await markAttendanceEventSynced(event.id, punch.id);
      syncedCount += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Attendance sync failed.";

      if (isPermanentAttendanceRejection(error)) {
        await markAttendanceEventRejected(event.id, message);

        console.warn("[ATTENDANCE_SYNC] Permanent punch rejection:", message);
      } else {
        await returnAttendanceEventToPending(event.id, message);

        console.warn(
          "[ATTENDANCE_SYNC] Temporary sync failure; event remains retryable:",
          message,
        );
      }

      // Preserve queue order.
      // Resolve this event before processing later punches.
      break;
    }
  }

  return syncedCount;
}

/**
 * Sync attendance events in insertion order.
 * Concurrent callers for the same employee share one sync operation.
 */
export function syncPendingAttendanceEvents(
  employeeId: number,
  token: string,
): Promise<number> {
  const active = activeSyncs.get(employeeId);

  if (active) {
    return active;
  }

  const operation = performAttendanceSync(employeeId, token);
  activeSyncs.set(employeeId, operation);

  void operation
    .finally(() => {
      if (activeSyncs.get(employeeId) === operation) {
        activeSyncs.delete(employeeId);
      }
    })
    .catch(() => {
      // The original caller receives the failure.
    });

  return operation;
}
