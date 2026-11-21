import { type SQLiteDatabase } from "expo-sqlite";
import { getLocationDatabase } from "./database";

export type AttendanceAction = "CHECK_IN" | "CHECK_OUT";

export type AttendanceEventStatus = "PENDING" | "SYNCING" | "SYNCED";

export type NewAttendanceEvent = {
  employeeId: number;
  checkType: AttendanceAction;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  referenceEventId?: string | null;
  punchTime: string;
  timeProof: string;
  monotonicTime?: number | null;
};

export type AttendanceQueueEvent = {
  id: number;
  clientEventId: string;
  referenceEventId: string | null;
  employeeId: number;
  checkType: AttendanceAction;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  address: string | null;
  punchTime: string;
  monotonicTime: number | null;
  serverPunchId: number | null;
  status: AttendanceEventStatus;
  attempts: number;
  lastError: string | null;
  permanentFailure: number;
  createdAt: string;
  timeProof: string | null;
};

let databasePromise: Promise<SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await getLocationDatabase();

      await db.execAsync(`
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS attendance_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clientEventId TEXT NOT NULL UNIQUE,
          referenceEventId TEXT,
          employeeId INTEGER NOT NULL,
          checkType TEXT NOT NULL
            CHECK (checkType IN ('CHECK_IN', 'CHECK_OUT')),
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL,
          address TEXT,
          punchTime TEXT NOT NULL,
          timeProof TEXT,
          monotonicTime REAL,
          serverPunchId INTEGER,
          status TEXT NOT NULL DEFAULT 'PENDING'
            CHECK (status IN ('PENDING', 'SYNCING', 'SYNCED')),
          attempts INTEGER NOT NULL DEFAULT 0,
          lastError TEXT,
          permanentFailure INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS
          idx_attendance_events_employee_status
        ON attendance_events (employeeId, status, id);

        CREATE INDEX IF NOT EXISTS
          idx_attendance_events_reference
        ON attendance_events (referenceEventId, checkType);
      `);

      const columns = await db.getAllAsync<{ name: string }>(
        "PRAGMA table_info(attendance_events)",
      );

      const existingColumns = new Set(columns.map((column) => column.name));

      if (!existingColumns.has("permanentFailure")) {
        await db.execAsync(
          "ALTER TABLE attendance_events ADD COLUMN permanentFailure INTEGER NOT NULL DEFAULT 0",
        );
      }

      if (!existingColumns.has("timeProof")) {
        await db.execAsync(
          "ALTER TABLE attendance_events ADD COLUMN timeProof TEXT",
        );
      }

      // Delete only server-confirmed attendance events older than 7 days.
      // Keep check-ins that are still referenced by an unconfirmed checkout.
      const retentionCutoff = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      await db.runAsync(
        `DELETE FROM attendance_events
         WHERE status = 'SYNCED'
           AND createdAt < ?
           AND NOT (
             checkType = 'CHECK_IN'
             AND NOT EXISTS (
               SELECT 1
               FROM attendance_events AS dependent
               WHERE dependent.referenceEventId = attendance_events.clientEventId
                 AND dependent.checkType = 'CHECK_OUT'
                 AND dependent.status = 'SYNCED'
             )
           )`,
        retentionCutoff,
      );

      return db;
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

function generateClientEventId(): string {
  return `${Date.now()}-` + Math.random().toString(36).slice(2, 12);
}

/**
 * Store local wall-clock time in the format expected by
 * the existing backend's device punch-time parser.
 */

/**
 * Persist attendance locally first.
 * No network request is performed by this function.
 */
export async function saveAttendanceEvent(input: NewAttendanceEvent): Promise<{
  clientEventId: string;
  punchTime: string;
  timeProof: string;
}> {
  if (!Number.isSafeInteger(input.employeeId) || input.employeeId <= 0) {
    throw new Error("A valid employee ID is required.");
  }

  if (
    !Number.isFinite(input.latitude) ||
    input.latitude < -90 ||
    input.latitude > 90 ||
    !Number.isFinite(input.longitude) ||
    input.longitude < -180 ||
    input.longitude > 180
  ) {
    throw new Error("Valid GPS coordinates are required.");
  }

  if (input.checkType === "CHECK_OUT" && !input.referenceEventId?.trim()) {
    throw new Error(
      "Checkout must reference its corresponding check-in event.",
    );
  }

  const db = await getDatabase();

  const clientEventId = generateClientEventId();
  const punchTime = input.punchTime;

  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(punchTime)) {
    throw new Error("A valid trusted attendance punch time is required.");
  }

  if (typeof input.timeProof !== "string" || !input.timeProof.trim()) {
    throw new Error("A valid server time proof is required.");
  }

  await db.runAsync(
    `INSERT INTO attendance_events (
      clientEventId,
      referenceEventId,
      employeeId,
      checkType,
      latitude,
      longitude,
      accuracy,
      address,
      punchTime,
      timeProof,
      monotonicTime,
      status,
      attempts,
      lastError,
      createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', 0, NULL, ?)`,
    clientEventId,
    input.referenceEventId ?? null,
    input.employeeId,
    input.checkType,
    input.latitude,
    input.longitude,
    input.accuracy ?? null,
    input.address?.trim() || null,
    punchTime,
    input.timeProof,
    input.monotonicTime ?? null,
    new Date().toISOString(),
  );

  return { clientEventId, punchTime, timeProof: input.timeProof };
}

