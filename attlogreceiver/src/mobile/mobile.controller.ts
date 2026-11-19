import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ReceiverKeyGuard } from '../authentication/receiver-key.guard';
import { MobileService } from './mobile.service';

@Controller('mobile')
@UseGuards(ReceiverKeyGuard)
export class MobileController {
  constructor(private readonly mobile: MobileService) {}

  @Post('punch')
  punch(@Body() body: unknown, @Req() req: Request) {
    return this.mobile.receive(body, req);
  }
}
