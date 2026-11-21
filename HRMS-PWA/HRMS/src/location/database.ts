import { type SQLiteDatabase } from "expo-sqlite";
import { openOrMigrateLocationDatabase } from "./databaseMigration";

let databasePromise: Promise<SQLiteDatabase> | null = null;

export async function getLocationDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await openOrMigrateLocationDatabase();

      await db.execAsync("PRAGMA journal_mode = WAL;");

      // Remove legacy continuous-location tracking data.
      // Attendance punch events are stored separately and are preserved.
      await db.execAsync(`
        DROP TABLE IF EXISTS location_events;
        DROP TABLE IF EXISTS active_location_session;
      `);

      return db;
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}