/**
 * Find the latest local check-in without a corresponding
 * local checkout. The checkout references the check-in's
 * clientEventId, not the server's numeric record ID.
 */
export async function getOpenPunchInEvent(
  employeeId: number,
): Promise<string | null> {
  const db = await getDatabase();

  const result = await db.getFirstAsync<{
    clientEventId: string;
  }>(
    `SELECT punchIn.clientEventId
 FROM attendance_events AS punchIn
 LEFT JOIN attendance_events AS punchOut
   ON punchOut.referenceEventId = punchIn.clientEventId
   AND punchOut.checkType = 'CHECK_OUT'
   AND punchOut.permanentFailure = 0
 WHERE punchIn.employeeId = ?
   AND punchIn.checkType = 'CHECK_IN'
   AND punchIn.permanentFailure = 0
   AND punchOut.id IS NULL
 ORDER BY punchIn.id DESC
 LIMIT 1`,
    employeeId,
  );

  return result?.clientEventId ?? null;
}

/**
 * Recover queue entries left in SYNCING if the app was closed.
 */
export async function recoverInterruptedAttendanceEvents(
  employeeId: number,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE attendance_events
     SET status = 'PENDING'
     WHERE employeeId = ?
       AND status = 'SYNCING'`,
    employeeId,
  );
}

/**
 * Read pending events in insertion order so check-in is
 * processed before its dependent checkout.
 */
export async function getPendingAttendanceEvents(
  employeeId: number,
): Promise<AttendanceQueueEvent[]> {
  const db = await getDatabase();

  return db.getAllAsync<AttendanceQueueEvent>(
    `SELECT *
     FROM attendance_events
    WHERE employeeId = ?
  AND status = 'PENDING'
  AND permanentFailure = 0
     ORDER BY id ASC`,
    employeeId,
  );
}

export async function markAttendanceEventSyncing(id: number): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE attendance_events
     SET status = 'SYNCING', lastError = NULL
     WHERE id = ?`,
    id,
  );
}

export async function markAttendanceEventSynced(
  id: number,
  serverPunchId: number,
): Promise<void> {
  if (!Number.isSafeInteger(serverPunchId) || serverPunchId <= 0) {
    throw new Error("A valid server attendance ID is required.");
  }

  const db = await getDatabase();

  await db.runAsync(
    `UPDATE attendance_events
     SET status = 'SYNCED',
         serverPunchId = ?,
         lastError = NULL
     WHERE id = ?`,
    serverPunchId,
    id,
  );
}

export async function returnAttendanceEventToPending(
  id: number,
  errorMessage: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE attendance_events
     SET status = 'PENDING',
         attempts = attempts + 1,
         lastError = ?
     WHERE id = ?`,
    errorMessage.slice(0, 1000),
    id,
  );
}
export async function markAttendanceEventRejected(
  id: number,
  errorMessage: string,
): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE attendance_events
     SET status = 'PENDING',
         permanentFailure = 1,
         attempts = attempts + 1,
         lastError = ?
     WHERE id = ?`,
    errorMessage.slice(0, 1000),
    id,
  );
}

export async function getAttendanceEventByClientEventId(
  employeeId: number,
  clientEventId: string,
): Promise<AttendanceQueueEvent | null> {
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    throw new Error("A valid employee ID is required.");
  }

  if (!clientEventId.trim()) {
    throw new Error("A client event ID is required.");
  }

  const db = await getDatabase();

  const event = await db.getFirstAsync<AttendanceQueueEvent>(
    `SELECT *
     FROM attendance_events
     WHERE employeeId = ?
       AND clientEventId = ?
     LIMIT 1`,
    employeeId,
    clientEventId,
  );

  return event ?? null;
}

export async function getLatestAttendanceEvent(
  employeeId: number,
): Promise<AttendanceQueueEvent | null> {
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    throw new Error("A valid employee ID is required.");
  }

  const db = await getDatabase();

  const event = await db.getFirstAsync<AttendanceQueueEvent>(
    `SELECT *
     FROM attendance_events
     WHERE employeeId = ?
     ORDER BY id DESC
     LIMIT 1`,
    employeeId,
  );

  return event ?? null;
}

export async function getLatestCheckInEventForDate(
  employeeId: number,
  dateKey: string,
): Promise<AttendanceQueueEvent | null> {
  if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
    throw new Error("A valid employee ID is required.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("A valid attendance date is required.");
  }

  const db = await getDatabase();

  const event = await db.getFirstAsync<AttendanceQueueEvent>(
    `SELECT *
     FROM attendance_events
     WHERE employeeId = ?
       AND checkType = 'CHECK_IN'
       AND substr(punchTime, 1, 10) = ?
     ORDER BY id DESC
     LIMIT 1`,
    employeeId,
    dateKey,
  );

  return event ?? null;
}
