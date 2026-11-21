// import Constants from "expo-constants";
// import * as Notifications from "expo-notifications";
// import { AndroidImportance } from "expo-notifications";
// import { Platform } from "react-native";

// import { apiRequest } from "../api/client";

// type RegistrationResponse = {
//   success: boolean;
//   employeeID: number;
// };

// export async function registerMobilePushToken(accessToken: string): Promise<void> {
//   if (Platform.OS !== "android" && Platform.OS !== "ios") {
//     return;
//   }

//   if (!accessToken.trim()) {
//     return;
//   }

//   try {
//     // Create the general notification channel on Android.
//     if (Platform.OS === "android") {
//       await Notifications.setNotificationChannelAsync("default", {
//         name: "General notifications",
//         importance: AndroidImportance.MAX,
//         vibrationPattern: [0, 250, 250, 250],
//         lightColor: "#2563EB",
//       });
//     }

//     // Check notification permission before obtaining a push token.
//     let permissionStatus = (await Notifications.getPermissionsAsync()).status;

//     if (permissionStatus !== "granted") {
//       permissionStatus = (await Notifications.requestPermissionsAsync()).status;
//     }

//     if (permissionStatus !== "granted") {
//       console.warn("Mobile push registration skipped: notification permission denied.");
//       return;
//     }

//     const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

//     if (!projectId) {
//       console.warn("Mobile push registration failed: EAS project ID is missing.");
//       return;
//     }

//     const expoPushToken = (
//       await Notifications.getExpoPushTokenAsync({
//         projectId,
//       })
//     ).data;

//     await apiRequest<RegistrationResponse>("/push-notifications/mobile/register", {
//       method: "POST",
//       token: accessToken,
//       body: JSON.stringify({
//         expoPushToken,
//         platform: Platform.OS,
//       }),
//     });

//     console.info("Mobile push token registered successfully.");
//   } catch (error) {
//     // Push registration failure must not prevent normal app usage.
//     console.warn("Mobile push token registration failed:", error);
//   }
// }

