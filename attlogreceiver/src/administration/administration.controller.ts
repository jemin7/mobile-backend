import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../authentication/admin-auth.guard';
import { RawLogQueryDto } from '../raw-log/dto/raw-log-query.dto';
import { AdministrationService } from './administration.service';

@Controller('admin/reports')
@UseGuards(AdminAuthGuard)
export class AdministrationController {
  constructor(private readonly administration: AdministrationService) {}

  @Get('raw-punches')
  rawPunches(@Query() query: RawLogQueryDto) {
    return this.administration.rawPunches(query);
  }

  @Get('processed-punches')
  processedPunches(@Query() query: RawLogQueryDto) {
    return this.administration.processedPunches(query);
  }

  @Get('unverified-punches')
  unverifiedPunches(@Query() query: RawLogQueryDto) {
    return this.administration.unverifiedPunches(query);
  }

  @Get('invalid-punches')
  invalidPunches(@Query() query: RawLogQueryDto) {
    return this.administration.invalidPunches(query);
  }

  @Get('summary')
  summary(@Query() query: RawLogQueryDto) {
    return this.administration.summary(query);
  }
}
