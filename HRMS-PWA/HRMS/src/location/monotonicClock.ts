import HrmsMonotonicClock from "../../modules/hrms-monotonic-clock/src/HrmsMonotonicClockModule";
import { Platform } from "react-native";

export type MonotonicClockSnapshot = {
  monotonicMs: number;
  wallClockMs: number;
};

/**
 * Reads elapsed time from the platform's monotonic clock.
 * This value is not affected by manual changes to the device clock.
 */
export function getMonotonicTimeMs(): number {
  const monotonicMs = HrmsMonotonicClock.getMonotonicTimeMs();

  if (!Number.isFinite(monotonicMs) || monotonicMs < 0) {
    throw new Error("The monotonic clock returned an invalid value.");
  }

  return monotonicMs;
}

export function getBootCount(): number | null {
  // The native boot counter is available only on Android.
  if (Platform.OS !== "android") {
    return null;
  }

  const bootCount = HrmsMonotonicClock.getBootCount();

  if (!Number.isSafeInteger(bootCount) || bootCount < 0) {
    return null;
  }

  return bootCount;
}

/**
 * Takes a near-simultaneous monotonic and wall-clock snapshot.
 * The wall-clock value is an initial time anchor; elapsed durations
 * should be calculated using monotonicMs, not Date.now().
 */
export function getMonotonicClockSnapshot(): MonotonicClockSnapshot {
  const wallBefore = Date.now();
  const monotonicMs = getMonotonicTimeMs();
  const wallAfter = Date.now();

  return {
    monotonicMs,
    wallClockMs: Math.round((wallBefore + wallAfter) / 2),
  };
}
