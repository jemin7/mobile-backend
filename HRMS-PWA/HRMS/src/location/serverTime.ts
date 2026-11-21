  import AsyncStorage from "@react-native-async-storage/async-storage";
  import { apiRequest } from "../api/client";
  import { getBootCount, getMonotonicTimeMs } from "./monotonicClock";

  const SERVER_TIME_ANCHOR_KEY = "hrmsServerTimeAnchorV1";
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  export type ServerTimeAnchor = {
    serverUtcMs: number;
    syncedAtMonotonicMs: number;
    bootCount: number;
    timeProof: string;
  };

  export type TrustedPunchTime = {
    punchTime: string;
    monotonicTime: number;
    bootCount: number;
    timeProof: string;
  };

  export type TrustedClockSnapshot = {
    trustedUtcMs: number;
    indiaWallClock: string;
    monotonicTime: number;
    bootCount: number;
    timeProof: string;
  };

  /**
   * Format a trusted server-derived timestamp as the India wall-clock
   * format expected by the current backend.
   *
   * The phone's current wall clock is not used.
   */
  function formatIndiaWallClock(serverUtcMs: number): string {
    const date = new Date(serverUtcMs + IST_OFFSET_MS);

    const pad = (value: number) => String(value).padStart(2, "0");

    return (
      `${date.getUTCFullYear()}-` +
      `${pad(date.getUTCMonth() + 1)}-` +
      `${pad(date.getUTCDate())} ` +
      `${pad(date.getUTCHours())}:` +
      `${pad(date.getUTCMinutes())}:` +
      `${pad(date.getUTCSeconds())}`
    );
  }

  /**
   * Synchronize server time with the monotonic clock.
   * Call this when the user is authenticated and a network is available.
   */
  export async function syncServerTime(token: string): Promise<ServerTimeAnchor> {
    if (!token.trim()) {
      throw new Error("Authentication is required to synchronize server time.");
    }

    const startMonotonicMs = getMonotonicTimeMs();

    const response = await apiRequest<{
      serverUtcMs: number;
      timeProof: string;
    }>("/api/mobile/v1/attendance/server-time", {
      method: "GET",
      token,
    });

    const endMonotonicMs = getMonotonicTimeMs();

    if (
      !Number.isFinite(response.serverUtcMs) ||
      response.serverUtcMs <= 0 ||
      typeof response.timeProof !== "string" ||
      !response.timeProof.trim()
    ) {
      throw new Error("The server returned an invalid time.");
    }

    if (endMonotonicMs < startMonotonicMs) {
      throw new Error("The monotonic clock changed unexpectedly.");
    }

    const bootCount = getBootCount();

    if (bootCount === null) {
      throw new Error(
        "The Android boot counter is unavailable. Trusted offline time cannot be established.",
      );
    }

    // Estimate the server time near the end of the network request.
    const roundTripMs = endMonotonicMs - startMonotonicMs;

    const anchor: ServerTimeAnchor = {
      serverUtcMs: response.serverUtcMs + roundTripMs / 2,
      syncedAtMonotonicMs: endMonotonicMs,
      bootCount,
      timeProof: response.timeProof,
    };

    await AsyncStorage.setItem(SERVER_TIME_ANCHOR_KEY, JSON.stringify(anchor));

    return anchor;
  }

  /**
   * Retrieve a saved anchor, rejecting malformed stored data.
   */
 export async function getStoredServerTimeAnchor(): Promise<ServerTimeAnchor | null> {
   const stored = await AsyncStorage.getItem(SERVER_TIME_ANCHOR_KEY);

   if (!stored) {
     return null;
   }

   try {
     const value: unknown = JSON.parse(stored);

     if (typeof value !== "object" || value === null) {
       return null;
     }

     const anchor = value as Partial<ServerTimeAnchor>;

     if (
       !Number.isFinite(anchor.serverUtcMs) ||
       !Number.isFinite(anchor.syncedAtMonotonicMs) ||
       !Number.isSafeInteger(anchor.bootCount) ||
       (anchor.serverUtcMs ?? 0) <= 0 ||
       (anchor.syncedAtMonotonicMs ?? -1) < 0 ||
       (anchor.bootCount ?? -1) < 0 ||
       typeof anchor.timeProof !== "string" ||
       !anchor.timeProof.trim()
     ) {
       return null;
     }

     return anchor as ServerTimeAnchor;
   } catch {
     return null;
   }
 }
  /**
   * Calculate an attendance time from the trusted server anchor.
   * This does not read Date.now() or the phone's wall clock.
   */

  /**
   * Get the current trusted time using the server anchor and monotonic clock.
   * Never uses the phone's wall clock.
   */
  export async function getTrustedClockSnapshot(): Promise<TrustedClockSnapshot> {
    const anchor = await getStoredServerTimeAnchor();
    

    if (!anchor) {
      throw new Error(
        "Trusted server time is not available. Connect to the internet before punching.",
      );
    }

    const currentBootCount = getBootCount();

    if (currentBootCount === null || currentBootCount !== anchor.bootCount) {
      throw new Error(
        "The phone may have rebooted. Connect to the internet to synchronize time.",
      );
    }

    const currentMonotonicMs = getMonotonicTimeMs();
    const elapsedMs = currentMonotonicMs - anchor.syncedAtMonotonicMs;

    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
      throw new Error(
        "Trusted clock state is invalid. Synchronize with the server again.",
      );
    }

    const trustedUtcMs = anchor.serverUtcMs + elapsedMs;

    return {
      trustedUtcMs,
      indiaWallClock: formatIndiaWallClock(trustedUtcMs),
      monotonicTime: currentMonotonicMs,
      bootCount: currentBootCount,
      timeProof: anchor.timeProof,
    };
  }

  /**
   * Get a trusted attendance punch time.
   */
  export async function getTrustedPunchTime(): Promise<TrustedPunchTime> {
    const snapshot = await getTrustedClockSnapshot();

    return {
      punchTime: snapshot.indiaWallClock,
      monotonicTime: snapshot.monotonicTime,
      bootCount: snapshot.bootCount,
          timeProof: snapshot.timeProof,
    };
  }
