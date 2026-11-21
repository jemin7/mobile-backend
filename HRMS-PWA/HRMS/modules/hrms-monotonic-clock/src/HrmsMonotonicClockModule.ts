import { requireOptionalNativeModule } from "expo-modules-core";

type HrmsMonotonicClockNativeModule = {
  getMonotonicTimeMs(): number;
  getBootCount(): number;
};

// Expo Go does not include our custom native module.
// The fallback is only suitable for UI/navigation testing.
const nativeModule =
  requireOptionalNativeModule<HrmsMonotonicClockNativeModule>(
    "HrmsMonotonicClock",
  );

const fallbackClock: HrmsMonotonicClockNativeModule = {
  getMonotonicTimeMs: () => {
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      return performance.now();
    }

    return Date.now();
  },

  // A missing boot counter must never be treated as trusted.
  getBootCount: () => -1,
};

export default nativeModule ?? fallbackClock;
