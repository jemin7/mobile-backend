import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { kolkataDayRange } from '../common/time/time.util';
import { PrismaService } from '../database/prisma.service';
import { DistributionService } from '../punch-processing/distribution.service';
import { RawLogQueryDto } from '../raw-log/dto/raw-log-query.dto';
import { RawLogService } from '../raw-log/raw-log.service';

type SummaryQuery = {
  vendor?: string;
  from_date?: string;
  to_date?: string;
};

@Injectable()
export class AdministrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rawLog: RawLogService,
    private readonly distribution: DistributionService,
  ) {}

  rawPunches(query: RawLogQueryDto) {
    return this.rawLog.list(query);
  }

  processedPunches(query: RawLogQueryDto) {
    return this.distribution.listProcessed({
      vendor: query.vendor,
      deviceSn: query.device_sn,
      userId: query.user_id,
      fromDate: query.from_date,
      toDate: query.to_date,
      afterId: query.after_id,
      limit: query.limit,
    });
  }

  async unverifiedPunches(query: RawLogQueryDto) {
    const list = await this.rawLog.list({ ...query, log_type: 'unverified' });
    const groups = await this.grouped(
      { ...query, log_type: 'unverified' },
      Prisma.sql`log_type = 'unverified'`,
    );
    return { ...list, groups };
  }

  async invalidPunches(query: RawLogQueryDto) {
    const list = await this.rawLog.list({ ...query, processing_status: 'INVALID' });
    const groups = await this.grouped(
      { ...query, processing_status: 'INVALID' },
      Prisma.sql`processing_status = 'INVALID'`,
    );
    return { ...list, groups };
  }

  async summary(query: SummaryQuery) {
    const range = kolkataDayRange(query.from_date, query.to_date);
    const rawWhere = this.rawWhere(query, range);
    const [totalRaw, verified, unverified, invalid, pending, failed, processed, exported] =
      await Promise.all([
        this.prisma.rawAttlog.count({ where: rawWhere }),
        this.prisma.rawAttlog.count({ where: { ...rawWhere, logType: 'verified' } }),
        this.prisma.rawAttlog.count({ where: { ...rawWhere, logType: 'unverified' } }),
        this.prisma.rawAttlog.count({ where: { ...rawWhere, isValid: false } }),
        this.prisma.rawAttlog.count({ where: { ...rawWhere, processingStatus: 'PENDING' } }),
        this.prisma.rawAttlog.count({ where: { ...rawWhere, processingStatus: 'FAILED' } }),
        this.prisma.processAttlog.count({ where: this.processWhere(query, range) }),
        this.prisma.processAttlog.count({
          where: { ...this.processWhere(query, range), export: 1 },
        }),
      ]);
    const [byDevice, byVendor] = await Promise.all([
      this.prisma.rawAttlog.groupBy({
        by: ['deviceSn', 'vendor'],
        where: rawWhere,
        _count: { _all: true },
        orderBy: { _count: { deviceSn: 'desc' } },
        take: 100,
      }),
      this.prisma.rawAttlog.groupBy({
        by: ['vendor'],
        where: rawWhere,
        _count: { _all: true },
      }),
    ]);
    return {
      success: true,
      data: {
        total_raw: totalRaw,
        total_verified: verified,
        total_unverified: unverified,
        total_invalid: invalid,
        total_processed: processed,
        total_pending: pending,
        total_failed: failed,
        total_exported: exported,
        by_device: byDevice.map((row) => ({
          device_sn: row.deviceSn,
          vendor: row.vendor,
          count: row._count._all,
        })),
        by_vendor: byVendor.map((row) => ({ vendor: row.vendor, count: row._count._all })),
      },
    };
  }

  private rawWhere(
    query: SummaryQuery,
    range: { from?: Date; to?: Date },
  ): Prisma.RawAttlogWhereInput {
    return {
      ...(query.vendor ? { vendor: query.vendor } : {}),
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

  private processWhere(
    query: SummaryQuery,
    range: { from?: Date; to?: Date },
  ): Prisma.ProcessAttlogWhereInput {
    return {
      ...(query.vendor ? { vendor: query.vendor } : {}),
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

  private async grouped(query: RawLogQueryDto, required: Prisma.Sql) {
    const range = kolkataDayRange(query.from_date, query.to_date);
    const filters: Prisma.Sql[] = [required];
    if (query.vendor) {
      filters.push(Prisma.sql`vendor = ${query.vendor}`);
    }
    if (query.device_sn) {
      filters.push(Prisma.sql`device_sn = ${query.device_sn}`);
    }
    if (range.from) {
      filters.push(Prisma.sql`created_at >= ${range.from}`);
    }
    if (range.to) {
      filters.push(Prisma.sql`created_at <= ${range.to}`);
    }
    const where = Prisma.join(filters, ' AND ');
    return this.prisma.$queryRaw<
      Array<{
        device_sn: string;
        vendor: string;
        verification_reason: string | null;
        punches: number;
      }>
    >`
      SELECT device_sn, vendor, verification_reason, COUNT(*)::int AS punches
      FROM raw_attlog
      WHERE ${where}
      GROUP BY device_sn, vendor, verification_reason
      ORDER BY punches DESC
      LIMIT 200
    `;
  }
}
