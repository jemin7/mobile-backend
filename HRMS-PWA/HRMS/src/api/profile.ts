import { apiRequest, apiUploadFile } from "./client";
export type EmployeeProfile = {
  id: number;
  employeeID?: string | null;
  employeePhotoUrl?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  businessEmail?: string | null;
  personalEmail?: string | null;
  businessPhoneNo?: string | null;
  personalPhoneNo?: string | null;
  branch?: string | null;
  department?: string | null;
  designation?: string | null;
};



export async function getEmployeeProfile(
  token: string | null,
): Promise<EmployeeProfile> {
  return apiRequest<EmployeeProfile>("/api/mobile/v1/profile/me", {
    method: "GET",
    token,
  });
}

export function getEmployeePhotoUri(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;

  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

  if (!apiUrl) return null;

  return `${apiUrl}${photoUrl.startsWith("/") ? photoUrl : `/${photoUrl}`}`;
}

export async function uploadEmployeeProfilePhoto(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string;
  },
  token: string | null,
): Promise<string> {
  if (!token) {
    throw new Error("Please sign in to update your profile photo.");
  }

  const extension = asset.fileName?.split(".").pop()?.toLowerCase();

  const mimeType = asset.mimeType?.startsWith("image/")
    ? asset.mimeType
    : extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "heic"
          ? "image/heic"
          : "image/jpeg";

  const updated = await apiUploadFile<{ employeePhotoUrl: string }>(
    "/api/mobile/v1/profile/photo",
    asset.uri,
    {
      token,
      fieldName: "file",
      fileName: asset.fileName ?? undefined,
      mimeType,
    },
  );

  if (!updated.employeePhotoUrl?.startsWith("/uploads/")) {
    throw new Error("The server did not return a valid profile photo URL.");
  }

  return updated.employeePhotoUrl;
}



