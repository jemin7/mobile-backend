import { All, Controller, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { DeviceIpGuard } from '../authentication/device-ip.guard';
import { DeviceRoutingService } from './device-routing.service';

const GENERIC_PATHS = ['iclock/cdata.aspx', 'iclock/getrequest', 'iclock/getrequest.aspx'];

@Controller()
@UseGuards(DeviceIpGuard)
@Throttle({ default: { limit: 10000, ttl: 60000 } })
export class GenericDeviceController {
  constructor(private readonly routing: DeviceRoutingService) {}

  @All(GENERIC_PATHS)
  async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = await this.routing.receive(req);
    res.status(200).type('text/plain; charset=utf-8').send(body);
  }
}
