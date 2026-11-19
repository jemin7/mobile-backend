import { Injectable, Logger } from '@nestjs/common';
import { Prisma, RawAttlog } from '@prisma/client';
import { LogType, ProcessingStatus, Vendor } from '../common/enums';
import { buildDedupeHash } from '../common/helpers/dedupe';
import { clampText } from '../common/helpers/security';
import { kolkataDayRange } from '../common/time/time.util';
import { PrismaService } from '../database/prisma.service';
import { DeviceVerification, DevicesService } from '../devices/devices.service';
import { RawLogQueryDto } from './dto/raw-log-query.dto';

export type IngestEvent = {
  rawBody: string;
  userId: string | null;
  sourcePunchTime: string | null;
  punchTime: string | null;
  status: string | null;
  workCode: string | null;
  authType: string | null;
  eventId: string | null;
  payloadValid: boolean;
  payloadReason: string | null;
  nonAttendance?: boolean;
  dedupeIdentity?: string | null;
};

export type IngestRequest = {
  vendor: string;
  deviceSn: string;
  requestPath: string;
  queryParams: Record<string, string>;
  ipAddress: string;
  events: IngestEvent[];
  forcedReason?: string;
};

export type IngestResult = {
  inserted: number;
  duplicates: number;
  records: Array<{
    id: bigint;
    duplicate: boolean;
    processingStatus: string;
    logType: string;
    isValid: boolean;
  }>;
};

@Injectable()
export class RawLogService {
  private readonly logger = new Logger(RawLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly devices: DevicesService,
  ) {}

  async ingest(request: IngestRequest): Promise<IngestResult> {
    if (request.events.length === 0) {
      return { inserted: 0, duplicates: 0, records: [] };
    }

    const verification = request.forcedReason
      ? { verified: false, reason: request.forcedReason }
      : await this.devices.verify({
          vendor: request.vendor as Vendor,
          deviceSn: request.deviceSn,
        });

    const result = await this.prisma.$transaction(async (tx) => {
      const records: IngestResult['records'] = [];
      let inserted = 0;
      let duplicates = 0;
      for (const event of request.events) {
        const outcome = await this.storeEvent(tx, request, verification, event, Boolean(request.forcedReason));
        records.push(outcome.record);
        if (outcome.duplicate) {
          duplicates += 1;
        } else {
          inserted += 1;
        }
      }
      return { inserted, duplicates, records };
    });

    this.logger.log(
      `stored vendor=${request.vendor} sn=${request.deviceSn} inserted=${result.inserted} duplicates=${result.duplicates}`,
    );
    return result;
  }

  async list(query: RawLogQueryDto) {
    const limit = query.limit ?? 50;
    const afterId = query.after_id ?? 0;
    const where = this.whereFrom(query, afterId);
    const rows = await this.prisma.rawAttlog.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = page.map((row) => this.present(row));
    return {
      success: true,
      data,
      pagination: {
        after_id: afterId,
        next_after_id: data.length > 0 ? data[data.length - 1].id : afterId,
        limit,
        has_more: hasMore,
      },
    };
  }

  whereFrom(query: RawLogQueryDto, afterId = 0): Prisma.RawAttlogWhereInput {
    const range = kolkataDayRange(query.from_date, query.to_date);
    return {
      id: { gt: afterId },
      ...(query.vendor ? { vendor: query.vendor } : {}),
      ...(query.device_sn ? { deviceSn: query.device_sn } : {}),
      ...(query.user_id ? { userId: query.user_id } : {}),
      ...(query.log_type ? { logType: query.log_type } : {}),
      ...(query.is_valid === undefined ? {} : { isValid: query.is_valid }),
      ...(query.processing_status ? { processingStatus: query.processing_status } : {}),
      ...(query.verification_reason
        ? { verificationReason: { contains: query.verification_reason } }
        : {}),
      ...(range.from || range.to
        ? {
            createdAt: {
              ...(range.from ? { gte: range.from } : {}),
              ...(range.to ? { lte: range.to } : {}),
            },
          }
        : {}),
    };
  }

  present(row: RawAttlog) {
    return {
      id: row.id,
      vendor: row.vendor,
      device_sn: row.deviceSn,
      request_path: row.requestPath,
      query_params: row.queryParams,
      raw_body: row.rawBody,
      ip_address: row.ipAddress,
      is_valid: row.isValid,
      log_type: row.logType,
      processing_status: row.processingStatus,
      verification_reason: row.verificationReason,
      user_id: row.userId,
      source_punch_time: row.sourcePunchTime,
      punch_time: row.punchTime,
      status: row.status,
      work_code: row.workCode,
      auth_type: row.authType,
      dedupe_hash: row.dedupeHash,
      duplicate_count: row.duplicateCount,
      retry_count: row.retryCount,
      last_error: row.lastError,
      created_at: row.createdAt,
      processed_at: row.processedAt,
    };
  }

