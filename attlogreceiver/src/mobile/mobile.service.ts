import { BadRequestException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp, requestPath } from '../common/helpers/request';
import { RawLogService } from '../raw-log/raw-log.service';
import { parseMobileBody } from './mobile.parser';

@Injectable()
export class MobileService {
  constructor(private readonly rawLog: RawLogService) {}

  async receive(body: unknown, req: Request) {
    const parsed = parseMobileBody(body);
    if ('error' in parsed) {
      throw new BadRequestException('malformed_json');
    }
    const result = await this.rawLog.ingest({
      vendor: 'MOBILE',
      deviceSn: parsed.installationId || 'UNKNOWN',
      requestPath: requestPath(req),
      queryParams: {},
      ipAddress: clientIp(req),
      events: [
        {
          rawBody: parsed.rawBody,
          userId: parsed.userId,
          sourcePunchTime: parsed.sourcePunchTime,
          punchTime: parsed.punchTime,
          status: parsed.status,
          workCode: null,
          authType: 'GPS',
          eventId: null,
          payloadValid: parsed.payloadValid,
          payloadReason: parsed.payloadReason,
        },
      ],
    });
    const record = result.records[0];
    return {
      success: true,
      stored: true,
      duplicate: record?.duplicate ?? false,
      processing_status: record?.processingStatus ?? null,
      raw_attlog_id: record?.id ?? null,
    };
  }
}
