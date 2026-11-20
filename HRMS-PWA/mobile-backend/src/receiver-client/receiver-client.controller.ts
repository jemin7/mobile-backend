import { Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReceiverClientService } from './receiver-client.service';

@Controller('receiver-link')
@UseGuards(AuthGuard('jwt'))
export class ReceiverClientController {
  constructor(private readonly svc: ReceiverClientService) {}

  private assertAdmin(req: any) {
    const role = String(req.user?.role || '').toUpperCase();
    if (!['SUPERADMIN', 'SERVICE_PROVIDER'].includes(role)) {
      throw new ForbiddenException('Not allowed');
    }
  }

  @Get('status')
  status(@Req() req: any) {
    this.assertAdmin(req);
    return this.svc.status();
  }

  @Post('backfill-devices')
  backfill(@Req() req: any) {
    this.assertAdmin(req);
    return this.svc.backfillDevices();
  }
}
