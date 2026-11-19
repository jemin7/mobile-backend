import { parseDahuaBody } from '../../src/vendors/dahua/dahua.parser';

describe('Dahua parser', () => {
  it('converts an AccessControl pulse from UTC', () => {
    const parsed = parseDahuaBody(
      JSON.stringify({
        Code: 'AccessControl',
        Action: 'Pulse',
        Data: { UserID: '101', RealUTC: '2026-10-30T03:35:00Z', SN: 'DH001' },
      }),
    );
    expect(parsed.kind).toBe('punch');
    if (parsed.kind === 'punch') {
      expect(parsed.userId).toBe('101');
      expect(parsed.serial).toBe('DH001');
      expect(parsed.punchTime).toBe('2026-10-30 09:05:00');
      expect(parsed.payloadValid).toBe(true);
    }
  });

  it('ignores unrelated events', () => {
    const parsed = parseDahuaBody(JSON.stringify({ Code: 'VideoMotion', Action: 'Start' }));
    expect(parsed.kind).toBe('ignored');
  });

  it('accepts a pulse without a serial', () => {
    const parsed = parseDahuaBody(
      JSON.stringify({
        Code: 'AccessControl',
        Action: 'Pulse',
        Data: { UserID: '101', UTC: '2026-10-30T03:35:00Z' },
      }),
    );
    expect(parsed.kind).toBe('punch');
    if (parsed.kind === 'punch') {
      expect(parsed.serial).toBeNull();
    }
  });

  it('preserves invalid JSON', () => {
    const parsed = parseDahuaBody('{not-json');
    expect(parsed.kind).toBe('invalid');
  });

  it('reads the plain text event cameras send', () => {
    const parsed = parseDahuaBody(
      'Code=AccessControl;action=Pulse;index=0;data={"UserID":"101","RealUTC":"2026-10-30T03:35:00Z","SN":"DH001"}',
    );
    expect(parsed.kind).toBe('punch');
    if (parsed.kind === 'punch') {
      expect(parsed.userId).toBe('101');
      expect(parsed.serial).toBe('DH001');
      expect(parsed.punchTime).toBe('2026-10-30 09:05:00');
    }
  });
});
