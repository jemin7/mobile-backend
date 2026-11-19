import { createHash } from 'crypto';

export type DedupeInput = {
  vendor: string;
  deviceSn: string;
  userId: string | null;
  punchTime: string | null;
  status: string | null;
  workCode: string | null;
  authType: string | null;
  eventId: string | null;
  rawBody: string;
  payloadValid: boolean;
  dedupeIdentity?: string | null;
};

export function buildDedupeHash(input: DedupeInput): string {
  const material = input.dedupeIdentity
    ? ['identity', input.vendor, input.deviceSn, input.dedupeIdentity]
    : [
        'punch',
        input.vendor,
        input.deviceSn,
        input.userId ?? '',
        input.punchTime ?? '',
        input.status ?? '',
        input.workCode ?? '',
        input.authType ?? '',
        input.eventId ?? '',
        input.payloadValid ? '' : input.rawBody,
      ];
  return createHash('sha256').update(material.join('|')).digest('hex');
}
