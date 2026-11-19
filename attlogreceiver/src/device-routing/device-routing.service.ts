import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { clientIp, normalizeQuery, readBodyText, requestPath } from '../common/helpers/request';
import { DevicesService } from '../devices/devices.service';
import { IngestEvent, RawLogService } from '../raw-log/raw-log.service';
import { parseEsslLine } from '../vendors/essl/essl.parser';
import { EsslService } from '../vendors/essl/essl.service';
import { parseZktecoLine } from '../vendors/zkteco/zkteco.parser';
import { ZktecoService } from '../vendors/zkteco/zkteco.service';

type Hold = {
  kind: 'hold';
  vendor: string;
  deviceSn: string;
  reason: string;
};

@Injectable()
export class DeviceRoutingService {
  constructor(
    private readonly devices: DevicesService,
    private readonly rawLog: RawLogService,
    private readonly essl: EsslService,
    private readonly zkteco: ZktecoService,
  ) {}

  async receive(req: Request): Promise<string> {
    const query = normalizeQuery(req.query);
    const method = req.method.toUpperCase();
    const path = requestPath(req).toLowerCase();
    const serial = (query.SN || query.sn || query.DeviceSN || '').trim();
    const decision = await this.resolve(req, serial);

    if (decision.kind === 'dispatch') {
      return decision.vendor === 'ZKTECO' ? this.zkteco.receive(req) : this.essl.receive(req);
    }

    const handshake = method === 'GET' || path.includes('getrequest');
    await this.storeHold(req, decision, handshake ? 'handshake' : 'punch');
    if (query.options) {
      return this.options(decision.deviceSn);
    }
    return 'OK';
  }

  private async resolve(req: Request, serial: string): Promise<{ kind: 'dispatch'; vendor: 'ESSL' | 'ZKTECO' } | Hold> {
    let deviceSn = serial;
    if (!deviceSn) {
      const byIp = await this.devices.findByDedicatedIp(clientIp(req));
      if (byIp.length !== 1) {
        return {
          kind: 'hold',
          vendor: 'UNKNOWN',
          deviceSn: 'UNKNOWN',
          reason: 'missing_serial',
        };
      }
      deviceSn = byIp[0].deviceSn;
      this.pinSerial(req, deviceSn);
    }

    const rows = await this.devices.findBySerial(deviceSn);
    if (rows.length === 0) {
      return {
        kind: 'hold',
        vendor: 'UNKNOWN',
        deviceSn,
        reason: 'device_not_registered',
      };
    }
    if (rows.length > 1) {
      const vendors = new Set(rows.map((row) => row.vendor));
      return {
        kind: 'hold',
        vendor: vendors.size === 1 ? rows[0].vendor : 'UNKNOWN',
        deviceSn,
        reason: 'ambiguous_device',
      };
    }
    const device = rows[0];
    if (device.vendor === 'ESSL' || device.vendor === 'ZKTECO') {
      return { kind: 'dispatch', vendor: device.vendor };
    }
    return {
      kind: 'hold',
      vendor: device.vendor,
      deviceSn: device.deviceSn,
      reason: 'unsupported_on_generic_url',
    };
  }

  private pinSerial(req: Request, deviceSn: string): void {
    const current = req.originalUrl || req.url || '';
    const [path, search = ''] = current.split('?');
    const params = new URLSearchParams(search);
    params.set('SN', deviceSn);
    const next = `${path}?${params.toString()}`;
    req.url = next;
    req.originalUrl = next;
  }

  private async storeHold(req: Request, decision: Hold, identity: 'handshake' | 'punch'): Promise<void> {
    const query = normalizeQuery(req.query);
    const table = (query.table || query.Table || '').toUpperCase();
    const events =
      identity === 'handshake' || (table && table !== 'ATTLOG')
        ? [this.operationalEvent(req, decision, identity === 'handshake' ? 'handshake' : `table:${table}`)]
        : this.punchEvents(decision.vendor, readBodyText(req.body));
    if (events.length === 0) {
      return;
    }
    await this.rawLog.ingest({
      vendor: decision.vendor,
      deviceSn: decision.deviceSn,
      requestPath: requestPath(req),
      queryParams: query,
      ipAddress: clientIp(req),
      forcedReason: decision.reason,
      events,
    });
  }

  private operationalEvent(req: Request, decision: Hold, identity: string): IngestEvent {
    return {
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
      dedupeIdentity: `iclock:${identity}:${decision.deviceSn}`,
    };
  }

  private punchEvents(vendor: string, body: string): IngestEvent[] {
    return body
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const punch = vendor === 'ZKTECO' ? parseZktecoLine(line) : parseEsslLine(line);
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
