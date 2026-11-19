import { parseZktecoBody, parseZktecoLine } from '../../src/vendors/zkteco/zkteco.parser';

describe('ZKTeco parser', () => {
  it('parses an ADMS attendance line', () => {
    const [punch] = parseZktecoBody('201\t2026-10-30 09:10:00\t0\t1\t0\t0\t0');
    expect(punch.userId).toBe('201');
    expect(punch.punchTime).toBe('2026-10-30 09:10:00');
    expect(punch.authType).toBe('FINGER');
    expect(punch.payloadValid).toBe(true);
  });

  it('parses several space-separated records', () => {
    const punches = parseZktecoBody('201 2026-10-30 09:10:00 0 1 0\n202 2026-10-30 09:11:00 0 0');
    expect(punches).toHaveLength(2);
    expect(punches[1].authType).toBeNull();
    expect(punches[1].workCode).toBe('0');
  });

  it('keeps a malformed payload', () => {
    expect(parseZktecoLine('bad').payloadValid).toBe(false);
    expect(parseZktecoLine('bad').payloadReason).toBe('malformed_punch');
  });
});
