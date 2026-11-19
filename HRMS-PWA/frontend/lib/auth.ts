/** Read OpenHRM JWT from localStorage or auth cookie (middleware uses cookie). */
import { isJwtExpired } from "./jwtUtils";
import { clearActiveCompanySession } from "@/app/utils/sidebarContext";

/** Drop the auth cookie written with and without the Secure flag. */
export function clearAuthCookie() {
  if (typeof document === "undefined") return;
  const expire = "expires=Thu, 01 Jan 1970 00:00:00 GMT";
  const bases = [
    `accessToken=; path=/; max-age=0; ${expire}; samesite=lax`,
    `accessToken=; path=/; max-age=0; ${expire}; samesite=lax; secure`,
  ];
  for (const cookie of bases) document.cookie = cookie;
}

/** Clear the browser session so the login page cannot look signed in. */
export function clearClientSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("openhrmCompanyAccess");
    localStorage.removeItem("openhrmDesktopManager");
    localStorage.removeItem("openhrmProductAccess");
    localStorage.removeItem("sidebarContext");
  } catch {
    /* ignore */
  }
  clearActiveCompanySession();
  clearAuthCookie();
}

export function getAccessToken(): string {
  if (typeof window === "undefined") return "";

  const fromStorage =
    localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
  if (fromStorage) {
    if (isJwtExpired(fromStorage)) {
      localStorage.removeItem("token");
      localStorage.removeItem("accessToken");
      return "";
    }
    return fromStorage;
  }

  const match = document.cookie.match(/(?:^|;\s*)accessToken=([^;]+)/);
  const fromCookie = match ? decodeURIComponent(match[1]) : "";
  if (fromCookie && isJwtExpired(fromCookie)) {
    clearAuthCookie();
    return "";
  }
  return fromCookie;
}

export function authHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = token
    ? { Authorization: `Bearer ${token}`, ...extra }
    : { ...extra };
  if (typeof window !== "undefined") {
    try {
      const activeCompanyID = Number(sessionStorage.getItem("activeCompanyID") || 0);
      if (Number.isFinite(activeCompanyID) && activeCompanyID > 0) {
        headers["X-Active-Company-ID"] = String(activeCompanyID);
      }
    } catch {
      /* ignore */
    }
  }
  return headers;
}
