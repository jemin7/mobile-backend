import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp, normalizeQuery, readBodyText, requestPath } from '../../common/helpers/request';
import { IngestEvent, RawLogService } from '../../raw-log/raw-log.service';
import { parseEsslBody, ParsedPunch } from './essl.parser';

@Injectable()
export class EsslService {
  constructor(private readonly rawLog: RawLogService) {}

  async receive(req: Request): Promise<string> {
    const query = normalizeQuery(req.query);
    const path = requestPath(req);
    const method = req.method.toUpperCase();
    const table = (query.table || query.Table || '').toUpperCase();
    const serial = (query.SN || query.sn || query.DeviceSN || '').trim();
    const deviceSn = serial || 'UNKNOWN';

    if (method === 'GET') {
      await this.storeOperational(req, deviceSn, query, 'handshake');
      if (query.options) {
        return this.options(deviceSn);
      }
      return 'OK';
    }

    if (table && table !== 'ATTLOG') {
      await this.storeOperational(req, deviceSn, query, `table:${table}`);
      return 'OK';
    }

    const punches = parseEsslBody(readBodyText(req.body));
    if (punches.length === 0) {
      return 'OK';
    }
    await this.rawLog.ingest({
      vendor: 'ESSL',
      deviceSn,
      requestPath: path,
      queryParams: query,
      ipAddress: clientIp(req),
      events: punches.map((punch) => this.toEvent(punch)),
    });
    return 'OK';
  }

  private toEvent(punch: ParsedPunch): IngestEvent {
    return {
      rawBody: punch.rawBody,
      userId: punch.userId,
      sourcePunchTime: punch.sourcePunchTime,
      punchTime: punch.punchTime,
      status: punch.status,
      workCode: punch.workCode,
      authType: punch.authType,
      eventId: punch.eventId,
      payloadValid: punch.payloadValid,
      payloadReason: punch.payloadReason,
    };
  }

  private async storeOperational(
    req: Request,
    deviceSn: string,
    query: Record<string, string>,
    identity: string,
  ): Promise<void> {
    await this.rawLog.ingest({
      vendor: 'ESSL',
      deviceSn,
      requestPath: requestPath(req),
      queryParams: query,
      ipAddress: clientIp(req),
      events: [
        {
          rawBody: readBodyText(req.body) || identity,
          userId: null,
          sourcePunchTime: null,
          punchTime: null,
          status: null,
          workCode: null,
          authType: null,
          eventId: null,
          payloadValid: false,
          payloadReason: 'non_attendance_event',
          nonAttendance: true,
          dedupeIdentity: `essl:${identity}:${deviceSn}`,
        },
      ],
    });
  }

  private options(serial: string): string {
    return [
      `GET OPTION FROM: ${serial}`,
      'Stamp=9999',
      'OpStamp=9999',
      'ErrorDelay=60',
      'Delay=30',
      'TransTimes=00:00;14:05',
      'TransInterval=1',
      'TransFlag=AttLog\tOpLog',
      'Realtime=1',
      'Encrypt=0',
      'TimeZone=330',
      '',
    ].join('\n');
  }
}
