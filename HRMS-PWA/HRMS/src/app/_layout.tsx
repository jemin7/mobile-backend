import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from "@tanstack/react-query";
import { AppState, Platform } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect, useRef } from "react";

import { AuthProvider, useAuth } from "../auth/AuthProvider";
import { PERSISTED_QUERY_CACHE_MAX_AGE_MS } from "../queryCachePersister";
import { ThemeProvider, useTheme } from "../theme/ThemeProvider";

import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { useLocationSyncLifecycle } from "../location/useLocationSyncLifecycle";

import * as Notifications from "expo-notifications";

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from "@expo-google-fonts/inter";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

const persistedQueryKeys = [
  ["holidays"],
  ["employee-weekly-off"],
  ["task-customers"],
  ["task-customer-sites"],
] as const;

for (const queryKey of persistedQueryKeys) {
  queryClient.setQueryDefaults(queryKey, {
    gcTime: PERSISTED_QUERY_CACHE_MAX_AGE_MS,
  });
}

onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(state.isConnected === true);
  }),
);

function AppLayout() {
  const { theme } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  useLocationSyncLifecycle();

  const segments = useSegments();
  const router = useRouter();

  const handledNotificationIds = useRef(new Set<string>());

  useEffect(() => {
    let disposed = false;

    function readValue(...values: unknown[]): string | undefined {
      for (const value of values) {
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }

        if (
          typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value > 0
        ) {
          return String(value);
        }
      }

      return undefined;
    }

    function handleNotificationResponse(
      response: Notifications.NotificationResponse,
    ) {
      if (
        response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        return;
      }

      const notification = response.notification;
      const notificationId = notification.request.identifier;

      if (handledNotificationIds.current.has(notificationId)) {
        return;
      }

      handledNotificationIds.current.add(notificationId);

      const rawData = notification.request.content.data;
      const data =
        rawData && typeof rawData === "object"
          ? (rawData as Record<string, unknown>)
          : {};

      const kind = (readValue(data.kind) ?? "").toLowerCase();
      const url = readValue(data.url, data.href) ?? "";
      const lowerUrl = url.toLowerCase();

      const messageId = readValue(data.memoId, data.messageId);
      const leaveId = readValue(
        data.leaveId,
        data.leaveApplicationId,
        data.requestId,
      );
      const reimbursementId = readValue(
        data.reimbursementId,
        data.claimId,
        data.requestId,
      );

      if (
        kind === "memo" ||
        /\/chat(?:\/|[?#]|$)|[?&]tab=messaging|employee[-_]?memo/.test(lowerUrl)
      ) {
        if (messageId) {
          router.push({
            pathname: "/(tabs)/chat",
            params: { messageId },
          });
        } else {
          router.push("/(tabs)/chat");
        }
      } else if (
        kind === "leave" ||
        /empleaveapplication|leave-details/.test(lowerUrl)
      ) {
        if (leaveId) {
          router.push({
            pathname: "/leave-details",
            params: { id: leaveId },
          });
        } else {
          router.push("/(tabs)/leave");
        }
      } else if (
        kind === "reimbursement" ||
        /empreimbursement|reimburse|expense/.test(lowerUrl)
      ) {
        if (reimbursementId) {
          router.push({
            pathname: "/reimbursement-details",
            params: { id: reimbursementId },
          });
        } else {
          router.push("/(tabs)/reimbursement");
        }
      } else if (
        kind === "payslip" ||
        /payslip|salary|payout|payroll/.test(lowerUrl)
      ) {
        router.push("/(tabs)/payout");
      } else if (kind === "task" || /task|empmytasks/.test(lowerUrl)) {
        router.push("/tasks");
      } else if (kind === "holiday" || /holiday|calendar/.test(lowerUrl)) {
      } else {
        router.push("/notifications");
      }

      // Remove only the notification the user tapped.
      void Notifications.dismissNotificationAsync(notificationId).catch(
        (error) => {
          console.warn("Could not dismiss tapped notification:", error);
        },
      );

      void Notifications.clearLastNotificationResponseAsync().catch((error) => {
        console.warn("Could not clear the last notification response:", error);
      });
    }

    const subscription = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Handle a notification that launched the app from a closed state.
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!disposed && response) {
          handleNotificationResponse(response);
        }
      })
      .catch((error) => {
        console.warn(
          "Could not read the initial notification response:",
          error,
        );
      });

    return () => {
      disposed = true;
      subscription.remove();
    };
  }, [router]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    if (!isAuthenticated && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (isAuthenticated && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading, segments, router]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style={theme === "dark" ? "light" : "dark"} />

      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />

        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="attendance-history"
          options={{ headerShown: false }}
        />

        <Stack.Screen name="payslip/[id]" options={{ headerShown: false }} />

        <Stack.Screen name="profile" options={{ headerShown: false }} />

        <Stack.Screen
          name="task-details"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme === "dark" ? "#0F1115" : "#F7F8FA",
            },
          }}
        />
        <Stack.Screen
          name="create-task"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme === "dark" ? "#0F1115" : "#F7F8FA",
            },
          }}
        />

        <Stack.Screen
          name="task-chat"
          options={{
            headerShown: false,
            contentStyle: {
              backgroundColor: theme === "dark" ? "#0F1115" : "#F7F8FA",
            },
          }}
        />
        <Stack.Screen
          name="my-team/[category]"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="my-team/employee/[id]"
          options={{ headerShown: false }}
        />

        <Stack.Screen name="my-team" options={{ headerShown: false }} />

        <Stack.Screen name="approvals" options={{ headerShown: false }} />
        <Stack.Screen name="manager-roster" options={{ headerShown: false }} />

        <Stack.Screen name="my-reportees" options={{ headerShown: false }} />

        <Stack.Screen
          name="my-reportees/[category]"
          options={{ headerShown: false }}
        />

        <Stack.Screen name="notifications" options={{ headerShown: false }} />

        <Stack.Screen name="leave-details" options={{ headerShown: false }} />

        <Stack.Screen
          name="reimbursement-details"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="edit-reimbursement"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="new-leave-request"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="new-reimbursement"
          options={{ headerShown: false }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    focusManager.setFocused(AppState.currentState === "active");

    const subscription = AppState.addEventListener("change", (status) => {
      focusManager.setFocused(status === "active");
    });

    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <AppLayout />
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
