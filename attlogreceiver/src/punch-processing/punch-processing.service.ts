import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, RawAttlog } from '@prisma/client';
import { isVendor } from '../common/enums';
import { wallClockToDate } from '../common/time/time.util';
import { PrismaService } from '../database/prisma.service';
import { DevicesService } from '../devices/devices.service';
import { parseDahuaBody } from '../vendors/dahua/dahua.parser';
import { parseEsslLine } from '../vendors/essl/essl.parser';
import { parseZktecoLine } from '../vendors/zkteco/zkteco.parser';
import { parseMobileBody } from '../mobile/mobile.parser';

export type ProcessOutcome = 'empty' | 'processed' | 'reclassified' | 'failed' | 'skipped';

type LockedRow = RawAttlog;

@Injectable()
export class PunchProcessingService {
  private readonly logger = new Logger(PunchProcessingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
  ) {}

  async processRawPunch(id: bigint): Promise<ProcessOutcome> {
    return this.processId(id);
  }

  async processAvailable(limit?: number): Promise<number> {
    const batch = limit ?? Number(process.env.WORKER_BATCH_SIZE || 50);
    let processed = 0;
    for (let index = 0; index < batch; index += 1) {
      const outcome = await this.processNext();
      if (outcome === 'empty') {
        break;
      }
      if (outcome === 'processed') {
        processed += 1;
      }
    }
    return processed;
  }

  validateDevice(input: { vendor: string; deviceSn: string }) {
    if (!isVendor(input.vendor)) {
      return Promise.resolve({
        verified: false,
        reason: 'vendor_mismatch',
      });
    }
    return this.devices.verify({
      vendor: input.vendor,
      deviceSn: input.deviceSn,
    });
  }

  validatePayload(row: Pick<RawAttlog, 'userId' | 'punchTime' | 'isValid'>): {
    valid: boolean;
    reason: string | null;
  } {
    if (!row.userId) {
      return { valid: false, reason: 'missing_user_id' };
    }
    if (!row.punchTime) {
      return { valid: false, reason: 'invalid_timestamp' };
    }
    try {
      wallClockToDate(row.punchTime);
    } catch {
      return { valid: false, reason: 'invalid_timestamp' };
    }
    if (!row.isValid) {
      return { valid: false, reason: 'invalid_payload' };
    }
    return { valid: true, reason: null };
  }

