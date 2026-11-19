import { Body, Controller, Get, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SystemSettingsService, type CompanySystemSettings } from './system-settings.service';

@Controller('system-settings')
@UseGuards(AuthGuard('jwt'))
export class SystemSettingsController {
  constructor(private readonly settings: SystemSettingsService) {}

  private companyId(req: { user?: { companyID?: number } }, queryCompany?: string) {
    return Number(queryCompany || req.user?.companyID || 0);
  }

  @Get()
  get(@Req() req: { user?: { companyID?: number } }, @Query('companyID') companyID?: string) {
    const id = this.companyId(req, companyID);
    return this.settings.get(id);
  }

  @Put()
  save(
    @Req() req: { user?: { companyID?: number } },
    @Body() body: CompanySystemSettings & { companyID?: number },
  ) {
    const id = Number(body.companyID || req.user?.companyID || 0);
    return this.settings.save(id, {
      smtp: body.smtp,
      sms: body.sms,
      retention: body.retention,
      integrationProvider: body.integrationProvider,
    });
  }
}
