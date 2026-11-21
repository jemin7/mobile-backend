import { type SQLiteDatabase } from "expo-sqlite";
import { getLocationDatabase } from "./database";

export type DiagnosticLevel = "INFO" | "WARN" | "ERROR";

export type DiagnosticLogInput = {
  level?: DiagnosticLevel;
  source: string;
  event: string;
  message: string;
  details?: Record<string, unknown>;
};

export type DiagnosticLogEntry = {
  id: number;
  occurredAt: string;
  level: DiagnosticLevel;
  source: string;
  event: string;
  message: string;
  detailsJson: string | null;
};

const TABLE_NAME = "hrms_diagnostic_events";
const MAX_LOG_ENTRIES = 250;

let databasePromise: Promise<SQLiteDatabase> | null = null;
async function getDatabase(): Promise<SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await getLocationDatabase();

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          occurredAt TEXT NOT NULL,
          level TEXT NOT NULL
            CHECK (level IN ('INFO', 'WARN', 'ERROR')),
          source TEXT NOT NULL,
          event TEXT NOT NULL,
          message TEXT NOT NULL,
          detailsJson TEXT
        );

        CREATE INDEX IF NOT EXISTS
          idx_hrms_diagnostic_events_time
        ON ${TABLE_NAME} (occurredAt DESC);
      `);

      return db;
    })().catch((error: unknown) => {
      databasePromise = null;
      throw error;
    });
  }

  return databasePromise;
}

/**
 * Redact potentially sensitive values before saving diagnostic details.
 */

function sanitizeText(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, "Bearer [redacted]")
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      "[token redacted]",
    )
    .replace(
      /\b(access[_-]?token|refresh[_-]?token|authorization|password|secret)\s*[:=]\s*[^,\s;]+/gi,
      "$1=[redacted]",
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]");
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return "[maximum detail depth reached]";
  }

  if (Array.isArray(value)) {
    return value.slice(0, 30).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (
        /token|password|secret|authorization|latitude|longitude|coordinates|phone|email/i.test(
          key,
        )
      ) {
        result[key] = "[redacted]";
      } else {
        result[key] = sanitizeValue(item, depth + 1);
      }
    }

    return result;
  }

  if (typeof value === "string") {
    return sanitizeText(value).slice(0, 500);
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return String(value);
}

/**
 * Save an event locally so it remains available after reopening HRMS.
 * The log is capped to prevent unlimited storage growth.
 */
export async function logDiagnosticEvent(
  input: DiagnosticLogInput,
): Promise<void> {
  const db = await getDatabase();

  let detailsJson: string | null = null;

  if (input.details) {
    try {
      detailsJson = JSON.stringify(sanitizeValue(input.details));
    } catch {
      detailsJson = '{"error":"Could not serialize details"}';
    }
  }

  const level = input.level ?? "INFO";
  const occurredAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO ${TABLE_NAME} (
      occurredAt,
      level,
      source,
      event,
      message,
      detailsJson
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    occurredAt,
    level,
    input.source.slice(0, 80),
    input.event.slice(0, 100),
    sanitizeText(input.message).slice(0, 500),
    detailsJson,
  );

  // Keep only the newest 250 events.
  await db.runAsync(
    `DELETE FROM ${TABLE_NAME}
     WHERE id NOT IN (
       SELECT id
       FROM ${TABLE_NAME}
       ORDER BY id DESC
       LIMIT ?
     )`,
    MAX_LOG_ENTRIES,
  );
}

/**
 * Read recent diagnostic events, newest first.
 */
export async function getDiagnosticEvents(
  limit = 100,
): Promise<DiagnosticLogEntry[]> {
  const db = await getDatabase();
  const safeLimit = Math.max(1, Math.min(MAX_LOG_ENTRIES, Math.floor(limit)));

  return db.getAllAsync<DiagnosticLogEntry>(
    `SELECT
       id,
       occurredAt,
       level,
       source,
       event,
       message,
       detailsJson
     FROM ${TABLE_NAME}
     ORDER BY id DESC
     LIMIT ?`,
    safeLimit,
  );
}

/**
 * Clear diagnostic history only.
 * This never deletes queued location records.
 */
export async function clearDiagnosticEvents(): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(`DELETE FROM ${TABLE_NAME}`);
}