  async createProcessedPunch(tx: Prisma.TransactionClient, row: RawAttlog): Promise<void> {
    if (!row.userId || !row.punchTime) {
      throw new Error('incomplete_punch');
    }
    try {
      await tx.processAttlog.create({
        data: {
          rawAttlogId: row.id,
          vendor: row.vendor,
          deviceSn: row.deviceSn,
          userId: row.userId,
          punchTime: wallClockToDate(row.punchTime),
          sourcePunchTime: row.sourcePunchTime,
          status: row.status,
          workCode: row.workCode,
          authType: row.authType,
          export: 0,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return;
      }
      throw error;
    }
  }

  async markRawProcessed(tx: Prisma.TransactionClient, id: bigint): Promise<void> {
    await tx.rawAttlog.update({
      where: { id },
      data: {
        processingStatus: 'PROCESSED',
        processedAt: new Date(),
        lastError: null,
        logType: 'verified',
        isValid: true,
        verificationReason: null,
      },
    });
  }

  async markRawFailed(id: bigint, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : 'processing_failed';
    await this.prisma.rawAttlog.update({
      where: { id },
      data: {
        processingStatus: 'FAILED',
        lastError: message.slice(0, 2000),
        retryCount: { increment: 1 },
      },
    });
    this.logger.error(`processing failed id=${id.toString()} ${message}`);
  }

  async retryFailedPunches(): Promise<number> {
    const maxRetries = Number(process.env.PROCESSING_MAX_RETRIES || 5);
    const result = await this.prisma.rawAttlog.updateMany({
      where: {
        processingStatus: 'FAILED',
        retryCount: { lt: maxRetries },
        isValid: true,
        logType: 'verified',
      },
      data: { processingStatus: 'PENDING', lastError: null },
    });
    return result.count;
  }

  async reprocessUnverifiedPunches(input: {
    ids?: bigint[];
    vendor?: string;
    deviceSn?: string;
    from?: Date;
    to?: Date;
  }) {
    if (!input.ids?.length && !input.deviceSn && !(input.vendor && input.from && input.to)) {
      throw new BadRequestException('reprocess_filter_required');
    }
    const rows = await this.prisma.rawAttlog.findMany({
      where: {
        processingStatus: { in: ['QUARANTINED', 'FAILED', 'INVALID'] },
        ...(input.ids?.length ? { id: { in: input.ids } } : {}),
        ...(input.vendor ? { vendor: input.vendor } : {}),
        ...(input.deviceSn ? { deviceSn: input.deviceSn } : {}),
        ...(input.from || input.to
          ? {
              createdAt: {
                ...(input.from ? { gte: input.from } : {}),
                ...(input.to ? { lte: input.to } : {}),
              },
            }
          : {}),
      },
      orderBy: { id: 'asc' },
      take: 500,
    });

    let pending = 0;
    let quarantined = 0;
    let invalid = 0;
    for (const row of rows) {
      const status = await this.reclassify(row);
      if (status === 'PENDING') {
        pending += 1;
      } else if (status === 'QUARANTINED') {
        quarantined += 1;
      } else {
        invalid += 1;
      }
    }
    const processed = await this.processAvailable(rows.length || 1);
    return {
      success: true,
      examined: rows.length,
      pending,
      quarantined,
      invalid,
      processed,
    };
  }

  private async processNext(): Promise<ProcessOutcome> {
    let claimed: bigint | null = null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id
          FROM raw_attlog
          WHERE processing_status = 'PENDING'
            AND log_type = 'verified'
            AND is_valid = true
          ORDER BY id
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `;
        if (locked.length === 0) {
          return 'empty';
        }
        const lockedId = BigInt(locked[0].id);
        claimed = lockedId;
        const row = await tx.rawAttlog.findUnique({ where: { id: lockedId } });
        if (!row) {
          return 'empty';
        }
        const outcome = await this.handleLocked(tx, row);
        claimed = null;
        return outcome;
      });
    } catch (error) {
      if (claimed) {
        await this.markRawFailed(claimed, error);
      }
      return 'failed';
    }
  }

  private async processId(id: bigint): Promise<ProcessOutcome> {
    let claimed: bigint | null = null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id
          FROM raw_attlog
          WHERE id = ${id}
            AND processing_status = 'PENDING'
          FOR UPDATE SKIP LOCKED
        `;
        if (locked.length === 0) {
          return 'skipped';
        }
        claimed = id;
        const row = await tx.rawAttlog.findUnique({ where: { id } });
        if (!row) {
          return 'skipped';
        }
        const outcome = await this.handleLocked(tx, row);
        claimed = null;
        return outcome;
      });
    } catch (error) {
      if (claimed) {
        await this.markRawFailed(claimed, error);
      }
      return 'failed';
    }
  }

  private async handleLocked(tx: Prisma.TransactionClient, row: LockedRow): Promise<ProcessOutcome> {
    const device = await this.validateDevice({
      vendor: row.vendor,
      deviceSn: row.deviceSn,
    });
    const payload = this.validatePayload(row);
    if (!payload.valid) {
      await tx.rawAttlog.update({
        where: { id: row.id },
        data: {
          isValid: false,
          logType: device.verified ? 'verified' : 'unverified',
          processingStatus: 'INVALID',
          verificationReason: [device.reason, payload.reason].filter(Boolean).join('; '),
        },
      });
      return 'reclassified';
    }
    if (!device.verified) {
      await tx.rawAttlog.update({
        where: { id: row.id },
        data: {
          logType: 'unverified',
          processingStatus: 'QUARANTINED',
          verificationReason: device.reason,
        },
      });
      return 'reclassified';
    }
    await this.createProcessedPunch(tx, row);
    await this.markRawProcessed(tx, row.id);
    return 'processed';
  }

  private async reclassify(row: RawAttlog): Promise<string> {
    const reparsed = this.reparse(row);
    const vendor = isVendor(row.vendor) ? row.vendor : null;
    const device = vendor
      ? await this.validateDevice({
          vendor,
          deviceSn: reparsed.deviceSn || row.deviceSn,
        })
      : { verified: false, reason: 'vendor_mismatch' };
    const payloadValid = reparsed.payloadValid;
    let processingStatus = 'PENDING';
    let logType = 'verified';
    let reason: string | null = null;
    if (!payloadValid) {
      processingStatus = 'INVALID';
      logType = device.verified ? 'verified' : 'unverified';
      reason = [device.reason, reparsed.payloadReason].filter(Boolean).join('; ');
    } else if (!device.verified) {
      processingStatus = 'QUARANTINED';
      logType = 'unverified';
      reason = device.reason;
    }
    const before = {
      processing_status: row.processingStatus,
      log_type: row.logType,
      is_valid: row.isValid,
      verification_reason: row.verificationReason,
    };
    await this.prisma.$transaction([
      this.prisma.rawAttlog.update({
        where: { id: row.id },
        data: {
          userId: reparsed.userId,
          sourcePunchTime: reparsed.sourcePunchTime,
          punchTime: reparsed.punchTime,
          status: reparsed.status,
          workCode: reparsed.workCode,
          authType: reparsed.authType,
          deviceSn: reparsed.deviceSn || row.deviceSn,
          isValid: payloadValid,
          logType,
          processingStatus,
          verificationReason: reason,
          lastError: null,
          retryCount: 0,
        },
      }),
      this.prisma.adminAuditLog.create({
        data: {
          action: 'reprocess',
          actor: 'admin',
          targetType: 'raw_attlog',
          targetId: row.id.toString(),
          details: {
            before,
            after: {
              processing_status: processingStatus,
              log_type: logType,
              is_valid: payloadValid,
              verification_reason: reason,
            },
          },
        },
      }),
    ]);
    return processingStatus;
  }

  private reparse(row: RawAttlog): {
    userId: string | null;
    sourcePunchTime: string | null;
    punchTime: string | null;
    status: string | null;
    workCode: string | null;
    authType: string | null;
    deviceSn: string | null;
    payloadValid: boolean;
    payloadReason: string | null;
  } {
    const body = row.rawBody ?? '';
    if (row.verificationReason === 'non_attendance_event') {
      return {
        userId: row.userId,
        sourcePunchTime: row.sourcePunchTime,
        punchTime: row.punchTime,
        status: row.status,
        workCode: row.workCode,
        authType: row.authType,
        deviceSn: row.deviceSn,
        payloadValid: false,
        payloadReason: 'non_attendance_event',
      };
    }
    if (row.vendor === 'ESSL') {
      const parsed = parseEsslLine(body);
      return { ...this.fromLine(parsed), deviceSn: row.deviceSn };
    }
    if (row.vendor === 'ZKTECO') {
      const parsed = parseZktecoLine(body);
      return { ...this.fromLine(parsed), deviceSn: row.deviceSn };
    }
    if (row.vendor === 'DAHUA') {
      const parsed = parseDahuaBody(body);
      if (parsed.kind !== 'punch') {
        return {
          userId: null,
          sourcePunchTime: null,
          punchTime: null,
          status: null,
          workCode: null,
          authType: null,
          deviceSn: row.deviceSn,
          payloadValid: false,
          payloadReason: parsed.kind === 'invalid' ? parsed.reason : 'non_attendance_event',
        };
      }
      return {
        userId: parsed.userId,
        sourcePunchTime: parsed.sourcePunchTime,
        punchTime: parsed.punchTime,
        status: null,
        workCode: null,
        authType: null,
        deviceSn: parsed.serial || row.deviceSn,
        payloadValid: parsed.payloadValid,
        payloadReason: parsed.payloadReason,
      };
    }
    if (row.vendor === 'MOBILE') {
      let json: unknown = null;
      try {
        json = JSON.parse(body);
      } catch {
        json = null;
      }
      const parsed = parseMobileBody(json);
      if ('error' in parsed) {
        return {
          userId: row.userId,
          sourcePunchTime: row.sourcePunchTime,
          punchTime: row.punchTime,
          status: row.status,
          workCode: row.workCode,
          authType: row.authType,
          deviceSn: row.deviceSn,
          payloadValid: false,
          payloadReason: 'malformed_json',
        };
      }
      return {
        userId: parsed.userId,
        sourcePunchTime: parsed.sourcePunchTime,
        punchTime: parsed.punchTime,
        status: parsed.status,
        workCode: null,
        authType: 'GPS',
        deviceSn: parsed.installationId,
        payloadValid: parsed.payloadValid,
        payloadReason: parsed.payloadReason,
      };
    }
    return {
      userId: row.userId,
      sourcePunchTime: row.sourcePunchTime,
      punchTime: row.punchTime,
      status: row.status,
      workCode: row.workCode,
      authType: row.authType,
      deviceSn: row.deviceSn,
      payloadValid: false,
      payloadReason: 'unsupported_vendor',
    };
  }

  private fromLine(parsed: {
    userId: string | null;
    sourcePunchTime: string | null;
    punchTime: string | null;
    status: string | null;
    workCode: string | null;
    authType: string | null;
    payloadValid: boolean;
    payloadReason: string | null;
  }) {
    return {
      userId: parsed.userId,
      sourcePunchTime: parsed.sourcePunchTime,
      punchTime: parsed.punchTime,
      status: parsed.status,
      workCode: parsed.workCode,
      authType: parsed.authType,
      payloadValid: parsed.payloadValid,
      payloadReason: parsed.payloadReason,
    };
  }
}
