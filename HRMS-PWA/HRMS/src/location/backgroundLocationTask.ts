import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

export const LOCATION_TASK_NAME = "HRMS_BACKGROUND_LOCATION_TASK";

/**
 * Legacy migration handler.
 *
 * Never collect, save or upload GPS points.
 * Stop the previously registered background location service.
 */
TaskManager.defineTask(LOCATION_TASK_NAME, async () => {
  try {
    const isTracking =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);

    if (isTracking) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }

    console.log("[HRMS_LOCATION] Legacy background location task stopped.");
  } catch (error) {
    console.warn(
      "[HRMS_LOCATION] Legacy background task shutdown failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
});
