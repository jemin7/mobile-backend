import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../authentication/admin-auth.guard';
import { RawLogQueryDto } from './dto/raw-log-query.dto';
import { RawLogService } from './raw-log.service';

@Controller('admin/raw-attlog')
@UseGuards(AdminAuthGuard)
export class RawLogController {
  constructor(private readonly rawLog: RawLogService) {}

  @Get()
  list(@Query() query: RawLogQueryDto) {
    return this.rawLog.list(query);
  }
}
