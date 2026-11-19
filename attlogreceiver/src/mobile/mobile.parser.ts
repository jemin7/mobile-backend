import { normalizeMobileTimestamp } from '../common/time/time.util';

export type MobilePunchInput = {
  installation_id?: unknown;
  employee_code?: unknown;
  punched_at?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  address?: unknown;
  photo_url?: unknown;
  check_type?: unknown;
};

export type ParsedMobilePunch = {
  rawBody: string;
  installationId: string | null;
  userId: string | null;
  sourcePunchTime: string | null;
  punchTime: string | null;
  status: string | null;
  payloadValid: boolean;
  payloadReason: string | null;
};

export function parseMobileBody(body: unknown): ParsedMobilePunch | { error: 'malformed_json' } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'malformed_json' };
  }
  const input = body as MobilePunchInput;
  const rawBody = JSON.stringify(body);
  const installationId = readText(input.installation_id);
  const userId = readText(input.employee_code);
  const sourcePunchTime = readText(input.punched_at);
  const punchTime = sourcePunchTime ? normalizeMobileTimestamp(sourcePunchTime) : null;
  const status = readText(input.check_type);
  let payloadReason: string | null = null;
  if (!installationId) {
    payloadReason = 'missing_installation_id';
  } else if (!userId) {
    payloadReason = 'missing_user_id';
  } else if (!punchTime) {
    payloadReason = 'invalid_timestamp';
  }
  return {
    rawBody,
    installationId,
    userId,
    sourcePunchTime,
    punchTime,
    status,
    payloadValid: payloadReason == null,
    payloadReason,
  };
}

function readText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}
