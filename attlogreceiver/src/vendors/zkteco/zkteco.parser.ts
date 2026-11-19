import { combineDateAndTime, parseLocalDateTime } from '../../common/time/time.util';

export type ZktecoPunch = {
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

/**
 * Public ZKTeco ADMS ATTLOG line.
 * Tab form: PIN, DateTime, Status, Verify, WorkCode, optional reserved fields.
 * Space form matches the same field order, with date and time as separate tokens.
 * Status/verify order must be confirmed on the target firmware before production cutover.
 */
const VERIFY_MODES: Record<string, string> = {
  '0': 'PIN',
  '3': 'PIN',
  '1': 'FINGER',
  '2': 'CARD',
  '4': 'CARD',
  '15': 'FACE',
};

export function mapZktecoVerifyMode(mode: string | null): string | null {
  if (!mode) {
    return null;
  }
  return VERIFY_MODES[mode] ?? null;
}

export function parseZktecoBody(body: string): ZktecoPunch[] {
  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseZktecoLine(line));
}

export function parseZktecoLine(line: string): ZktecoPunch {
  if (line.includes('\t')) {
    return fromTab(line, line.split('\t').map((part) => part.trim()));
  }
  return fromSpace(line, line.split(/\s+/).filter(Boolean));
}

function fromTab(rawBody: string, parts: string[]): ZktecoPunch {
  if (parts.length < 4) {
    return invalid(rawBody, 'malformed_punch');
  }
  const userId = parts[0] || null;
  const sourcePunchTime = parts[1] || null;
  const status = parts[2] || null;
  const hasVerify = parts.length >= 5;
  const verifyMode = hasVerify ? parts[3] || null : null;
  const workCode = hasVerify ? parts[4] || null : parts[3] || null;
  const eventId = parts.length >= 6 ? parts.slice(5).join('\t') || null : null;
  return finalize(rawBody, userId, sourcePunchTime, parseLocalDateTime(sourcePunchTime ?? ''), status, verifyMode, workCode, eventId);
}

function fromSpace(rawBody: string, parts: string[]): ZktecoPunch {
  if (parts.length < 5) {
    return invalid(rawBody, 'malformed_punch');
  }
  const userId = parts[0] || null;
  const sourcePunchTime = `${parts[1]} ${parts[2]}`;
  const status = parts[3] || null;
  const hasVerify = parts.length >= 6;
  const verifyMode = hasVerify ? parts[4] || null : null;
  const workCode = hasVerify ? parts[5] || null : parts[4] || null;
  return finalize(
    rawBody,
    userId,
    sourcePunchTime,
    combineDateAndTime(parts[1], parts[2]),
    status,
    verifyMode,
    workCode,
    null,
  );
}

function finalize(
  rawBody: string,
  userId: string | null,
  sourcePunchTime: string | null,
  punchTime: string | null,
  status: string | null,
  verifyMode: string | null,
  workCode: string | null,
  eventId: string | null,
): ZktecoPunch {
  const authType = mapZktecoVerifyMode(verifyMode);
  let payloadReason: string | null = null;
  if (!userId) {
    payloadReason = 'missing_user_id';
  } else if (!punchTime) {
    payloadReason = 'invalid_timestamp';
  }
  return {
    rawBody,
    userId,
    sourcePunchTime,
    punchTime,
    status,
    workCode,
    authType,
    verifyMode,
    eventId,
    payloadValid: payloadReason == null,
    payloadReason,
  };
}

function invalid(rawBody: string, reason: string): ZktecoPunch {
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
