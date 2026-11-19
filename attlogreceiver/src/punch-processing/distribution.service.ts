import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { dateToWallIso, wallClockToDate } from '../common/time/time.util';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class DistributionService {
  constructor(private readonly prisma: PrismaService) {}

  async pull(afterId: number, limit: number) {
    const rows = await this.prisma.processAttlog.findMany({
      where: {
        export: 0,
        id: { gt: afterId },
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = page.map((row) => ({
      id: row.id,
      raw_attlog_id: row.rawAttlogId,
      vendor: row.vendor,
      device_sn: row.deviceSn,
      user_id: row.userId,
      punch_time: dateToWallIso(row.punchTime),
      status: row.status,
      work_code: row.workCode,
      auth_type: row.authType,
      export: row.export,
    }));
    const nextAfterId = data.length > 0 ? Number(data[data.length - 1].id) : afterId;
    return {
      success: true,
      data,
      pagination: {
        after_id: afterId,
        next_after_id: nextAfterId,
        limit,
        has_more: hasMore,
      },
    };
  }

  async markExported(ids: number[]) {
    if (!ids.length) {
      throw new BadRequestException('ids_required');
    }
    const unique = [...new Set(ids)];
    const result = await this.prisma.processAttlog.updateMany({
      where: {
        export: 0,
        id: { in: unique.map((id) => BigInt(id)) },
      },
      data: { export: 1, exportedAt: new Date() },
    });
    return { success: true, updated: result.count };
  }

  async listProcessed(query: {
    vendor?: string;
    deviceSn?: string;
    userId?: string;
    fromDate?: string;
    toDate?: string;
    afterId?: number;
    limit?: number;
  }) {
    const limit = query.limit ?? 50;
    const afterId = query.afterId ?? 0;
    const from = query.fromDate ? wallClockToDate(`${query.fromDate} 00:00:00`) : undefined;
    const to = query.toDate ? wallClockToDate(`${query.toDate} 23:59:59`) : undefined;
    const where: Prisma.ProcessAttlogWhereInput = {
      id: { gt: afterId },
      ...(query.vendor ? { vendor: query.vendor } : {}),
      ...(query.deviceSn ? { deviceSn: query.deviceSn } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
      ...(from || to
        ? {
            punchTime: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
    const rows = await this.prisma.processAttlog.findMany({
      where,
      orderBy: { id: 'asc' },
      take: limit + 1,
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = page.map((row) => ({
      id: row.id,
      raw_attlog_id: row.rawAttlogId,
      vendor: row.vendor,
      device_sn: row.deviceSn,
      user_id: row.userId,
      punch_time: dateToWallIso(row.punchTime),
      source_punch_time: row.sourcePunchTime,
      status: row.status,
      work_code: row.workCode,
      auth_type: row.authType,
      export: row.export,
      exported_at: row.exportedAt,
      created_at: row.createdAt,
    }));
    return {
      success: true,
      data,
      pagination: {
        after_id: afterId,
        next_after_id: data.length > 0 ? Number(data[data.length - 1].id) : afterId,
        limit,
        has_more: hasMore,
      },
    };
  }
}
