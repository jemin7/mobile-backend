import { useEffect, type ComponentProps } from "react";
import { Tabs, type ErrorBoundaryProps } from "expo-router";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { logDiagnosticEvent } from "../../location/diagnosticLog";
import { useTheme } from "../../theme/ThemeProvider";
import CustomTabBar from "../../components/CustomTabBar";

function TabScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();

  useEffect(() => {
    void logDiagnosticEvent({
      level: "ERROR",
      source: "TabsLayout",
      event: "TAB_SCREEN_RENDER_ERROR",
      message: error.message || "A tab screen failed to render.",
      details: {
        errorName: error.name,
        stack:
          typeof error.stack === "string" ? error.stack.slice(0, 3000) : null,
      },
    }).catch((logError) => {
      console.warn(
        "[HRMS_TAB_ERROR_LOG_FAILURE]",
        logError instanceof Error ? logError.name : typeof logError,
      );
    });
  }, [error]);

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={{
        flex: 1,
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.background,
      }}
    >
      <Text
        style={{
          fontSize: 21,
          fontWeight: "700",
          color: colors.textPrimary,
        }}
      >
        This screen could not open
      </Text>

      <Text
        selectable
        style={{
          marginTop: 12,
          color: colors.textSecondary,
        }}
      >
        {error.message}
      </Text>

      {error.stack ? (
        <Text
          selectable
          style={{
            marginTop: 12,
            fontSize: 12,
            color: colors.textSecondary,
          }}
        >
          {error.stack.slice(0, 3000)}
        </Text>
      ) : null}

      <Pressable
        onPress={() => void retry()}
        accessibilityRole="button"
        style={{ marginTop: 24, paddingVertical: 12 }}
      >
        <Text
          style={{
            color: colors.primary,
            fontWeight: "700",
          }}
        >
          Try again
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

export const unstable_settings = {
  anchor: "index",
  screenErrorBoundary: TabScreenErrorBoundary,
};

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      tabBar={(props) => (
        <CustomTabBar
          {...(props as unknown as ComponentProps<typeof CustomTabBar>)}
        />
      )}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="attendance"
        options={{
          title: "Attendance",
        }}
      />
      <Tabs.Screen name="leave" />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chat",
        }}
      />
      <Tabs.Screen name="tasks" />
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
        }}
      />

      <Tabs.Screen name="reimbursement" />

      <Tabs.Screen
        name="holidays"
        options={{
          title: "Holidays",
        }}
      />
      <Tabs.Screen name="calendar" />

      <Tabs.Screen
        name="loan"
        options={{
          title: "Loan",
        }}
      />
      <Tabs.Screen
        name="payout"
        options={{
          title: "Payout",
        }}
      />
    </Tabs>
  );
}
