import { DateTime } from 'luxon';

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export function timezone(): string {
  return process.env.TIMEZONE || DEFAULT_TIMEZONE;
}

const WALL_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

export function isReasonableWallClock(wall: string): boolean {
  const parsed = DateTime.fromFormat(wall, 'yyyy-MM-dd HH:mm:ss', {
    zone: timezone(),
  });
  if (!parsed.isValid) {
    return false;
  }
  return parsed.year >= 2000 && parsed.year <= 2100;
}

export function combineDateAndTime(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) {
    return null;
  }
  const wall = `${date} ${time}`;
  return isReasonableWallClock(wall) ? wall : null;
}

export function parseLocalDateTime(value: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return combineDateAndTime(match[1], match[2]);
}

/**
 * Store India wall-clock digits in TIMESTAMP WITHOUT TIME ZONE.
 * The Date is built from UTC components so Prisma writes those digits unchanged.
 */
export function wallClockToDate(wall: string): Date {
  const match = WALL_PATTERN.exec(wall);
  if (!match || !isReasonableWallClock(wall)) {
    throw new Error('invalid_wall_clock');
  }
  return new Date(
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6]),
    ),
  );
}

export function dateToWallIso(value: Date): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
}

export function dateToWallText(value: Date): string {
  return dateToWallIso(value).replace('T', ' ');
}

export function convertUtcToKolkata(value: string | number): {
  source: string;
  wall: string | null;
} {
  const source = String(value);
  let instant: DateTime;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    instant = DateTime.fromMillis(millis, { zone: 'utc' });
  } else {
    instant = DateTime.fromISO(String(value).trim(), { setZone: true });
  }
  if (!instant.isValid) {
    return { source, wall: null };
  }
  const wall = instant.setZone(timezone()).toFormat('yyyy-MM-dd HH:mm:ss');
  return { source, wall: isReasonableWallClock(wall) ? wall : null };
}

/**
 * Offset-aware mobile timestamps convert to Asia/Kolkata.
 * Values without a zone are already India local time by product contract.
 */
export function normalizeMobileTimestamp(input: string): string | null {
  const trimmed = input.trim();
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const parsed = hasZone
    ? DateTime.fromISO(trimmed, { setZone: true })
    : DateTime.fromISO(trimmed, { zone: timezone() });
  if (!parsed.isValid) {
    return null;
  }
  const wall = parsed.setZone(timezone()).toFormat('yyyy-MM-dd HH:mm:ss');
  return isReasonableWallClock(wall) ? wall : null;
}

export function kolkataDayRange(fromDate?: string, toDate?: string): {
  from?: Date;
  to?: Date;
} {
  const range: { from?: Date; to?: Date } = {};
  if (fromDate) {
    const start = DateTime.fromISO(fromDate, { zone: timezone() }).startOf('day');
    if (start.isValid) {
      range.from = start.toJSDate();
    }
  }
  if (toDate) {
    const end = DateTime.fromISO(toDate, { zone: timezone() }).endOf('day');
    if (end.isValid) {
      range.to = end.toJSDate();
    }
  }
  return range;
}
