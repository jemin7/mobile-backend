import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
import { Platform } from "react-native";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

const CACHE_DATABASE_NAME = "hrms-query-cache.db";
const CACHE_KEY_NAME = "hrms_query_cache_key_v1";
const CACHE_KEY_INITIALIZED_NAME = "hrms_query_cache_key_initialized_v1";

const CACHE_WRITE_THROTTLE_MS = 1000;

export const PERSISTED_QUERY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

let databasePromise: Promise<SQLiteDatabase> | null = null;
let persistenceWarningShown = false;

function warnPersistenceFailure(error: unknown) {
  if (persistenceWarningShown) return;

  persistenceWarningShown = true;
  console.warn(
    "Encrypted query-cache persistence is unavailable. Using memory cache.",
    error,
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getOrCreateCacheKey(): Promise<string> {
  const [existingKey, initialized] = await Promise.all([
    SecureStore.getItemAsync(CACHE_KEY_NAME),
    SecureStore.getItemAsync(CACHE_KEY_INITIALIZED_NAME),
  ]);

  if (existingKey !== null) {
    if (!/^[0-9a-f]{64}$/i.test(existingKey)) {
      throw new Error("Invalid query-cache encryption key.");
    }

    if (initialized !== "true") {
      await SecureStore.setItemAsync(CACHE_KEY_INITIALIZED_NAME, "true");
    }

    return existingKey.toLowerCase();
  }

  if (initialized === "true") {
    throw new Error(
      "Query-cache encryption key is missing. Refusing replacement.",
    );
  }

  const randomBytes = await Crypto.getRandomBytesAsync(32);

  if (randomBytes.length !== 32) {
    throw new Error("Could not generate query-cache encryption key.");
  }

  const newKey = bytesToHex(randomBytes);

  await SecureStore.setItemAsync(CACHE_KEY_NAME, newKey, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });

  const savedKey = await SecureStore.getItemAsync(CACHE_KEY_NAME);

  if (savedKey !== newKey) {
    throw new Error("Could not verify saved query-cache key.");
  }

  await SecureStore.setItemAsync(CACHE_KEY_INITIALIZED_NAME, "true");

  return newKey;
}

async function openEncryptedCacheDatabase(): Promise<SQLiteDatabase> {
  if (Platform.OS === "web") {
    throw new Error("Encrypted query caching is native-only.");
  }

  const db = await openDatabaseAsync(CACHE_DATABASE_NAME, {
    useNewConnection: true,
  });

  try {
    const cipher = await db.getFirstAsync<{
      cipher_version: string;
    }>("PRAGMA cipher_version");

    if (!cipher?.cipher_version) {
      throw new Error("SQLCipher is unavailable in this native build.");
    }

    const key = await getOrCreateCacheKey();

    await db.execAsync(`PRAGMA key = "x'${key}'";`);

    await db.getFirstAsync<{ count: number }>(
      "SELECT COUNT(*) AS count FROM sqlite_master",
    );

    await db.execAsync("PRAGMA journal_mode = WAL;");

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS query_cache (
        cacheNamespace TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
    `);

    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function getCacheDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openEncryptedCacheDatabase().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

type WriteWaiter = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type ManagedPersister = Persister & {
  shutdown: () => Promise<void>;
};

const nativePersisterInstances = new Map<string, ManagedPersister>();
function createNativePersister(cacheNamespace: string): ManagedPersister {
  let pendingPayload: string | null = null;
  let pendingWaiters: WriteWaiter[] = [];
  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let writeQueue: Promise<void> = Promise.resolve();
  let disabled = false;

  function enqueueWrite(payload: string): Promise<void> {
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(async () => {
        const db = await getCacheDatabase();

        await db.runAsync(
          `INSERT INTO query_cache
            (cacheNamespace, payload, updatedAt)
           VALUES (?, ?, ?)
           ON CONFLICT(cacheNamespace) DO UPDATE SET
             payload = excluded.payload,
             updatedAt = excluded.updatedAt`,
          cacheNamespace,
          payload,
          Date.now(),
        );
      });

    return writeQueue;
  }

  function flushPendingWrite(): Promise<void> {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }

    if (pendingPayload === null) {
      return writeQueue;
    }

    const payload = pendingPayload;
    pendingPayload = null;

    const waiters = pendingWaiters;
    pendingWaiters = [];

    const operation = enqueueWrite(payload);

    operation.then(
      () => waiters.forEach((waiter) => waiter.resolve()),
      (error: unknown) => waiters.forEach((waiter) => waiter.reject(error)),
    );

    return operation;
  }

  function discardPendingWrite() {
    if (writeTimer) {
      clearTimeout(writeTimer);
      writeTimer = null;
    }

    pendingPayload = null;

    const waiters = pendingWaiters;
    pendingWaiters = [];

    waiters.forEach((waiter) => waiter.resolve());
  }

  async function deletePersistedRow(): Promise<void> {
    await writeQueue.catch(() => undefined);

    writeQueue = writeQueue
      .catch(() => undefined)
      .then(async () => {
        const db = await getCacheDatabase();

        await db.runAsync(
          "DELETE FROM query_cache WHERE cacheNamespace = ?",
          cacheNamespace,
        );
      });

    await writeQueue;
  }

  return {
    persistClient(client: PersistedClient): Promise<void> {
      if (disabled) return Promise.resolve();

      pendingPayload = JSON.stringify(client);

      const result = new Promise<void>((resolve, reject) => {
        pendingWaiters.push({ resolve, reject });
      });

      if (!writeTimer) {
        writeTimer = setTimeout(() => {
          writeTimer = null;
          void flushPendingWrite().catch(() => undefined);
        }, CACHE_WRITE_THROTTLE_MS);
      }

      return result.catch((error: unknown) => {
        warnPersistenceFailure(error);
      });
    },

    async restoreClient(): Promise<PersistedClient | undefined> {
      if (disabled) return undefined;

      try {
        await flushPendingWrite();
        await writeQueue;

        const db = await getCacheDatabase();

        const row = await db.getFirstAsync<{ payload: string }>(
          `SELECT payload FROM query_cache
           WHERE cacheNamespace = ?`,
          cacheNamespace,
        );

        if (!row?.payload) return undefined;

        const parsed: unknown = JSON.parse(row.payload);

        if (
          typeof parsed !== "object" ||
          parsed === null ||
          !("timestamp" in parsed) ||
          !("buster" in parsed) ||
          !("clientState" in parsed)
        ) {
          await db.runAsync(
            "DELETE FROM query_cache WHERE cacheNamespace = ?",
            cacheNamespace,
          );

          return undefined;
        }

        return parsed as PersistedClient;
      } catch (error) {
        warnPersistenceFailure(error);
        return undefined;
      }
    },

    async removeClient(): Promise<void> {
      // Used by TanStack when stored data expires or its buster changes.
      // Keep this persister usable for future cache writes.
      discardPendingWrite();

      try {
        await deletePersistedRow();
      } catch (error) {
        warnPersistenceFailure(error);
      }
    },

    async shutdown(): Promise<void> {
      // Used on logout/session expiry. Stop future writes from this instance.
      disabled = true;
      discardPendingWrite();

      try {
        await deletePersistedRow();
      } catch (error) {
        warnPersistenceFailure(error);
      }
    },
  };
}

const webPersister: Persister = {
  persistClient: async () => undefined,
  restoreClient: async () => undefined,
  removeClient: async () => undefined,
};

export function createQueryCachePersister(cacheNamespace: string): Persister {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cacheNamespace)) {
    throw new Error("Invalid query-cache namespace.");
  }

  if (Platform.OS === "web") {
    return webPersister;
  }

  const existing = nativePersisterInstances.get(cacheNamespace);

  if (existing) {
    return existing;
  }

  const persister = createNativePersister(cacheNamespace);

  nativePersisterInstances.set(cacheNamespace, persister);

  return persister;
}

export async function clearPersistedQueryCache(
  cacheNamespace: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(cacheNamespace)) {
    throw new Error("Invalid query-cache namespace.");
  }

  if (Platform.OS === "web") return;

  const persister =
    nativePersisterInstances.get(cacheNamespace) ??
    createNativePersister(cacheNamespace);

  await persister.shutdown();

  nativePersisterInstances.delete(cacheNamespace);
}
