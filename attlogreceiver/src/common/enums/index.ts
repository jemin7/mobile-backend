export const VENDORS = ['ESSL', 'ZKTECO', 'DAHUA', 'MOBILE'] as const;
export type Vendor = (typeof VENDORS)[number];

export const PROCESSING_STATUSES = [
  'PENDING',
  'PROCESSED',
  'QUARANTINED',
  'INVALID',
  'FAILED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const LOG_TYPES = ['verified', 'unverified'] as const;
export type LogType = (typeof LOG_TYPES)[number];

export const AUTH_TYPES = ['PIN', 'FINGER', 'CARD', 'FACE', 'GPS'] as const;
export type AuthType = (typeof AUTH_TYPES)[number];

export function isVendor(value: string): value is Vendor {
  return (VENDORS as readonly string[]).includes(value);
}
