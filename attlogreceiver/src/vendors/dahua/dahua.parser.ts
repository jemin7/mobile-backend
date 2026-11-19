import { gunzipSync, inflateSync } from 'zlib';
import { convertUtcToKolkata } from '../../common/time/time.util';

export type DahuaParseResult =
  | {
      kind: 'invalid';
      rawBody: string;
      reason: string;
    }
  | {
      kind: 'ignored';
      rawBody: string;
      eventCode: string;
    }
  | {
      kind: 'punch';
      rawBody: string;
      userId: string | null;
      sourcePunchTime: string | null;
      punchTime: string | null;
      serial: string | null;
      payloadValid: boolean;
      payloadReason: string | null;
    };

export function decodeDahuaPayload(body: unknown): string {
  const buffer = Buffer.isBuffer(body)
    ? body
    : Buffer.from(typeof body === 'string' ? body : body == null ? '' : JSON.stringify(body));
  return decompressIfNeeded(buffer).toString('utf8');
}

function decompressIfNeeded(buffer: Buffer): Buffer {
  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      return gunzipSync(buffer);
    } catch {
      return buffer;
    }
  }
  if (buffer.length >= 2 && buffer[0] === 0x78 && (buffer[1] === 0x01 || buffer[1] === 0x9c || buffer[1] === 0xda)) {
    try {
      return inflateSync(buffer);
    } catch {
      return buffer;
    }
  }
  return buffer;
}

export function parseDahuaBody(body: string): DahuaParseResult {
  const rawBody = body ?? '';
  const text = clipBeforeImage(rawBody);
  const parsed = parseJson(text);
  const code = readString(parsed?.Code ?? parsed?.code) ?? fieldValue(text, 'Code');
  const action = readString(parsed?.Action ?? parsed?.action) ?? fieldValue(text, 'action');
  if (!parsed && !code && !action) {
    return { kind: 'invalid', rawBody, reason: 'malformed_json' };
  }
  if (code !== 'AccessControl' || action?.toLowerCase() !== 'pulse') {
    return { kind: 'ignored', rawBody, eventCode: code || action || 'unknown' };
  }
  const data = eventData(parsed);
  const userId = readString(data.UserID ?? data.UserId ?? data.userID ?? data.userId);
  const serial = firstString(
    data.SN,
    data.sn,
    data.SerialNumber,
    data.DeviceID,
    data.DeviceId,
    parsed?.SN,
    parsed?.sn,
  );
  const utcValue = data.RealUTC ?? data.UTC ?? data.RealUtc ?? data.Utc;
  let sourcePunchTime: string | null = null;
  let punchTime: string | null = null;
  if (typeof utcValue === 'string' || typeof utcValue === 'number') {
    const converted = convertUtcToKolkata(utcValue);
    sourcePunchTime = converted.source;
    punchTime = converted.wall;
  }
  let payloadReason: string | null = null;
  if (!userId) {
    payloadReason = 'missing_user_id';
  } else if (!punchTime) {
    payloadReason = 'invalid_timestamp';
  }
  return {
    kind: 'punch',
    rawBody,
    userId,
    sourcePunchTime,
    punchTime,
    serial,
    payloadValid: payloadReason == null,
    payloadReason,
  };
}

function clipBeforeImage(body: string): string {
  const imageAt = body.search(/Content-Type:\s*image\//i);
  return imageAt >= 0 ? body.slice(0, imageAt) : body;
}

function fieldValue(text: string, name: string): string | null {
  const match = new RegExp(`(?:^|[;\\r\\n])\\s*${name}\\s*=\\s*([^;\\r\\n]+)`, 'i').exec(text);
  return match?.[1]?.trim() || null;
}

function eventData(parsed: Record<string, unknown> | null): Record<string, unknown> {
  if (!parsed) {
    return {};
  }
  if (isRecord(parsed.Data)) {
    return parsed.Data;
  }
  if (isRecord(parsed.data)) {
    return parsed.data;
  }
  if (parsed.UserID != null || parsed.UserId != null || parsed.userID != null || parsed.userId != null) {
    return parsed;
  }
  return {};
}

function parseJson(body: string): Record<string, unknown> | null {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const value = JSON.parse(trimmed) as unknown;
    return isRecord(value) ? value : null;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start < 0 || end <= start) {
      return null;
    }
    try {
      const value = JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      return isRecord(value) ? value : null;
    } catch {
      return null;
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const text = readString(value);
    if (text) {
      return text;
    }
  }
  return null;
}
