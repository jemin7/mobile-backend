import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { clientIp, normalizeQuery, requestPath } from '../../common/helpers/request';
import { decodeDahuaPayload } from './dahua.parser';
import { safeEqual } from '../../common/helpers/security';
import { DevicesService } from '../../devices/devices.service';
import { RawLogService } from '../../raw-log/raw-log.service';
import { parseDahuaBody } from './dahua.parser';

@Injectable()
export class DahuaService {
  constructor(
    private readonly rawLog: RawLogService,
    private readonly devices: DevicesService,
    private readonly config: ConfigService,
  ) {}

  assertAuthorized(req: Request): void {
    const expectedUser = this.config.get<string>('DAHUA_BASIC_USER') ?? '';
    const expectedPassword = this.config.get<string>('DAHUA_BASIC_PASSWORD') ?? '';
    const header = req.header('authorization') ?? '';
    if (!expectedUser || !expectedPassword || !header.startsWith('Basic ')) {
      throw new UnauthorizedException('dahua_authentication_failed');
    }
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : '';
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';
    if (!safeEqual(user, expectedUser) || !safeEqual(password, expectedPassword)) {
      throw new UnauthorizedException('dahua_authentication_failed');
    }
  }

  async receive(req: Request): Promise<string> {
    this.assertAuthorized(req);
    const query = normalizeQuery(req.query);
    const path = requestPath(req);
    const body = decodeDahuaPayload(req.body);
    const parsed = parseDahuaBody(body);
    let serial =
      (parsed.kind === 'punch' ? parsed.serial : null) ||
      query.SN ||
      query.sn ||
      '';
    if (!serial) {
      const sole = await this.devices.findSoleActive('DAHUA');
      if (sole) {
        serial = sole.deviceSn;
      }
    }
    const deviceSn = serial || 'UNKNOWN';

    if (parsed.kind === 'ignored') {
      await this.rawLog.ingest({
        vendor: 'DAHUA',
        deviceSn,
        requestPath: path,
        queryParams: query,
        ipAddress: clientIp(req),
        events: [
          {
            rawBody: parsed.rawBody,
            userId: null,
            sourcePunchTime: null,
            punchTime: null,
            status: null,
            workCode: null,
            authType: null,
            eventId: parsed.eventCode,
            payloadValid: false,
            payloadReason: 'non_attendance_event',
            nonAttendance: true,
          },
        ],
      });
      return 'OK';
    }

    if (parsed.kind === 'invalid') {
      await this.rawLog.ingest({
        vendor: 'DAHUA',
        deviceSn,
        requestPath: path,
        queryParams: query,
        ipAddress: clientIp(req),
        events: [
          {
            rawBody: parsed.rawBody,
            userId: null,
            sourcePunchTime: null,
            punchTime: null,
            status: null,
            workCode: null,
            authType: null,
            eventId: null,
            payloadValid: false,
            payloadReason: parsed.reason,
          },
        ],
      });
      return 'OK';
    }

    await this.rawLog.ingest({
      vendor: 'DAHUA',
      deviceSn,
      requestPath: path,
      queryParams: query,
      ipAddress: clientIp(req),
      events: [
        {
          rawBody: parsed.rawBody,
          userId: parsed.userId,
          sourcePunchTime: parsed.sourcePunchTime,
          punchTime: parsed.punchTime,
          status: null,
          workCode: null,
          authType: null,
          eventId: null,
          payloadValid: parsed.payloadValid,
          payloadReason: parsed.payloadReason,
        },
      ],
    });
    return 'OK';
  }
}
