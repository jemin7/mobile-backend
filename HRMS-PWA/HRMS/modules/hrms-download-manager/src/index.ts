import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";

type HrmsDownloadManagerNativeModule = {
  downloadPdf(url: string, fileName: string, token: string): Promise<string>;
};

const nativeModule =
  requireOptionalNativeModule<HrmsDownloadManagerNativeModule>(
    "HrmsDownloadManager",
  );

export async function downloadPdfToPublicDownloads(
  url: string,
  fileName: string,
  token: string,
): Promise<string> {
  if (Platform.OS !== "android") {
    throw new Error("Direct Downloads is supported only on Android.");
  }

  if (!nativeModule) {
    throw new Error(
      "The Android download module is unavailable. Install an EN-Time HR development build; Expo Go does not include this module.",
    );
  }

  if (!token.trim()) {
    throw new Error("Please sign in to download your payslip.");
  }

  return nativeModule.downloadPdf(url, fileName, token);
}
