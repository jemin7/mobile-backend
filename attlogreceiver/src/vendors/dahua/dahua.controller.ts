import { Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { DeviceIpGuard } from '../../authentication/device-ip.guard';
import { DahuaService } from './dahua.service';

@Controller()
@UseGuards(DeviceIpGuard)
@Throttle({ default: { limit: 10000, ttl: 60000 } })
export class DahuaController {
  constructor(private readonly dahua: DahuaService) {}

  @Get(['PictureHttpUpload/keepalive', 'EventHttpUpload/keepalive', 'GeneralHttpUpload/keepalive'])
  keepalive(@Res() res: Response): void {
    res.status(200).type('text/plain; charset=utf-8').send('OK');
  }

  @Post(['dahua/event', 'html/dahua/dahua-listener.php'])
  async receive(@Req() req: Request, @Res() res: Response): Promise<void> {
    const body = await this.dahua.receive(req);
    res.status(200).type('text/plain; charset=utf-8').send(body);
  }
}
