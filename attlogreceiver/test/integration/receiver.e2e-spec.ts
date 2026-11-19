import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/configure-app';
import { PrismaService } from '../../src/database/prisma.service';
import { PunchProcessingService } from '../../src/punch-processing/punch-processing.service';

const RECEIVER_KEY = 'test-receiver-key';

describe('ATTLOG receiver', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let processing: PunchProcessingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ bodyParser: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    processing = app.get(PunchProcessingService);
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE process_attlog, raw_attlog, att_devices, admin_audit_log RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();
  const http = () => request(server());
  const admin = (method: 'get' | 'post' | 'patch', url: string) =>
    http()[method](url).set('Authorization', 'Bearer test-admin-secret');

  async function register(body: Record<string, unknown>) {
    const response = await http()
      .post('/att-devices')
      .set('Authorization', 'Bearer test-admin-secret')
      .send(body);
    expect(response.status).toBe(201);
    return response.body;
  }

  it('registers devices, rejects a duplicate serial, and deactivates instead of deleting', async () => {
    await register({ vendor: 'ESSL', device_sn: 'ESSL001', device_name: 'Main Gate', status: 1 });
    await register({ vendor: 'ZKTECO', device_sn: 'ZK001', device_name: 'Office', status: 1 });
    await register({ vendor: 'DAHUA', device_sn: 'DH001', device_name: 'Reception', status: 1 });
    await register({ vendor: 'MOBILE', device_sn: 'MOB-001', device_name: 'Mobile', status: 1 });
    const duplicate = await admin('post', '/att-devices').send({
      vendor: 'ZKTECO',
      device_sn: 'ESSL001',
      device_name: 'Again',
    });
    expect(duplicate.status).toBe(409);
    const listed = await admin('get', '/att-devices').query({ vendor: 'ESSL' });
    expect(listed.body.data).toHaveLength(1);
    const id = listed.body.data[0].id;
    const deactivated = await admin('patch', `/att-devices/${id}/status`).send({ status: 0 });
    expect(deactivated.body.data.status).toBe(0);
    await admin('patch', `/att-devices/${id}/status`).send({ status: 1 });
  });

  it('receives eSSL punches on the brand URL and acknowledges duplicates', async () => {
    await register({ vendor: 'ESSL', device_sn: 'ESSL001', device_name: 'Main Gate' });
    await register({ vendor: 'ESSL', device_sn: 'ESSL002', device_name: 'Factory' });
    const body = '101 2026-10-30 09:05:00 0 1 0\n102 2026-10-30 09:10:00 0 0\n103 2026-10-30 09:15:00 0 15 0';
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send(body)
      .expect(200)
      .expect('OK');
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send(body)
      .expect(200)
      .expect('OK');
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL002&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('104 2026-10-30 09:20:00 0 1 0')
      .expect('OK');
    expect(await processing.processAvailable()).toBe(4);
    const pulled = await request(server()).get('/process-attlog').set('X-Receiver-Key', RECEIVER_KEY);
    expect(pulled.body.data).toHaveLength(4);
    expect(pulled.body.data[0]).toMatchObject({
      vendor: 'ESSL',
      device_sn: 'ESSL001',
      user_id: '101',
      punch_time: '2026-10-30T09:05:00',
      auth_type: 'FINGER',
      export: 0,
    });
    expect(pulled.body.data[1].auth_type).toBeNull();
    expect(pulled.body.data[2].auth_type).toBe('FACE');
    expect(pulled.body.data.map((row: { user_id: string }) => row.user_id)).toContain('104');
    await request(server()).get('/process-attlog').set('X-Receiver-Key', 'wrong-key').expect(401);
    const exported = await request(server())
      .post('/process-attlog/mark-exported')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({ ids: [pulled.body.data[0].id] });
    expect(exported.body.updated).toBe(1);
    const again = await request(server()).get('/process-attlog').set('X-Receiver-Key', RECEIVER_KEY);
    expect(again.body.data.map((row: { user_id: string }) => row.user_id)).toEqual(['102', '103', '104']);
    expect(await prisma.rawAttlog.count()).toBe(4);
    expect(await prisma.rawAttlog.findFirst({ where: { userId: '101' } })).toMatchObject({
      duplicateCount: 1,
      processingStatus: 'PROCESSED',
    });
  });

  it('keeps unknown, inactive, mismatched, and invalid punches out of process_attlog', async () => {
    await register({ vendor: 'ESSL', device_sn: 'ESSL001', device_name: 'Main' });
    await register({ vendor: 'ZKTECO', device_sn: 'ZK001', device_name: 'Side', status: 0 });
    await register({ vendor: 'ZKTECO', device_sn: 'ZK002', device_name: 'Mismatch' });
    await request(server())
      .post('/essl/cdata.aspx?SN=UNKNOWN01&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('102 2026-10-30 09:10:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/zkteco/cdata.aspx?SN=ZK001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('202 2026-10-30 09:10:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/essl/cdata.aspx?SN=ZK002&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('203 2026-10-30 09:10:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('101 2026-13-40 09:05:00 0 1 0')
      .expect('OK');
    expect(await processing.processAvailable()).toBe(0);
    const reasons = await prisma.rawAttlog.findMany({ orderBy: { id: 'asc' } });
    expect(reasons.map((row) => row.verificationReason)).toEqual([
      'device_not_registered',
      'device_inactive',
      'vendor_mismatch',
      'invalid_timestamp',
    ]);
    expect(await prisma.processAttlog.count()).toBe(0);
  });

  it('retries a failed punch and reprocesses a punch after the device is registered', async () => {
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL009&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('101 2026-10-30 09:05:00 0 1 0')
      .expect('OK');
    const quarantined = await prisma.rawAttlog.findFirstOrThrow();
    expect(quarantined.processingStatus).toBe('QUARANTINED');
    await register({ vendor: 'ESSL', device_sn: 'ESSL009', device_name: 'Later' });
    const reprocessed = await admin('post', '/admin/raw-attlog/reprocess').send({ device_sn: 'ESSL009' });
    expect(reprocessed.body.processed).toBe(1);
    expect(await prisma.processAttlog.count()).toBe(1);
    expect(await prisma.adminAuditLog.count({ where: { action: 'reprocess' } })).toBe(1);

    await prisma.processAttlog.deleteMany();
    await prisma.rawAttlog.update({
      where: { id: quarantined.id },
      data: { processingStatus: 'FAILED', logType: 'verified', isValid: true, retryCount: 1 },
    });
    expect(await processing.retryFailedPunches()).toBe(1);
    expect(await processing.processAvailable()).toBe(1);
    expect(await prisma.processAttlog.count()).toBe(1);
  });

  it('receives ZKTeco lines and stores a malformed line', async () => {
    await register({ vendor: 'ZKTECO', device_sn: 'ZK100', device_name: 'Gate' });
    await request(server())
      .post('/zkteco/cdata.aspx?SN=ZK100&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('201\t2026-10-30 09:10:00\t0\t1\t0\nbad-line')
      .expect('OK');
    expect(await processing.processAvailable()).toBe(1);
    const pull = await request(server()).get('/process-attlog').set('X-Receiver-Key', RECEIVER_KEY);
    expect(pull.body.data).toHaveLength(1);
    expect(pull.body.data[0].user_id).toBe('201');
    const invalid = await prisma.rawAttlog.findFirst({ where: { isValid: false } });
    expect(invalid?.processingStatus).toBe('INVALID');
    await request(server())
      .post('/zkteco/cdata.aspx?SN=NO-SUCH&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('201\t2026-10-30 09:12:00\t0\t1\t0')
      .expect('OK');
    const unknown = await prisma.rawAttlog.findFirst({ where: { deviceSn: 'NO-SUCH' } });
    expect(unknown?.processingStatus).toBe('QUARANTINED');
  });

  it('receives Dahua pulses, ignores alarms, and falls back to the only device', async () => {
    await register({ vendor: 'DAHUA', device_sn: 'DH001', device_name: 'Reception' });
    await request(server())
      .post('/dahua/event')
      .auth('dahua', 'dahua-secret')
      .send({
        Code: 'AccessControl',
        Action: 'Pulse',
        Data: { UserID: '101', RealUTC: '2026-10-30T03:35:00Z', SN: 'DH001' },
      })
      .expect(200);
    await request(server())
      .post('/dahua/event')
      .auth('dahua', 'dahua-secret')
      .send({ Code: 'VideoMotion', Action: 'Start', Data: { SN: 'DH001' } })
      .expect(200);
    await request(server())
      .post('/dahua/event')
      .auth('dahua', 'dahua-secret')
      .send({
        Code: 'AccessControl',
        Action: 'Pulse',
        Data: { UserID: '88', RealUTC: '2026-10-30T03:40:00Z' },
      })
      .expect(200);
    await request(server())
      .post('/html/dahua/dahua-listener.php')
      .auth('dahua', 'dahua-secret')
      .set('Content-Type', 'text/plain')
      .send('{not-json')
      .expect(200);
    expect(await processing.processAvailable()).toBe(2);
    const punches = await prisma.processAttlog.findMany({ orderBy: { id: 'asc' } });
    expect(punches.map((row) => row.userId)).toEqual(['101', '88']);
    expect(punches.every((row) => row.deviceSn === 'DH001')).toBe(true);
    expect(punches[0].punchTime.toISOString().slice(0, 19)).toBe('2026-10-30T09:05:00');
    const ignored = await prisma.rawAttlog.findFirst({ where: { verificationReason: 'non_attendance_event' } });
    expect(ignored).toBeTruthy();
    const malformed = await prisma.rawAttlog.findFirst({ where: { verificationReason: { contains: 'malformed_json' } } });
    expect(malformed?.processingStatus).toBe('INVALID');
  });

  it('stores a mobile punch for the receiver key and rejects a wrong key', async () => {
    await register({ vendor: 'MOBILE', device_sn: 'MOB-001', device_name: 'Phone' });
    await request(server())
      .post('/mobile/punch')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        installation_id: 'MOB-001',
        employee_code: 'EMP101',
        punched_at: '2026-10-30T09:05:00+05:30',
        check_type: 'CHECK_IN',
      })
      .expect(201);
    const denied = await request(server())
      .post('/mobile/punch')
      .set('X-Receiver-Key', 'wrong-key')
      .send({
        installation_id: 'MOB-001',
        employee_code: 'EMP101',
        punched_at: '2026-10-30T09:06:00+05:30',
      });
    expect(denied.status).toBe(401);
    expect(await processing.processAvailable()).toBe(1);
    const row = await prisma.processAttlog.findFirstOrThrow();
    expect(row.userId).toBe('EMP101');
    expect(row.authType).toBe('GPS');
    expect(row.vendor).toBe('MOBILE');
  });

  it('serves admin reports and health', async () => {
    await register({ vendor: 'ESSL', device_sn: 'ESSL001', device_name: 'Main' });
    await request(server())
      .post('/essl/cdata.aspx?SN=ESSL001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('101 2026-10-30 09:05:00 0 1 0\nbad')
      .expect('OK');
    await request(server())
      .post('/essl/cdata.aspx?SN=GHOST&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('102 2026-10-30 09:06:00 0 1 0')
      .expect('OK');
    await processing.processAvailable();
    const summary = await admin('get', '/admin/reports/summary');
    expect(summary.body.data.total_raw).toBe(3);
    expect(summary.body.data.total_processed).toBe(1);
    expect(summary.body.data.total_unverified).toBeGreaterThan(0);
    expect(summary.body.data.by_software).toBeUndefined();
    const unverified = await admin('get', '/admin/raw-attlog').query({ log_type: 'unverified' });
    expect(unverified.body.data.length).toBeGreaterThan(0);
    const invalid = await admin('get', '/admin/reports/invalid-punches');
    expect(invalid.body.data.some((row: { processing_status: string }) => row.processing_status === 'INVALID')).toBe(true);
    const raw = await admin('get', '/admin/reports/raw-punches').query({
      vendor: 'ESSL',
      from_date: '2026-10-01',
      to_date: '2026-10-30',
    });
    expect(raw.body.data.length).toBe(3);
    const processed = await admin('get', '/admin/reports/processed-punches').query({ device_sn: 'ESSL001' });
    expect(processed.body.data).toHaveLength(1);
    await request(server()).get('/health').expect(200);
    await request(server()).get('/process-attlog').expect(401);
  });

  it('syncs one device row and rejects a second serial owner', async () => {
    const created = await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        source_device_id: 'hrm-42',
        vendor: 'ESSL',
        device_sn: 'SYNC1',
        device_name: 'Gate',
        status: 1,
      })
      .expect(201);
    expect(created.body.action).toBe('created');

    const updated = await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        source_device_id: 'hrm-42',
        vendor: 'ESSL',
        device_sn: 'SYNC1B',
        device_name: 'Gate B',
        status: 1,
      })
      .expect(201);
    expect(updated.body.action).toBe('updated');
    expect(updated.body.data.id).toBe(created.body.data.id);
    expect(updated.body.data.device_sn).toBe('SYNC1B');
    expect(await prisma.attDevice.count({ where: { sourceDeviceId: 'hrm-42' } })).toBe(1);

    await register({ vendor: 'ZKTECO', device_sn: 'OLDZK', device_name: 'Old' });
    const attached = await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        source_device_id: 'hrm-old',
        vendor: 'ZKTECO',
        device_sn: 'OLDZK',
        device_name: 'Old linked',
      })
      .expect(201);
    expect(attached.body.action).toBe('updated');
    expect(attached.body.data.source_device_id).toBe('hrm-old');

    await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', 'wrong-key')
      .send({
        source_device_id: 'hrm-99',
        vendor: 'ESSL',
        device_sn: 'OTHER',
        device_name: 'Other',
      })
      .expect(401);

    const deactivated = await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({ source_device_id: 'hrm-42', deleted: true })
      .expect(201);
    expect(deactivated.body.action).toBe('deactivated');
    expect(deactivated.body.data.status).toBe(0);
    expect(await prisma.attDevice.findFirst({ where: { sourceDeviceId: 'hrm-42' } })).toBeTruthy();

    const cross = await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        source_device_id: 'hrm-9',
        vendor: 'ESSL',
        device_sn: 'OLDZK',
        device_name: 'Taken',
      });
    expect(cross.status).toBe(409);

    const adminCross = await admin('post', '/att-devices').send({
      vendor: 'ZKTECO',
      device_sn: 'SYNC1B',
      device_name: 'Taken too',
    });
    expect(adminCross.status).toBe(409);
  });

  it('routes generic iclock punches by serial and keeps unknown punches quarantined', async () => {
    await register({ vendor: 'ESSL', device_sn: 'ESSL001', device_name: 'Main' });
    await register({ vendor: 'ESSL', device_sn: 'ESSL002', device_name: 'Factory' });
    await register({ vendor: 'ZKTECO', device_sn: 'ZK001', device_name: 'Office' });
    await register({ vendor: 'ESSL', device_sn: 'ESSL-OFF', device_name: 'Off', status: 0 });
    await register({
      vendor: 'ESSL',
      device_sn: 'DEDIP',
      device_name: 'Dedicated',
      metadata: { dedicated_ip: '203.0.113.10' },
    });

    await request(server())
      .post('/iclock/cdata.aspx?SN=LATE&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('401 2026-10-30 09:01:00 0 1 0')
      .expect('OK');

    await request(server())
      .post('/integration/att-devices/sync')
      .set('X-Receiver-Key', RECEIVER_KEY)
      .send({
        source_device_id: 'late-1',
        vendor: 'ESSL',
        device_sn: 'LATE',
        device_name: 'Late',
      })
      .expect(201);

    await request(server())
      .post('/iclock/cdata.aspx?SN=ESSL001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('101 2026-10-30 09:05:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?SN=ESSL002&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('102 2026-10-30 09:06:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?SN=ZK001&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('301\t2026-10-30 09:07:00\t0\t1\t0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?SN=ESSL-OFF&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('103 2026-10-30 09:08:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?SN=GHOST&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('999 2026-10-30 09:09:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('888 2026-10-30 09:10:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .set('X-Forwarded-For', '203.0.113.10')
      .send('501 2026-10-30 09:11:00 0 1 0')
      .expect('OK');
    await request(server())
      .post('/iclock/cdata.aspx?SN=LATE&table=ATTLOG')
      .set('Content-Type', 'text/plain')
      .send('402 2026-10-30 09:12:00 0 1 0')
      .expect('OK');

    const handshake = await request(server()).get('/iclock/cdata.aspx?SN=ESSL001&options=all');
    expect(handshake.text).toContain('GET OPTION FROM: ESSL001');
    expect(await processing.processAvailable()).toBe(5);

    const pulled = await request(server()).get('/process-attlog').set('X-Receiver-Key', RECEIVER_KEY);
    expect(pulled.body.data.map((row: { user_id: string }) => row.user_id).sort()).toEqual([
      '101',
      '102',
      '301',
      '402',
      '501',
    ]);
    const zk = await prisma.processAttlog.findFirst({ where: { userId: '301' } });
    expect(zk?.vendor).toBe('ZKTECO');
    expect(zk?.authType).toBe('FINGER');

    const early = await prisma.rawAttlog.findFirst({ where: { userId: '401' } });
    expect(early?.processingStatus).toBe('QUARANTINED');
    const ghost = await prisma.rawAttlog.findFirst({ where: { deviceSn: 'GHOST' } });
    expect(ghost?.vendor).toBe('UNKNOWN');
    expect(ghost?.processingStatus).toBe('QUARANTINED');
    expect(ghost?.verificationReason).toContain('device_not_registered');
    const inactive = await prisma.rawAttlog.findFirst({ where: { deviceSn: 'ESSL-OFF', userId: '103' } });
    expect(inactive?.processingStatus).toBe('QUARANTINED');
    expect(inactive?.verificationReason).toBe('device_inactive');
    const missing = await prisma.rawAttlog.findFirst({ where: { userId: '888' } });
    expect(missing?.deviceSn).toBe('UNKNOWN');
    expect(missing?.verificationReason).toContain('missing_serial');
  });
});
