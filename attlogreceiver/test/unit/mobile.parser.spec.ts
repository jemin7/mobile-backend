import { parseMobileBody } from '../../src/mobile/mobile.parser';

describe('mobile parser', () => {
  it('maps a product punch onto the receiver fields', () => {
    const parsed = parseMobileBody({
      installation_id: 'MOBILE-INSTALL-001',
      employee_code: 'EMP101',
      punched_at: '2026-10-30T09:05:00+05:30',
      check_type: 'CHECK_IN',
    });
    expect('error' in parsed).toBe(false);
    if (!('error' in parsed)) {
      expect(parsed.installationId).toBe('MOBILE-INSTALL-001');
      expect(parsed.userId).toBe('EMP101');
      expect(parsed.punchTime).toBe('2026-10-30 09:05:00');
      expect(parsed.status).toBe('CHECK_IN');
      expect(parsed.payloadValid).toBe(true);
    }
  });
});
