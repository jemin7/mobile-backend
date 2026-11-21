import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "../../api/client";
import * as monotonicClock from "../monotonicClock";
import { getStoredServerTimeAnchor, getTrustedClockSnapshot, syncServerTime } from "../serverTime";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock("../../api/client", () => ({
  apiRequest: jest.fn(),
}));

jest.mock("../monotonicClock", () => ({
  getMonotonicTimeMs: jest.fn(),
  getBootCount: jest.fn(),
  getMonotonicClockSnapshot: jest.fn(),
}));

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Same formatting rules as serverTime.formatIndiaWallClock, re-implemented
// here to keep the expectation independent from the implementation.
function expectedIndiaWallClock(utcMs: number): string {
  const date = new Date(utcMs + IST_OFFSET_MS);
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

const getItemMock = AsyncStorage.getItem as jest.Mock;
const setItemMock = AsyncStorage.setItem as jest.Mock;
const monotonicMock = monotonicClock.getMonotonicTimeMs as jest.Mock;
const bootCountMock = monotonicClock.getBootCount as jest.Mock;
const apiRequestMock = apiRequest as jest.Mock;

describe("serverTime.trusted clock", () => {
  let storedValue: string | null = null;

  beforeEach(() => {
    storedValue = null;
    getItemMock.mockImplementation(async () => storedValue);
    bootCountMock.mockReturnValue(42);
  });

  describe("syncServerTime", () => {
    it("stores an anchor offset halfway through the request round-trip", async () => {
      apiRequestMock.mockResolvedValue({ serverUtcMs: 1_000_000 });
      monotonicMock.mockReturnValueOnce(100).mockReturnValueOnce(160);

      const anchor = await syncServerTime("token");

      expect(anchor.serverUtcMs).toBe(1_000_030);
      expect(anchor.syncedAtMonotonicMs).toBe(160);
      expect(anchor.bootCount).toBe(42);

      expect(JSON.parse(setItemMock.mock.calls[0][1])).toEqual({
        serverUtcMs: 1_000_030,
        syncedAtMonotonicMs: 160,
        bootCount: 42,
      });
    });

    it("rejects an empty token", async () => {
      await expect(syncServerTime("   ")).rejects.toThrow(
        "Authentication is required to synchronize server time.",
      );
    });

    it("rejects when the monotonic clock goes backwards during the request", async () => {
      apiRequestMock.mockResolvedValue({ serverUtcMs: 1_000_000 });
      monotonicMock.mockReturnValueOnce(200).mockReturnValueOnce(100);

      await expect(syncServerTime("token")).rejects.toThrow(
        "The monotonic clock changed unexpectedly.",
      );
    });

    it("rejects when the boot counter is unavailable", async () => {
      apiRequestMock.mockResolvedValue({ serverUtcMs: 1_000_000 });
      monotonicMock.mockReturnValue(100);
      bootCountMock.mockReturnValue(null);

      await expect(syncServerTime("token")).rejects.toThrow(
        "The Android boot counter is unavailable.",
      );
    });

    it("rejects an invalid server time response", async () => {
      apiRequestMock.mockResolvedValue({ serverUtcMs: -5 });
      monotonicMock.mockReturnValue(100);

      await expect(syncServerTime("token")).rejects.toThrow("The server returned an invalid time.");
    });
  });

  describe("getStoredServerTimeAnchor", () => {
    it("returns null when nothing is stored", async () => {
      await expect(getStoredServerTimeAnchor()).resolves.toBeNull();
    });

    it("rejects malformed stored JSON", async () => {
      storedValue = "{not json";
      await expect(getStoredServerTimeAnchor()).resolves.toBeNull();
    });

    it("rejects stored values with missing or wrong-typed fields", async () => {
      storedValue = JSON.stringify({ serverUtcMs: "x", syncedAtMonotonicMs: 5, bootCount: 0 });
      await expect(getStoredServerTimeAnchor()).resolves.toBeNull();
    });

    it("returns a complete valid anchor", async () => {
      storedValue = JSON.stringify({
        serverUtcMs: 1_000_030,
        syncedAtMonotonicMs: 160,
        bootCount: 42,
      });

      await expect(getStoredServerTimeAnchor()).resolves.toEqual({
        serverUtcMs: 1_000_030,
        syncedAtMonotonicMs: 160,
        bootCount: 42,
      });
    });
  });

  describe("getTrustedClockSnapshot", () => {
    const VALID_ANCHOR = {
      serverUtcMs: 1_000_030,
      syncedAtMonotonicMs: 160,
      bootCount: 42,
    };

    beforeEach(() => {
      setItemMock.mockResolvedValue(undefined);
    });

    it("throws when no anchor has been synced yet", async () => {
      await expect(getTrustedClockSnapshot()).rejects.toThrow(
        "Trusted server time is not available.",
      );
    });

    it("detects a reboot and refuses to interpolate", async () => {
      storedValue = JSON.stringify(VALID_ANCHOR);
      bootCountMock.mockReturnValue(43);

      await expect(getTrustedClockSnapshot()).rejects.toThrow("The phone may have rebooted.");
    });

    it("detects a nonsensical monotonic reading", async () => {
      storedValue = JSON.stringify(VALID_ANCHOR);
      monotonicMock.mockReturnValue(100); // label anchor was taken at monotonic 160

      await expect(getTrustedClockSnapshot()).rejects.toThrow("Trusted clock state is invalid.");
    });

    it("interpolates trusted time from the anchor and the monotonic clock", async () => {
      storedValue = JSON.stringify(VALID_ANCHOR);
      monotonicMock.mockReturnValue(300);

      const snapshot = await getTrustedClockSnapshot();

      expect(snapshot.trustedUtcMs).toBe(1_000_170); // 1_000_030 + (300 - 160)
      expect(snapshot.monotonicTime).toBe(300);
      expect(snapshot.bootCount).toBe(42);
      expect(snapshot.indiaWallClock).toBe(expectedIndiaWallClock(1_000_170));
    });
  });
});