  private async storeEvent(
    tx: Prisma.TransactionClient,
    request: IngestRequest,
    verification: DeviceVerification,
    event: IngestEvent,
    forced = false,
  ): Promise<{ duplicate: boolean; record: IngestResult['records'][number] }> {
    const classified = this.classify(verification, event, forced);
    const userId = clampText(event.userId, 100);
    const deviceSn = clampText(request.deviceSn, 150) ?? 'UNKNOWN';
    const hash = buildDedupeHash({
      vendor: request.vendor,
      deviceSn,
      userId,
      punchTime: event.punchTime,
      status: event.status,
      workCode: event.workCode,
      authType: event.authType,
      eventId: event.eventId,
      rawBody: event.rawBody,
      payloadValid: classified.isValid,
      dedupeIdentity: event.dedupeIdentity,
    });

    const existing = await tx.rawAttlog.findUnique({ where: { dedupeHash: hash } });
    if (existing) {
      const updated = await tx.rawAttlog.update({
        where: { id: existing.id },
        data: { duplicateCount: { increment: 1 } },
      });
      return {
        duplicate: true,
        record: {
          id: updated.id,
          duplicate: true,
          processingStatus: updated.processingStatus,
          logType: updated.logType,
          isValid: updated.isValid,
        },
      };
    }

    try {
      const created = await tx.rawAttlog.create({
        data: {
          vendor: request.vendor,
          deviceSn,
          requestPath: request.requestPath,
          queryParams: request.queryParams,
          rawBody: event.rawBody,
          ipAddress: clampText(request.ipAddress, 50),
          isValid: classified.isValid,
          logType: classified.logType,
          processingStatus: classified.processingStatus,
          verificationReason: classified.verificationReason,
          userId,
          sourcePunchTime: event.sourcePunchTime,
          punchTime: event.punchTime,
          status: clampText(event.status, 30),
          workCode: clampText(event.workCode, 50),
          authType: clampText(event.authType, 30),
          dedupeHash: hash,
          duplicateCount: 0,
        },
      });
      return {
        duplicate: false,
        record: {
          id: created.id,
          duplicate: false,
          processingStatus: created.processingStatus,
          logType: created.logType,
          isValid: created.isValid,
        },
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await tx.rawAttlog.findUnique({ where: { dedupeHash: hash } });
        if (!raced) {
          throw error;
        }
        const updated = await tx.rawAttlog.update({
          where: { id: raced.id },
          data: { duplicateCount: { increment: 1 } },
        });
        return {
          duplicate: true,
          record: {
            id: updated.id,
            duplicate: true,
            processingStatus: updated.processingStatus,
            logType: updated.logType,
            isValid: updated.isValid,
          },
        };
      }
      throw error;
    }
  }

  private classify(
    verification: DeviceVerification,
    event: IngestEvent,
    forced = false,
  ): {
    logType: LogType;
    isValid: boolean;
    processingStatus: ProcessingStatus;
    verificationReason: string | null;
  } {
    if (forced) {
      const reasons = [verification.reason, event.nonAttendance ? null : event.payloadReason].filter(Boolean);
      return {
        logType: 'unverified',
        isValid: event.payloadValid && !event.nonAttendance,
        processingStatus: 'QUARANTINED',
        verificationReason: reasons.join('; ') || verification.reason,
      };
    }
    const logType: LogType = verification.verified ? 'verified' : 'unverified';
    if (event.nonAttendance) {
      return {
        logType,
        isValid: false,
        processingStatus: 'INVALID',
        verificationReason: 'non_attendance_event',
      };
    }
    if (!event.payloadValid) {
      const reasons = [verification.reason, event.payloadReason].filter(Boolean);
      return {
        logType,
        isValid: false,
        processingStatus: 'INVALID',
        verificationReason: reasons.join('; ') || 'invalid_payload',
      };
    }
    if (!verification.verified) {
      return {
        logType: 'unverified',
        isValid: true,
        processingStatus: 'QUARANTINED',
        verificationReason: verification.reason,
      };
    }
    return {
      logType: 'verified',
      isValid: true,
      processingStatus: 'PENDING',
      verificationReason: null,
    };
  }
}
