import { Platform } from "react-native";
import { File, UploadType } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function getApiMessage(data: unknown, fallback: string) {
  if (typeof data === "object" && data !== null && "message" in data) {
    const message = (data as { message?: unknown }).message;

    if (Array.isArray(message)) {
      return message.filter(Boolean).join(", ");
    }

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}

type RequestOptions = RequestInit & {
  token?: string | null;
  skipAuth?: boolean;
};

type MobileAuthHandlers = {
  getAccessToken: () => string | null;
  refresh: () => Promise<string>;
  onSessionExpired: () => Promise<void>;
};

let mobileAuthHandlers: MobileAuthHandlers | null = null;
let refreshPromise: Promise<string> | null = null;

export function configureMobileAuth(handlers: MobileAuthHandlers | null) {
  mobileAuthHandlers = handlers;

  if (!handlers) {
    refreshPromise = null;
  }
}

async function refreshAfterUnauthorized(
  failedToken: string,
): Promise<string | null> {
  const handlers = mobileAuthHandlers;
  if (!handlers) return null;

  const latestToken = handlers.getAccessToken();

  if (latestToken && latestToken !== failedToken) {
    return latestToken;
  }

  if (!refreshPromise) {
    refreshPromise = handlers
      .refresh()
      .catch(async (error) => {
        if (error instanceof ApiError && error.status === 401) {
          await handlers.onSessionExpired();
        }

        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }


  const { token, headers, skipAuth, ...rest } = options;

  const currentToken = skipAuth
    ? null
    : mobileAuthHandlers
      ? mobileAuthHandlers.getAccessToken()
      : (token ?? null);

  const buildHeaders = (authToken: string | null) => {
    const requestHeaders = new Headers(headers);

    requestHeaders.set("Accept", "application/json");

    if (!(rest.body instanceof FormData)) {
      requestHeaders.set("Content-Type", "application/json");
    }

    if (authToken) {
      requestHeaders.set("Authorization", `Bearer ${authToken}`);
    }

    return requestHeaders;
  };

  const sendRequest = (authToken: string | null) =>
    fetch(`${API_URL}${path}`, {
      ...rest,
      headers: buildHeaders(authToken),
    });

  let response = await sendRequest(currentToken);

  if (response.status === 401 && currentToken && !skipAuth) {
    const newToken = await refreshAfterUnauthorized(currentToken);

    if (newToken && newToken !== currentToken) {
      response = await sendRequest(newToken);
    }
  }

  const contentType = response.headers.get("content-type") ?? "";

  let data: unknown;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();
    data = text || null;
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getApiMessage(data, `Request failed with status ${response.status}.`),
      data,
    );
  }

  return data as T;
}

export async function apiUploadFile<T>(
  path: string,
  fileUri: string,
  options: {
    token: string | null;
    mimeType?: string;
    fieldName?: string;
    fileName?: string;
  },
): Promise<T> {
  if (!API_URL) throw new Error("EXPO_PUBLIC_API_URL is not configured.");


  const currentToken = mobileAuthHandlers
    ? mobileAuthHandlers.getAccessToken()
    : options.token;

  if (!currentToken) {
    throw new Error("Please sign in to upload this file.");
  }

  const requestPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_URL}${requestPath}`;

  const fileName = (
    options.fileName ||
    fileUri.split("/").pop() ||
    "attachment"
  ).replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");

  const fieldName = options.fieldName ?? "file";

  const sendUpload = async (authToken: string) => {
    if (Platform.OS === "web") {
      const fileResponse = await fetch(fileUri);

      if (!fileResponse.ok) {
        throw new Error("Unable to read the selected file.");
      }

      const blob = await fileResponse.blob();
      const formData = new FormData();

      formData.append(fieldName, blob, fileName);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: formData,
      });

      const contentType = response.headers.get("content-type") ?? "";
      const data: unknown = contentType.includes("application/json")
        ? await response.json()
        : await response.text();

      return { status: response.status, data };
    }

    const file = new File(fileUri);

    if (!file.exists) {
      throw new Error("Selected file is unavailable. Please select it again.");
    }

    const uploadResult = await file.upload(url, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName,
      mimeType: options.mimeType || file.type || "application/octet-stream",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
      },
    });

    let data: unknown = null;

    try {
      data = uploadResult.body ? JSON.parse(uploadResult.body) : null;
    } catch {
      data = uploadResult.body || null;
    }

    return { status: uploadResult.status, data };
  };

  let result = await sendUpload(currentToken);

  if (result.status === 401) {
    const refreshedToken = await refreshAfterUnauthorized(currentToken);

    if (refreshedToken && refreshedToken !== currentToken) {
      result = await sendUpload(refreshedToken);
    }
  }

  if (result.status < 200 || result.status >= 300) {
    throw new ApiError(
      result.status,
      getApiMessage(result.data, `Upload failed: ${result.status}`),
      result.data,
    );
  }

  return result.data as T;
}

export async function apiDownloadWithAuth(
  url: string,
  destinationUri: string,
  token: string | null,
  accept = "*/*",
) {
  let isApiRequest = false;

  try {
    isApiRequest =
      Boolean(API_URL) && new URL(url).origin === new URL(API_URL).origin;
  } catch {
    isApiRequest = false;
  }

  const currentToken = isApiRequest
    ? mobileAuthHandlers
      ? mobileAuthHandlers.getAccessToken()
      : token
    : null;

  if (isApiRequest && !currentToken) {
    throw new Error("Please sign in to download this file.");
  }

  const sendDownload = (authToken: string | null) =>
    FileSystem.downloadAsync(url, destinationUri, {
      headers: {
        Accept: accept,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    });

  let result = await sendDownload(currentToken);

  if (result.status === 401 && currentToken) {
    const refreshedToken = await refreshAfterUnauthorized(currentToken);

    if (refreshedToken && refreshedToken !== currentToken) {
      await FileSystem.deleteAsync(result.uri, {
        idempotent: true,
      }).catch(() => undefined);

      result = await sendDownload(refreshedToken);
    }
  }

  return result;
}

export async function apiDownloadFile(
  path: string,
  filename: string,
  token: string | null,
): Promise<string> {
  if (!API_URL) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }

  if (!token) {
    throw new Error("Please sign in to download your payslip.");
  }


  const directory = FileSystem.cacheDirectory;

  if (!directory) {
    throw new Error("The app's local file directory is unavailable.");
  }

  const safeFilename =
    filename.replace(/[^a-zA-Z0-9._-]/g, "-") || "download.pdf";

  const destinationUri = `${directory}${Date.now()}-${safeFilename}`;
  const requestPath = path.startsWith("/") ? path : `/${path}`;

  const result = await apiDownloadWithAuth(
    `${API_URL}${requestPath}`,
    destinationUri,
    token,
    "application/pdf",
  );

  const removeDownloadedFile = async () => {
    await FileSystem.deleteAsync(result.uri, {
      idempotent: true,
    }).catch(() => undefined);
  };

  if (result.status < 200 || result.status >= 300) {
    let data: unknown = null;

    try {
      const body = await FileSystem.readAsStringAsync(result.uri);

      try {
        data = JSON.parse(body);
      } catch {
        data = body;
      }
    } catch {
      // Preserve the HTTP status even when the error body cannot be read.
    }

    await removeDownloadedFile();

    throw new ApiError(
      result.status,
      getApiMessage(data, `PDF download failed with status ${result.status}.`),
      data,
    );
  }

  const responseContentType =
    result.mimeType ||
    Object.entries(result.headers).find(
      ([key]) => key.toLowerCase() === "content-type",
    )?.[1] ||
    "";

  if (
    responseContentType &&
    !responseContentType.toLowerCase().includes("application/pdf")
  ) {
    await removeDownloadedFile();

    throw new ApiError(502, "The server did not return a valid PDF document.");
  }

  return result.uri;
}
