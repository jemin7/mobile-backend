import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EsslRawProcessorService } from '../essl-raw-processor/essl-raw-processor.service';

type DeviceLike = {
  id: number;
  deviceName?: string | null;
  deviceMake?: string | null;
  deviceModel?: string | null;
  deviceSN: string;
  status?: string | null;
};

export type MobilePunchInput = {
  companyId: number | null;
  employeeCode: string;
  punchedAt: string;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  address?: string | null;
  photoUrl?: string | null;
  checkType: 'CHECK_IN' | 'CHECK_OUT';
};

const PULL_INTERVAL_MS = 10_000;
const MAX_ATTEMPTS = 200;

/**
 * Links this HR backend to the external attendance receiver.
 * - Registers/updates/deactivates devices on the receiver.
 * - Forwards PWA (mobile) punches.
 * - Pulls device punches, feeds them into the existing raw-log processor, then marks them exported.
 * Dormant unless ATTENDANCE_SOURCE=receiver and RECEIVER_BASE_URL + RECEIVER_KEY are set.
 * Only creates its own tables (receiver_*); never modifies or deletes existing data.
 */
@Injectable()
export class ReceiverClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReceiverClientService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private flushing = false;
  private lastRunAt: string | null = null;
  private lastError: string | null = null;
  private lastImported = 0;
  private registeredMobile = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: EsslRawProcessorService,
  ) {}

  private get baseUrl() {
    return (process.env.RECEIVER_BASE_URL || '').trim().replace(/\/$/, '');
  }
  private get key() {
    return (process.env.RECEIVER_KEY || '').trim();
  }

  isEnabled(): boolean {
    return (
      (process.env.ATTENDANCE_SOURCE || 'local').trim().toLowerCase() === 'receiver' &&
      !!this.baseUrl &&
      !!this.key
    );
  }

  async onModuleInit() {
    if (!this.isEnabled()) {
      this.logger.log('Receiver link is OFF (ATTENDANCE_SOURCE!=receiver or key/url missing).');
      return;
    }
    await this.ensureTables();
    this.logger.log(`Receiver link ON -> ${this.baseUrl}`);
    void this.tick();
    this.timer = setInterval(() => void this.tick(), PULL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async ensureTables() {
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS receiver_outbox (
        id BIGSERIAL PRIMARY KEY,
        kind TEXT NOT NULL,
        dedupe_key TEXT NOT NULL UNIQUE,
        payload JSONB NOT NULL,
        attempts INT NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS receiver_imported_punch (
        external_id BIGINT PRIMARY KEY,
        raw_attlog_id INT,
        imported_at TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await this.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS receiver_sync_state (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )`);
  }

  // ---------------------------------------------------------------- HTTP
  private async call(method: 'GET' | 'POST', path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'X-Receiver-Key': this.key,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-json */
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${json?.error || json?.message || text.slice(0, 200)}`);
    }
    return json;
  }

  // -------------------------------------------------------------- outbox
  private async enqueue(kind: string, dedupeKey: string, payload: unknown) {
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO receiver_outbox (kind, dedupe_key, payload)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (dedupe_key)
       DO UPDATE SET payload = EXCLUDED.payload, attempts = 0, last_error = NULL, updated_at = now()`,
      kind,
      dedupeKey,
      JSON.stringify(payload),
    );
  }

  /** Never throws: failures stay queued and are retried. */
  private async safeEnqueue(kind: string, dedupeKey: string, payload: unknown) {
    if (!this.isEnabled()) return;
    try {
      await this.ensureTables();
      await this.enqueue(kind, dedupeKey, payload);
      void this.flush();
    } catch (e: any) {
      this.logger.error(`Receiver enqueue failed (${kind}): ${e?.message || e}`);
    }
  }

  async flush() {
    if (!this.isEnabled() || this.flushing) return;
    this.flushing = true;
    try {
      const rows = await this.prisma.$queryRawUnsafe<
        { id: bigint; kind: string; payload: any; attempts: number }[]
      >(`SELECT id, kind, payload, attempts FROM receiver_outbox ORDER BY id ASC LIMIT 100`);
      for (const row of rows) {
        try {
          if (row.kind === 'device') {
            const r = await this.call('POST', '/integration/att-devices/sync', row.payload);
            if (r && r.success === false) throw new Error('sync returned success=false');
          } else if (row.kind === 'mobile') {
            const r = await this.call('POST', '/mobile/punch', row.payload);
            if (r && r.success === false) throw new Error('punch returned success=false');
          }
          await this.prisma.$executeRawUnsafe(`DELETE FROM receiver_outbox WHERE id = $1`, row.id);
        } catch (e: any) {
          const msg = String(e?.message || e).slice(0, 500);
          if (row.kind === 'device' && msg.includes('duplicate_device')) {
            // Shared serial already registered by another HR device row: nothing to do.
            await this.prisma.$executeRawUnsafe(`DELETE FROM receiver_outbox WHERE id = $1`, row.id);
            continue;
          }
          this.lastError = msg;
          if (row.attempts + 1 >= MAX_ATTEMPTS) {
            this.logger.error(`Dropping outbox ${row.id} after ${MAX_ATTEMPTS} attempts: ${msg}`);
            await this.prisma.$executeRawUnsafe(`DELETE FROM receiver_outbox WHERE id = $1`, row.id);
          } else {
            await this.prisma.$executeRawUnsafe(
              `UPDATE receiver_outbox SET attempts = attempts + 1, last_error = $2, updated_at = now() WHERE id = $1`,
              row.id,
              msg,
            );
          }
          // keep ordering: a failed device registration blocks later rows this round
          if (row.kind === 'device') break;
        }
      }
    } catch (e: any) {
      this.lastError = String(e?.message || e);
    } finally {
      this.flushing = false;
    }
  }

  // ----------------------------------------------------- device registry
  private vendorOf(d: DeviceLike): 'ESSL' | 'ZKTECO' | 'DAHUA' {
    const make = `${d.deviceMake || ''} ${d.deviceModel || ''}`.toLowerCase();
    if (make.includes('zk')) return 'ZKTECO';
    if (make.includes('dahua')) return 'DAHUA';
    return 'ESSL';
  }

  /** True when another HR device row (shared physical machine) still uses this serial and is active. */
  private async otherActiveWithSerial(sn: string, exceptId: number) {
    const n = await this.prisma.devices.count({
      where: { deviceSN: sn, id: { not: exceptId }, status: 'Active' },
    });
    return n > 0;
  }

  async syncDevice(d: DeviceLike) {
    const inactive = String(d.status || 'Active').toLowerCase() !== 'active';
    if (inactive && (await this.otherActiveWithSerial(d.deviceSN, d.id))) return;
    await this.safeEnqueue('device', `device:${d.id}`, {
      source_device_id: String(d.id),
      vendor: this.vendorOf(d),
      device_sn: d.deviceSN,
      device_name: d.deviceName || d.deviceSN,
      device_model: d.deviceModel || undefined,
      status: String(d.status || 'Active').toLowerCase() === 'active' ? 1 : 0,
    });
  }

  async deactivateDevice(id: number, deviceSN?: string) {
    // A serial shared by two HR devices (same machine, two companies) must stay active.
    if (deviceSN && (await this.otherActiveWithSerial(deviceSN, id))) return;
    await this.safeEnqueue('device', `device:${id}`, {
      source_device_id: String(id),
      deleted: true,
    });
  }

  /** One-time (idempotent) backfill: register every existing device. */
  async backfillDevices() {
    const devices = await this.prisma.devices.findMany({
      select: {
        id: true,
        deviceName: true,
        deviceMake: true,
        deviceModel: true,
        deviceSN: true,
        status: true,
      },
    });
    for (const d of devices) await this.syncDevice(d as DeviceLike);
    return { queued: devices.length };
  }

  // ------------------------------------------------------- mobile punch
  async forwardMobilePunch(p: MobilePunchInput) {
    if (!this.isEnabled()) return;
    const installationId = `MOB-${p.companyId ?? 0}`;
    if (!this.registeredMobile.has(installationId)) {
      await this.safeEnqueue('device', `device:mobile-${p.companyId ?? 0}`, {
        source_device_id: `mobile-${p.companyId ?? 0}`,
        vendor: 'MOBILE',
        device_sn: installationId,
        device_name: `Mobile PWA (company ${p.companyId ?? 0})`,
        device_model: 'PWA',
        status: 1,
      });
      this.registeredMobile.add(installationId);
    }
    await this.safeEnqueue(
      'mobile',
      `mobile:${p.employeeCode}:${p.punchedAt}:${p.checkType}`,
      {
        installation_id: installationId,
        employee_code: p.employeeCode,
        punched_at: p.punchedAt,
        latitude: p.latitude ?? null,
        longitude: p.longitude ?? null,
        accuracy: p.accuracy ?? null,
        address: p.address ?? null,
        photo_url: p.photoUrl ?? null,
        check_type: p.checkType,
      },
    );
  }

  // ------------------------------------------------------ pull + import
  private async tick() {
    if (this.busy || !this.isEnabled()) return;
    this.busy = true;
    try {
      await this.flush();
      await this.pullAndImport();
      this.lastRunAt = new Date().toISOString();
    } catch (e: any) {
      this.lastError = String(e?.message || e).slice(0, 500);
      this.logger.warn(`Receiver tick failed: ${this.lastError}`);
    } finally {
      this.busy = false;
    }
  }

  private normalizePunch(v: string): string {
    return String(v || '').replace('T', ' ').replace(/(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/, '').trim();
  }

  /** Serials this installation may import. Other apps sharing the receiver keep their rows. */
  private async ownedSerials(): Promise<Set<string>> {
    const [devices, companies] = await Promise.all([
      this.prisma.devices.findMany({ select: { deviceSN: true } }),
      this.prisma.company.findMany({ select: { id: true } }),
    ]);
    const serials = new Set<string>();
    for (const device of devices) {
      const sn = String(device.deviceSN || '').trim();
      if (sn) serials.add(sn);
    }
    for (const company of companies) {
      if (Number.isFinite(company.id)) serials.add(`MOB-${company.id}`);
    }
    return serials;
  }

  async pullAndImport() {
    const owned = await this.ownedSerials();
    let afterId = 0;
    let imported = 0;
    for (let page = 0; page < 20; page++) {
      const res = await this.call(
        'GET',
        `/process-attlog?export=0&after_id=${afterId}&limit=500`,
      );
      const rows: any[] = Array.isArray(res?.data) ? res.data : [];
      if (!rows.length) break;

      const toMark: number[] = [];
      const rawIds: number[] = [];

      for (const r of rows) {
        const sn = String(r.device_sn || '').trim();
        if (!sn || !owned.has(sn)) continue;

        const extId = Number(r.id);
        if (!Number.isFinite(extId)) continue;
        toMark.push(extId);

        // PWA punches are already written locally by the HR backend.
        if (String(r.vendor).toUpperCase() === 'MOBILE') continue;

        const seen = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT 1 FROM receiver_imported_punch WHERE external_id = $1`,
          BigInt(extId),
        );
        if (seen.length) continue;

        const userId = String(r.user_id || '').trim().slice(0, 20);
        const punch = this.normalizePunch(r.punch_time);
        if (!sn || !userId || !punch) continue;

        const device = await this.prisma.devices.findFirst({
          where: { deviceSN: sn },
          select: { id: true },
        });
        const authType = r.auth_type ? String(r.auth_type).slice(0, 20) : null;

        const rawId = await this.prisma.$transaction(async (tx) => {
          const created = await tx.essl_raw_attlog.create({
            data: {
              device_sn: sn,
              request_path: `receiver:process_attlog:${extId}`,
              query_params: null,
              raw_body: `${userId} ${punch} ${r.status ?? 0} ${r.work_code ?? 0}`,
              ip_address: 'receiver',
              is_valid: true,
              log_type: device ? 'verified' : 'unverified',
              user_id: userId,
              punch_time: punch,
              auth_type: authType,
              export: 0,
            },
          });
          await tx.$executeRawUnsafe(
            `INSERT INTO receiver_imported_punch (external_id, raw_attlog_id) VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            BigInt(extId),
            created.id,
          );
          return created.id;
        });
        rawIds.push(rawId);
        imported++;
      }

      if (rawIds.length) {
        try {
          await this.processor.processPending({ rawLogIds: rawIds });
        } catch (e: any) {
          this.logger.warn(`Processing imported punches failed: ${e?.message || e}`);
        }
      }

      // Raw rows are committed locally; now tell the receiver they are exported.
      if (toMark.length) {
        await this.call('POST', '/process-attlog/mark-exported', { ids: toMark });
      }

      if (!res?.pagination?.has_more) break;
      afterId = Number(res.pagination.next_after_id ?? afterId);
      // exported rows disappear from export=0, so keep paging from the cursor anyway
    }
    this.lastImported = imported;
    return { imported };
  }

  async status() {
    let pending = 0;
    let failing: any[] = [];
    if (this.isEnabled()) {
      try {
        const c = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT count(*)::int AS n FROM receiver_outbox`,
        );
        pending = c[0]?.n ?? 0;
        failing = await this.prisma.$queryRawUnsafe<any[]>(
          `SELECT id::int AS id, kind, attempts, last_error FROM receiver_outbox WHERE attempts > 0 ORDER BY id LIMIT 20`,
        );
      } catch {
        /* tables may not exist yet */
      }
    }
    return {
      enabled: this.isEnabled(),
      baseUrl: this.baseUrl || null,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      lastImported: this.lastImported,
      outboxPending: pending,
      failing,
    };
  }
}
