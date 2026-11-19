import { convertUtcToKolkata, normalizeMobileTimestamp, wallClockToDate, dateToWallIso } from '../../src/common/time/time.util';
import { buildDedupeHash } from '../../src/common/helpers/dedupe';

describe('time normalization', () => {
  it('keeps an eSSL wall clock unchanged', () => {
    const wall = '2026-10-30 09:05:00';
    expect(dateToWallIso(wallClockToDate(wall))).toBe('2026-10-30T09:05:00');
  });

  it('converts Dahua UTC to Asia/Kolkata', () => {
    expect(convertUtcToKolkata('2026-10-30T03:35:00Z').wall).toBe('2026-10-30 09:05:00');
  });

  it('converts an offset mobile timestamp to Asia/Kolkata', () => {
    expect(normalizeMobileTimestamp('2026-10-30T09:05:00+05:30')).toBe('2026-10-30 09:05:00');
  });

  it('treats a mobile timestamp without a zone as India local time', () => {
    expect(normalizeMobileTimestamp('2026-10-30T09:05:00')).toBe('2026-10-30 09:05:00');
  });

  it('rejects an impossible calendar date', () => {
    expect(normalizeMobileTimestamp('2026-02-31T09:05:00+05:30')).toBeNull();
  });
});

describe('dedupe hash', () => {
  it('is stable for the same punch and different for another user', () => {
    const base = {
      vendor: 'ESSL',
      deviceSn: 'ESSL001',
      userId: '101',
      punchTime: '2026-10-30 09:05:00',
      status: '0',
      workCode: '0',
      authType: 'FINGER',
      eventId: null,
      rawBody: '101 2026-10-30 09:05:00 0 1 0',
      payloadValid: true,
    };
    expect(buildDedupeHash(base)).toBe(buildDedupeHash({ ...base, rawBody: 'retry' }));
    expect(buildDedupeHash(base)).not.toBe(buildDedupeHash({ ...base, userId: '102' }));
  });
});
