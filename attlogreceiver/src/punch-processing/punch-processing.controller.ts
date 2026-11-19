import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../authentication/admin-auth.guard';
import { ReceiverKeyGuard } from '../authentication/receiver-key.guard';
import { kolkataDayRange } from '../common/time/time.util';
import { MarkExportedDto, PullPunchesQueryDto, ReprocessDto } from './dto/punch.dto';
import { DistributionService } from './distribution.service';
import { PunchProcessingService } from './punch-processing.service';

@Controller()
export class PunchProcessingController {
  constructor(
    private readonly distribution: DistributionService,
    private readonly processing: PunchProcessingService,
  ) {}

  @Get('process-attlog')
  @UseGuards(ReceiverKeyGuard)
  pull(@Query() query: PullPunchesQueryDto) {
    return this.distribution.pull(query.after_id ?? 0, query.limit ?? 500);
  }

  @Post('process-attlog/mark-exported')
  @UseGuards(ReceiverKeyGuard)
  markExported(@Body() dto: MarkExportedDto) {
    return this.distribution.markExported(dto.ids);
  }

  @Post('admin/raw-attlog/reprocess')
  @UseGuards(AdminAuthGuard)
  reprocess(@Body() dto: ReprocessDto) {
    const range = kolkataDayRange(dto.from_date, dto.to_date);
    return this.processing.reprocessUnverifiedPunches({
      ids: dto.ids?.map((id) => BigInt(id)),
      vendor: dto.vendor,
      deviceSn: dto.device_sn,
      from: range.from,
      to: range.to,
    });
  }
}
