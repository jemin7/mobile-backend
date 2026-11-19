import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { hasModuleAction } from '../common/company-module-permissions';
import { loadEmployeePermissions } from '../common/employee-permission.util';

type AuditUser = {
  role?: string;
  companyID?: number;
  type?: string;
  employeeId?: number;
  sub?: number;
  isCompanyOwner?: boolean;
};

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'))
export class AuditLogController {
  constructor(
    private readonly service: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private async assertCanRead(user?: AuditUser) {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SERVICE_PROVIDER' || role === 'COMPANY_ADMIN' || role === 'MULTI_COMPANY_ADMIN') {
      return;
    }
    const employeeId = Number(user?.employeeId || user?.sub || 0);
    const companyID = Number(user?.companyID || 0);
    if (!employeeId || !companyID) throw new ForbiddenException('Company access is required');
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { isCompanyOwner: true, companyID: true },
    });
    if (!employee || employee.companyID !== companyID) {
      throw new ForbiddenException('You do not have permission to view system logs');
    }
    if (employee.isCompanyOwner || user?.isCompanyOwner) return;
    const permissions = await loadEmployeePermissions(this.prisma, employeeId, companyID, false);
    if (!hasModuleAction(permissions, false, 'SYSTEM_LOGS', 'view')) {
      throw new ForbiddenException('You do not have permission to view system logs');
    }
  }

  private scopedCompany(user?: { role?: string; companyID?: number }) {
    const role = String(user?.role || '').toUpperCase();
    if (role === 'SUPERADMIN' || role === 'SERVICE_PROVIDER') return undefined;
    const companyID = Number(user?.companyID || 0);
    if (!companyID) throw new ForbiddenException('Company access is required');
    return companyID;
  }

  @Get()
  async list(
    @Req() req: { user?: AuditUser },
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    await this.assertCanRead(req.user);
    return this.service.list({
      companyID: this.scopedCompany(req.user),
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('export')
  async export(
    @Req() req: { user?: AuditUser },
    @Res() res: Response,
    @Query('format') format?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('username') username?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.assertCanRead(req.user);
    const csv = await this.service.exportCsv({
      companyID: this.scopedCompany(req.user),
      module: module || undefined,
      action: action || undefined,
      username: username || undefined,
      from: from || undefined,
      to: to || undefined,
    });
    const ext = format === 'csv' || !format ? 'csv' : 'csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs.${ext}"`);
    res.send(csv);
  }
}
