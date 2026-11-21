import { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { AppText as Text } from "./InterTypography";
import { useTheme } from "../theme/ThemeProvider";
import { getMonotonicTimeMs } from "../location/monotonicClock";
import { getTrustedClockSnapshot } from "../location/serverTime";

const INDIA_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const CLOCK_REFRESH_RETRY_MS = 5000;

function formatIndiaTime(utcMs: number): string {
  const date = new Date(utcMs + INDIA_OFFSET_MS);
  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())}`
  );
}

export default function LiveClock() {
  const { colors } = useTheme();
  const [currentTime, setCurrentTime] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let refreshing = false;
    let lastRefreshMonotonicMs = -Infinity;

    let anchor: Awaited<ReturnType<typeof getTrustedClockSnapshot>> | null =
      null;

    async function refreshAnchor() {
      if (cancelled || refreshing) {
        return;
      }

      refreshing = true;

      try {
        lastRefreshMonotonicMs = getMonotonicTimeMs();

        const snapshot = await getTrustedClockSnapshot();

        if (cancelled) {
          return;
        }

        anchor = snapshot;

        setCurrentTime(formatIndiaTime(snapshot.trustedUtcMs));
      } catch {
        // No trusted anchor yet. The tick below shows the device clock
        // while retries continue; punches never use the device clock.
        anchor = null;
      } finally {
        refreshing = false;
      }
    }

    function tick() {
      if (cancelled) {
        return;
      }

      try {
        const monotonicNow = getMonotonicTimeMs();

        if (anchor) {
          const elapsedMs = monotonicNow - anchor.monotonicTime;

          if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
            anchor = null;
            setCurrentTime(null);
            void refreshAnchor();
            return;
          }

          setCurrentTime(formatIndiaTime(anchor.trustedUtcMs + elapsedMs));
          return;
        }

        // ponytail: cosmetic device-clock fallback while the trusted
        // server-time anchor is unavailable; attendance punches stay
        // anchored to server time.
        setCurrentTime(formatIndiaTime(Date.now()));

        // Retry periodically until a trusted server-time anchor exists.
        if (monotonicNow - lastRefreshMonotonicMs >= CLOCK_REFRESH_RETRY_MS) {
          void refreshAnchor();
        }
      } catch {
        anchor = null;
        setCurrentTime(formatIndiaTime(Date.now()));
      }
    }

    void refreshAnchor();

    const timer = setInterval(tick, 1000);

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void refreshAnchor();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={[styles.clock, { color: colors.textPrimary }]}>
        {currentTime ?? "--:--:--"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  clock: {
    textAlign: "center",
    fontSize: 35,
    lineHeight: 48,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
