import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useQueryClient, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";

import {
  clearPersistedQueryCache,
  createQueryCachePersister,
  PERSISTED_QUERY_CACHE_MAX_AGE_MS,
} from "../queryCachePersister";

import {
  EmployeeUser,
  login as loginApi,
  logout as logoutApi,
  refreshMobileSession,
} from "../api/auth";
import { ApiError, configureMobileAuth } from "../api/client";
const ACCESS_TOKEN_KEY = "hrms_access_token";
const REFRESH_TOKEN_KEY = "hrms_refresh_token";
const USER_KEY = "hrms_user";

type AuthContextValue = {
  user: EmployeeUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (username: string, password: string) => Promise<EmployeeUser>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getCacheNamespace(user: EmployeeUser | null): string | null {
  if (!user) return null;

  const employeeId = user.employee?.id ?? 0;

  return `user_${user.id}_employee_${employeeId}`;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();

  const [user, setUser] = useState<EmployeeUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  const cacheNamespace = getCacheNamespace(user);

  const cacheNamespaceRef = useRef<string | null>(null);
  
  const persister = useMemo(
    () => (cacheNamespace ? createQueryCachePersister(cacheNamespace) : null),
    [cacheNamespace],
  );

  const persistOptions = useMemo(() => {
    if (!cacheNamespace || !persister) return null;

    return {
      persister,
      maxAge: PERSISTED_QUERY_CACHE_MAX_AGE_MS,
      buster: `hrms-query-cache-v1-${cacheNamespace}`,
      dehydrateOptions: {
        shouldDehydrateQuery: (query: Query) => {
          if (query.state.status !== "success") return false;

          const rootKey = query.queryKey[0];

          return (
            rootKey === "holidays" ||
            rootKey === "employee-weekly-off" ||
            rootKey === "task-customers" ||
            rootKey === "task-customer-sites"
          );
        },
        shouldDehydrateMutation: () => false,
      },
    };
  }, [cacheNamespace, persister]);

  const accessTokenRef = useRef<string | null>(null);

  function updateAccessToken(token: string | null) {
    accessTokenRef.current = token;
    setAccessToken(token);
  }

  async function clearStoredSession() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  }

  async function refreshStoredSession(): Promise<string> {
    const storedRefreshToken =
      await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

    if (!storedRefreshToken) {
      throw new ApiError(401, "No saved mobile session.");
    }

    const response = await refreshMobileSession(storedRefreshToken);

    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken);

    updateAccessToken(response.accessToken);

    return response.accessToken;
  }

  async function handleSessionExpired() {
    const expiredNamespace = cacheNamespaceRef.current;
    cacheNamespaceRef.current = null;

    await queryClient.cancelQueries();
    queryClient.clear();

    if (expiredNamespace) {
      await clearPersistedQueryCache(expiredNamespace);
    }

    await clearStoredSession();

    updateAccessToken(null);
    setUser(null);
  }

  async function restoreSession() {
    try {
      const [storedRefreshToken, storedUser] = await Promise.all([
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);

      if (!storedRefreshToken || !storedUser) {
        await clearStoredSession();
        return;
      }

      const restoredUser = JSON.parse(storedUser) as EmployeeUser;

      cacheNamespaceRef.current = getCacheNamespace(restoredUser);
      setUser(restoredUser);

      try {
        await refreshStoredSession();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await handleSessionExpired();
        } else {
          updateAccessToken(null);
          setUser(null);
          console.warn("Could not restore mobile session:", error);
        }
      }
    } catch (error) {
      console.error("Failed to restore session:", error);

      await clearStoredSession();
      updateAccessToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    configureMobileAuth({
      getAccessToken: () => accessTokenRef.current,
      refresh: refreshStoredSession,
      onSessionExpired: handleSessionExpired,
    });

    return () => configureMobileAuth(null);
  }, []);

  useEffect(() => {
    void restoreSession();
  }, []);
  async function signIn(username: string, password: string) {
    const response = await loginApi(username, password);

    // Clear the previous account's in-memory and persisted cache.
    const previousCacheNamespace = cacheNamespaceRef.current;

    await queryClient.cancelQueries();
    queryClient.clear();

    if (previousCacheNamespace) {
      await clearPersistedQueryCache(previousCacheNamespace);
    }

    await Promise.all([
      SecureStore.setItemAsync(REFRESH_TOKEN_KEY, response.refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.user)),
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    ]);

    cacheNamespaceRef.current = getCacheNamespace(response.user);

    updateAccessToken(response.accessToken);
    setUser(response.user);

    return response.user;
  }

  async function signOut() {
    const employeeId = user?.employee?.id;
    const activeCacheNamespace = cacheNamespaceRef.current;

    try {
      const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);

      await logoutApi(refreshToken);
    } catch (error) {
      console.warn("Server logout failed; clearing local session.", error);
    } finally {
      await queryClient.cancelQueries();
      queryClient.clear();

      if (activeCacheNamespace) {
        await clearPersistedQueryCache(activeCacheNamespace);
      }

      cacheNamespaceRef.current = null;
      // Remove only this employee's local chat preferences.
      if (
        typeof employeeId === "number" &&
        Number.isSafeInteger(employeeId) &&
        employeeId > 0
      ) {
        try {
          await AsyncStorage.multiRemove([
            `im-read-${employeeId}`,
            `im-archived-${employeeId}`,
          ]);
        } catch (error) {
          console.warn("Could not clear local chat preferences:", error);
        }
      }

      await clearStoredSession();

      updateAccessToken(null);
      setUser(null);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isAuthenticated: Boolean(accessToken && user),
      signIn,
      signOut,
    }),
    [user, accessToken, isLoading],
  );

  return (
    <AuthContext.Provider value={value}>
      {!isLoading && user && accessToken && persistOptions ? (
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={persistOptions}
        >
          {children}
        </PersistQueryClientProvider>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
