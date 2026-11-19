import { parseLocalDateTime, combineDateAndTime } from '../../common/time/time.util';

export type ParsedPunch = {
  rawBody: string;
  userId: string | null;
  sourcePunchTime: string | null;
  punchTime: string | null;
  status: string | null;
  workCode: string | null;
  authType: string | null;
  verifyMode: string | null;
  eventId: string | null;
  payloadValid: boolean;
  payloadReason: string | null;
};

const VERIFY_MODES: Record<string, string> = {
  '0': 'PIN',
  '3': 'PIN',
  '1': 'FINGER',
  '2': 'CARD',
  '4': 'CARD',
  '15': 'FACE',
};

export function mapEsslVerifyMode(mode: string | null): string | null {
  if (!mode) {
    return null;
  }
  return VERIFY_MODES[mode] ?? null;
}

export function parseEsslBody(body: string): ParsedPunch[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseEsslLine(line));
}

export function parseEsslLine(line: string): ParsedPunch {
  const rawBody = line;
  if (line.includes('\t')) {
    return fromParts(rawBody, line.split('\t').map((part) => part.trim()), true);
  }
  return fromParts(rawBody, line.split(/\s+/).filter(Boolean), false);
}

function fromParts(rawBody: string, parts: string[], tabSeparated: boolean): ParsedPunch {
  const empty = invalid(rawBody, 'malformed_punch');
  if (tabSeparated) {
    if (parts.length < 4) {
      return empty;
    }
    const userId = parts[0] || null;
    const sourcePunchTime = parts[1] || null;
    const status = parts[2] || null;
    const hasVerify = parts.length >= 5;
    const verifyMode = hasVerify ? parts[3] || null : null;
    const workCode = hasVerify ? parts[4] || null : parts[3] || null;
    return finalize(rawBody, userId, sourcePunchTime, status, verifyMode, workCode);
  }

  if (parts.length < 5) {
    return empty;
  }
  const userId = parts[0] || null;
  const date = parts[1];
  const time = parts[2];
  const status = parts[3] || null;
  const hasVerify = parts.length >= 6;
  const verifyMode = hasVerify ? parts[4] || null : null;
  const workCode = hasVerify ? parts[5] || null : parts[4] || null;
  const source = `${date} ${time}`;
  const punchTime = combineDateAndTime(date, time);
  return finalize(rawBody, userId, source, status, verifyMode, workCode, punchTime);
}

function finalize(
  rawBody: string,
  userId: string | null,
  sourcePunchTime: string | null,
  status: string | null,
  verifyMode: string | null,
  workCode: string | null,
  punchTimeOverride?: string | null,
): ParsedPunch {
  const punchTime =
    punchTimeOverride === undefined
      ? sourcePunchTime
        ? parseLocalDateTime(sourcePunchTime)
        : null
      : punchTimeOverride;
  const authType = mapEsslVerifyMode(verifyMode);
  if (!userId) {
    return { ...base(rawBody, userId, sourcePunchTime, punchTime, status, workCode, authType, verifyMode), payloadValid: false, payloadReason: 'missing_user_id' };
  }
  if (!punchTime) {
    return { ...base(rawBody, userId, sourcePunchTime, punchTime, status, workCode, authType, verifyMode), payloadValid: false, payloadReason: 'invalid_timestamp' };
  }
  return { ...base(rawBody, userId, sourcePunchTime, punchTime, status, workCode, authType, verifyMode), payloadValid: true, payloadReason: null };
}

function base(
  rawBody: string,
  userId: string | null,
  sourcePunchTime: string | null,
  punchTime: string | null,
  status: string | null,
  workCode: string | null,
  authType: string | null,
  verifyMode: string | null,
): Omit<ParsedPunch, 'payloadValid' | 'payloadReason'> {
  return {
    rawBody,
    userId,
    sourcePunchTime,
    punchTime,
    status,
    workCode,
    authType,
    verifyMode,
    eventId: null,
  };
}

function invalid(rawBody: string, reason: string): ParsedPunch {
  return {
    rawBody,
    userId: null,
    sourcePunchTime: null,
    punchTime: null,
    status: null,
    workCode: null,
    authType: null,
    verifyMode: null,
    eventId: null,
    payloadValid: false,
    payloadReason: reason,
  };
}
