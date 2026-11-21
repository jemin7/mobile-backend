import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import {
  deleteDatabaseAsync,
  defaultDatabaseDirectory,
  openDatabaseAsync,
  type SQLiteDatabase,
} from "expo-sqlite";
import { Platform } from "react-native";

import { getOrCreateLocationDatabaseKey } from "./databaseKey";

const LEGACY_DATABASE_NAME = "hrms-location.db";
const ENCRYPTED_DATABASE_NAME = "hrms-location-encrypted.db";

const DATABASE_READY_KEY = "hrms_location_encryption_ready_v1";
const MIGRATION_STARTED_KEY = "hrms_location_migration_started_v1";

type TableCount = {
  name: string;
  count: number;
};

function getDatabaseDirectory(): string {
  if (Platform.OS === "web" || !defaultDatabaseDirectory) {
    throw new Error(
      "Encrypted local storage requires a supported native build.",
    );
  }

  return defaultDatabaseDirectory.replace(/\/+$/, "");
}

async function verifySQLCipher(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{
    cipher_version: string;
  }>("PRAGMA cipher_version");

  if (!result?.cipher_version) {
    throw new Error(
      "SQLCipher is unavailable. Build the app with useSQLCipher enabled before migrating local data.",
    );
  }
}

async function getTableCounts(db: SQLiteDatabase): Promise<TableCount[]> {
  const tables = await db.getAllAsync<{ name: string }>(
    `SELECT name
     FROM sqlite_master
     WHERE type = 'table'
       AND name NOT LIKE 'sqlite_%'
     ORDER BY name`,
  );

  const counts: TableCount[] = [];

  for (const table of tables) {
    const safeName = table.name.replace(/"/g, '""');

    const result = await db.getFirstAsync<{ rowCount: number }>(
      `SELECT COUNT(*) AS rowCount FROM "${safeName}"`,
    );

    if (!result) {
      throw new Error(`Could not verify table ${table.name}.`);
    }

    counts.push({
      name: table.name,
      count: Number(result.rowCount),
    });
  }

  return counts;
}

function compareTableCounts(source: TableCount[], target: TableCount[]): void {
  if (JSON.stringify(source) !== JSON.stringify(target)) {
    throw new Error(
      "Database migration verification failed. Source and encrypted database record counts do not match.",
    );
  }
}

async function verifyDatabaseIntegrity(db: SQLiteDatabase): Promise<void> {
  await verifySQLCipher(db);

  const results = await db.getAllAsync<{
    integrity_check: string;
  }>("PRAGMA integrity_check");

  if (results.length !== 1 || results[0]?.integrity_check !== "ok") {
    throw new Error("Encrypted database integrity verification failed.");
  }
}

async function openVerifiedEncryptedDatabase(
  directory: string,
  key: string,
  expectedCounts?: TableCount[],
): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(
    ENCRYPTED_DATABASE_NAME,
    { useNewConnection: true },
    directory,
  );

  try {
    // This must be the first SQL statement on the encrypted connection.
    await db.execAsync(`PRAGMA key = "x'${key}'";`);

    await verifyDatabaseIntegrity(db);

    if (expectedCounts) {
      const actualCounts = await getTableCounts(db);
      compareTableCounts(expectedCounts, actualCounts);
    }

    await db.execAsync("PRAGMA journal_mode = WAL;");

    return db;
  } catch (error) {
    await db.closeAsync().catch(() => {});
    throw error;
  }
}

export async function openOrMigrateLocationDatabase(): Promise<SQLiteDatabase> {
  const directory = getDatabaseDirectory();

  const directoryUri = `file://${directory}`;

  const legacyFile = new File(directoryUri, LEGACY_DATABASE_NAME);
  const encryptedFile = new File(directoryUri, ENCRYPTED_DATABASE_NAME);

  const [ready, migrationStarted] = await Promise.all([
    SecureStore.getItemAsync(DATABASE_READY_KEY),
    SecureStore.getItemAsync(MIGRATION_STARTED_KEY),
  ]);

  // An already migrated installation must never silently create
  // a replacement encrypted database.
  if (ready === "true") {
    if (!encryptedFile.exists) {
      throw new Error(
        "The encrypted attendance database is missing. Existing data is protected from automatic replacement.",
      );
    }

    const key = await getOrCreateLocationDatabaseKey();

    const db = await openVerifiedEncryptedDatabase(directory, key);

    // Remove an old plaintext copy left behind by an interrupted cleanup.
    if (legacyFile.exists) {
      await deleteDatabaseAsync(LEGACY_DATABASE_NAME, directory);
    }

    await SecureStore.deleteItemAsync(MIGRATION_STARTED_KEY);

    return db;
  }

  if (encryptedFile.exists && !legacyFile.exists) {
    throw new Error(
      "An encrypted database exists without a verified migration marker or plaintext recovery source. Manual recovery is required.",
    );
  }

  if (migrationStarted === "true" && !legacyFile.exists) {
    throw new Error(
      "The previous database migration was interrupted and its original database is missing. Automatic database creation is blocked.",
    );
  }

  // Open the existing plaintext database without applying an encryption key.
  const sourceDb = await openDatabaseAsync(
    LEGACY_DATABASE_NAME,
    { useNewConnection: true },
    directory,
  );

  let sourceClosed = false;
  let encryptedDb: SQLiteDatabase | null = null;

  try {
    // Never attempt migration with a build that lacks SQLCipher.
    await verifySQLCipher(sourceDb);

    await SecureStore.setItemAsync(MIGRATION_STARTED_KEY, "true");

    const key = await getOrCreateLocationDatabaseKey();

    const sourceCounts = await getTableCounts(sourceDb);

    // Retry safely when a previous migration stopped before verification.
    if (encryptedFile.exists) {
      await deleteDatabaseAsync(ENCRYPTED_DATABASE_NAME, directory);
    }

    const targetPath = `${directory}/${ENCRYPTED_DATABASE_NAME}`;
    const safeTargetPath = targetPath.replace(/'/g, "''");

    // Attach a new encrypted database to the existing plaintext database.
    await sourceDb.execAsync(
      `ATTACH DATABASE '${safeTargetPath}' AS encrypted KEY "x'${key}'";`,
    );

    try {
      await sourceDb.execAsync("SELECT sqlcipher_export('encrypted');");
    } finally {
      await sourceDb.execAsync("DETACH DATABASE encrypted;");
    }

    // Reopen the exported database with its key and verify every table.
    encryptedDb = await openVerifiedEncryptedDatabase(
      directory,
      key,
      sourceCounts,
    );

    // Only mark migration complete after the encrypted copy passes verification.
    await sourceDb.closeAsync();
    sourceClosed = true;

    await SecureStore.setItemAsync(DATABASE_READY_KEY, "true");

    // Remove the old plaintext database only after successful verification.
    if (legacyFile.exists) {
      await deleteDatabaseAsync(LEGACY_DATABASE_NAME, directory);
    }

    await SecureStore.deleteItemAsync(MIGRATION_STARTED_KEY);

    return encryptedDb;
  } catch (error) {
    if (encryptedDb) {
      await encryptedDb.closeAsync().catch(() => {});
    }

    if (!sourceClosed) {
      await sourceDb.closeAsync().catch(() => {});
    }

    // Keep the original plaintext database when migration fails.
    throw error;
  }
}
