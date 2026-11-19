import { mapEsslVerifyMode, parseEsslBody, parseEsslLine } from '../../src/vendors/essl/essl.parser';

describe('ESSL parser', () => {
  it('maps verify modes', () => {
    expect(mapEsslVerifyMode('0')).toBe('PIN');
    expect(mapEsslVerifyMode('3')).toBe('PIN');
    expect(mapEsslVerifyMode('1')).toBe('FINGER');
    expect(mapEsslVerifyMode('2')).toBe('CARD');
    expect(mapEsslVerifyMode('4')).toBe('CARD');
    expect(mapEsslVerifyMode('15')).toBe('FACE');
    expect(mapEsslVerifyMode('9')).toBeNull();
    expect(mapEsslVerifyMode(null)).toBeNull();
  });

  it('parses one six-field punch', () => {
    const [punch] = parseEsslBody('101 2026-10-30 09:05:00 0 1 0');
    expect(punch.userId).toBe('101');
    expect(punch.punchTime).toBe('2026-10-30 09:05:00');
    expect(punch.status).toBe('0');
    expect(punch.authType).toBe('FINGER');
    expect(punch.workCode).toBe('0');
    expect(punch.payloadValid).toBe(true);
  });

  it('parses multiple lines and a five-field record', () => {
    const punches = parseEsslBody(
      '101 2026-10-30 09:05:00 0 1 0\n102\t2026-10-30 09:10:00\t0\t2\t0\n103 2026-10-30 09:15:00 0 0\n',
    );
    expect(punches).toHaveLength(3);
    expect(punches[1].authType).toBe('CARD');
    expect(punches[2].authType).toBeNull();
    expect(punches[2].workCode).toBe('0');
    expect(punches[2].payloadValid).toBe(true);
  });

  it('keeps a malformed line', () => {
    const punch = parseEsslLine('not-a-punch');
    expect(punch.payloadValid).toBe(false);
    expect(punch.payloadReason).toBe('malformed_punch');
  });

  it('rejects a missing user and a bad timestamp', () => {
    expect(parseEsslLine('\t2026-10-30 09:05:00\t0\t1\t0').payloadReason).toBe('missing_user_id');
    expect(parseEsslLine('101 2026-13-30 09:05:00 0 1 0').payloadReason).toBe('invalid_timestamp');
  });
});
