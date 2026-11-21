import React from "react";
import { act } from "react";
import { createRoot, type TestInstance } from "test-renderer";

jest.mock("../../theme/ThemeProvider", () => ({
  useTheme: () => ({ colors: { textPrimary: "#111111" } }),
}));

jest.mock("../../location/serverTime", () => ({
  getTrustedClockSnapshot: jest.fn(),
}));

jest.mock("../../location/monotonicClock", () => ({
  getMonotonicTimeMs: jest.fn(),
}));

import LiveClock from "../LiveClock";
import * as monotonicClock from "../../location/monotonicClock";
import * as serverTime from "../../location/serverTime";

const monotonicMock = monotonicClock.getMonotonicTimeMs as jest.Mock;
const snapshotMock = serverTime.getTrustedClockSnapshot as jest.Mock;

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Same formatting rules as LiveClock.formatIndiaTime, re-implemented
// independently for the expectations.
function expectedIndiaClock(utcMs: number): string {
  const date = new Date(utcMs + INDIA_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${pad(date.getUTCHours())}:` + `${pad(date.getUTCMinutes())}:` + `${pad(date.getUTCSeconds())}`
  );
}

function isHostText(instance: TestInstance): boolean {
  return typeof instance.type === "string" && typeof instance.children?.[0] === "string";
}

function getClockText(root: { container: TestInstance }): string {
  const nodes = root.container.queryAll(isHostText);

  for (const node of nodes) {
    const text = String(node.children[0]);
    if (/^\d{2}:\d{2}:\d{2}$/.test(text) || text === "--:--:--") {
      return text;
    }
  }

  return "(no clock text)";
}

describe("LiveClock", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-01T05:30:00Z"));
    monotonicMock.mockReturnValue(0);
    snapshotMock.mockRejectedValue(new Error("no anchor yet"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function renderClock() {
    await act(async () => {
      await Promise.resolve();
    });

    const root = createRoot({ textComponentTypes: ["Text"] });

    await act(async () => {
      root.render((<LiveClock />) as unknown as React.ReactElement);
      await Promise.resolve();
    });

    return root;
  }

  it("shows the untrusted placeholder before any tick", async () => {
    const root = await renderClock();

    expect(getClockText(root)).toBe("--:--:--");
  });

  it("falls back to the device clock while no trusted anchor is available", async () => {
    monotonicMock.mockReturnValue(100);
    const root = await renderClock();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(getClockText(root)).toBe(expectedIndiaClock(Date.now()));
  });

  it("displays trusted server time once the anchor exists", async () => {
    const anchorTrustedUtcMs = Date.UTC(2026, 0, 1, 0, 0, 0);

    snapshotMock.mockResolvedValue({
      trustedUtcMs: anchorTrustedUtcMs,
      indiaWallClock: "00:00:00",
      monotonicTime: 100,
      bootCount: 1,
    });
    monotonicMock.mockReturnValue(100);

    const root = await renderClock();

    // 2 seconds of elapsed monotonic time.
    monotonicMock.mockReturnValue(300);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });

    expect(getClockText(root)).toBe(expectedIndiaClock(anchorTrustedUtcMs + 200));
  });

  it("drops the anchor and retries when the monotonic clock moves backwards", async () => {
    const anchorTrustedUtcMs = Date.UTC(2026, 0, 1, 0, 0, 0);

    snapshotMock.mockResolvedValue({
      trustedUtcMs: anchorTrustedUtcMs,
      indiaWallClock: "00:00:00",
      monotonicTime: 100,
      bootCount: 1,
    });

    monotonicMock.mockReturnValue(100);

    const root = await renderClock();

    monotonicMock.mockReturnValue(300);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });

    expect(getClockText(root)).toBe(expectedIndiaClock(anchorTrustedUtcMs + 200));

    // Monotonic clock goes backwards: anchor must be invalidated and, because
    // the retry re-sync then fails, the display must reset to the placeholder.
    monotonicMock.mockReturnValueOnce(50);
    snapshotMock.mockRejectedValueOnce(new Error("re-sync failed"));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(getClockText(root)).toBe("--:--:--");
  });
});
