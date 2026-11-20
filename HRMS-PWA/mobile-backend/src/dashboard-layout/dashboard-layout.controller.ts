import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DashboardLayoutService } from './dashboard-layout.service';

@Controller('dashboard-layout')
@UseGuards(AuthGuard('jwt'))
export class DashboardLayoutController {
  constructor(private readonly service: DashboardLayoutService) {}

  @Get()
  getHome(@Req() req: { user?: Record<string, unknown>; headers?: Record<string, unknown> }) {
    return this.service.getHome(req);
  }

  @Put()
  saveHome(
    @Req() req: { user?: Record<string, unknown>; headers?: Record<string, unknown> },
    @Body() body: unknown,
  ) {
    return this.service.saveHome(req, body);
  }
}
