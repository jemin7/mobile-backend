import { BadRequestException, Injectable } from '@nestjs/common';
import { DashboardActorType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveActiveCompanyForUser } from '../common/active-company.util';
import { loadEmployeePermissions } from '../common/employee-permission.util';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import {
  applyTeamSlot,
  companyHomeLayout,
  isCompanyWidgetKey,
  isKnownWidgetKey,
  personalHomeLayout,
  stripTeamAttendanceWidget,
  type DashboardLayout,
  type DashboardWidget,
} from './dashboard-widgets';

type JwtUser = {
  sub?: number;
  id?: number;
  role?: string;
  type?: string;
  companyID?: number;
  employeeId?: number;
  isCompanyOwner?: boolean;
};

const COMPANY_DEFAULT_ROLES = new Set(['COMPANY_ADMIN', 'MULTI_COMPANY_ADMIN']);
const COMPANY_WIDGET_ROLES = new Set([
  'SUPERADMIN',
  'SERVICE_PROVIDER',
  'COMPANY_ADMIN',
  'MULTI_COMPANY_ADMIN',
  'ADMIN',
  'BRANCH_ADMIN',
]);

@Injectable()
export class DashboardLayoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly managerScope: EmpManagerScopeService,
  ) {}

  async getHome(
    req: { user?: JwtUser; headers?: Record<string, unknown> },
  ) {
    const companyId = await this.companyId(req);
    const profile = await this.dashboardProfile(req.user, companyId);
    let canUseCompanyWidgets = await this.canUseCompanyWidgets(req.user, companyId);
    if (profile.leadership) canUseCompanyWidgets = true;
    const canUseTeamAttendance = profile.leadership || profile.hasReportees;
    const homeKind = this.homeKind(req.user, profile);
    let layout = homeKind === 'company'
      ? companyHomeLayout(profile.hasReportees)
      : personalHomeLayout(false);
    if (!canUseTeamAttendance) layout = stripTeamAttendanceWidget(layout);
    layout = applyTeamSlot(layout, profile.hasReportees && canUseTeamAttendance).layout;
    return {
      source: 'default' as const,
      layout,
      defaultLayout: layout,
      canUseCompanyWidgets,
      canCustomize: false,
      canUseTeamAttendance,
      homeKind,
    };
  }

  async saveHome(
    _req: { user?: JwtUser; headers?: Record<string, unknown> },
    _body: unknown,
  ) {
    throw new BadRequestException('Dashboard customization is turned off');
  }

  private async canCustomize(user: JwtUser | undefined, companyId: number | null) {
    if (!user) return false;
    const role = String(user.role || '').toUpperCase();
    const employee = user.type === 'employee' || role === 'EMPLOYEE';
    if (!employee) return true;
    if (user.isCompanyOwner === true) return true;
    const employeeId = Number(user.employeeId ?? user.sub);
    if (!companyId || !Number.isFinite(employeeId) || employeeId <= 0) return false;
    const row = await this.prisma.manageEmployee.findFirst({
      where: { id: employeeId, companyID: companyId, isDeleted: false },
      select: { isCompanyOwner: true },
    });
    if (row?.isCompanyOwner) return true;
    const permissions = await loadEmployeePermissions(this.prisma, employeeId, companyId, false);
    return permissions.some((item) => item.moduleKey === 'CUSTOM_DASHBOARD' && item.canView);
  }

  private actor(user?: JwtUser): { actorType: DashboardActorType; actorId: number } | null {
    if (!user) return null;
    const role = String(user.role || '').toUpperCase();
    const employee = user.type === 'employee' || role === 'EMPLOYEE';
    const actorId = Number(employee ? user.employeeId ?? user.sub : user.sub ?? user.id);
    if (!Number.isFinite(actorId) || actorId <= 0) return null;
    return {
      actorType: employee ? DashboardActorType.EMPLOYEE : DashboardActorType.USER,
      actorId,
    };
  }

  private companyId(req: { user?: JwtUser; headers?: Record<string, unknown> }) {
    return resolveActiveCompanyForUser(this.prisma, req);
  }

  private async canUseCompanyWidgets(user: JwtUser | undefined, companyId: number | null) {
    if (!companyId) return false;
    const role = String(user?.role || '').toUpperCase();
    if (COMPANY_WIDGET_ROLES.has(role)) return true;
    if (user?.type === 'employee' || role === 'EMPLOYEE') {
      if (user?.isCompanyOwner === true) return true;
      const employeeId = Number(user?.employeeId ?? user?.sub);
      if (!Number.isFinite(employeeId) || employeeId <= 0) return false;
      const permissions = await loadEmployeePermissions(this.prisma, employeeId, companyId, false);
      return permissions.some(
        (row) =>
          row.moduleKey !== 'CUSTOM_DASHBOARD' &&
          (row.canView || row.canCreate || row.canEdit || row.canDelete),
      );
    }
    return false;
  }

  private placeTeamCard(widgets: DashboardWidget[], showTeam: boolean, canUseTeam: boolean) {
    let next = widgets;
    if (!canUseTeam) next = stripTeamAttendanceWidget({ version: 1, widgets: next }).widgets;
    next = applyTeamSlot({ version: 1, widgets: next }, showTeam && canUseTeam).layout.widgets;
    if (!canUseTeam) next = stripTeamAttendanceWidget({ version: 1, widgets: next }).widgets;
    return next;
  }

  private async dashboardProfile(user: JwtUser | undefined, companyId: number | null) {
    const empty = { leadership: false, hasReportees: false };
    if (!user || !companyId) return empty;
    const role = String(user.role || '').toUpperCase();
    const employee = user.type === 'employee' || role === 'EMPLOYEE';
    if (!employee) return empty;
    const employeeId = Number(user.employeeId ?? user.sub);
    if (!Number.isFinite(employeeId) || employeeId <= 0) return empty;
    return this.managerScope.dashboardProfile(employeeId, companyId);
  }

  private homeKind(
    user: JwtUser | undefined,
    profile: { leadership: boolean; hasReportees: boolean },
  ): 'company' | 'employee' {
    const role = String(user?.role || '').toUpperCase();
    const owner = user?.isCompanyOwner === true || profile.leadership;
    if (owner || profile.hasReportees || COMPANY_DEFAULT_ROLES.has(role) || COMPANY_WIDGET_ROLES.has(role)) {
      return 'company';
    }
    return 'employee';
  }

  private defaultLayout(
    user: JwtUser | undefined,
    canUseCompanyWidgets: boolean,
    profile: { leadership: boolean; hasReportees: boolean },
  ): DashboardLayout {
    const role = String(user?.role || '').toUpperCase();
    const owner = user?.isCompanyOwner === true || profile.leadership;
    if (canUseCompanyWidgets && (owner || COMPANY_DEFAULT_ROLES.has(role))) {
      return companyHomeLayout(profile.hasReportees);
    }
    return personalHomeLayout(profile.hasReportees);
  }

  private readStored(raw: unknown, canUseCompanyWidgets: boolean): DashboardLayout | null {
    if (!raw || typeof raw !== 'object') return null;
    const version = (raw as { version?: unknown }).version;
    if (version !== 1) return null;
    const widgets = this.sanitizeWidgets(
      (raw as { widgets?: unknown }).widgets,
      canUseCompanyWidgets,
      false,
      'desktop',
    );
    if (!widgets) return null;
    const mobileWidgets = this.sanitizeWidgets(
      (raw as { mobileWidgets?: unknown }).mobileWidgets,
      canUseCompanyWidgets,
      false,
      'mobile',
    );
    return {
      version: 1,
      widgets,
      ...(mobileWidgets?.length ? { mobileWidgets } : {}),
    };
  }

  private sanitizeWidgets(
    widgets: unknown,
    canUseCompanyWidgets: boolean,
    strict: boolean,
    surface: 'desktop' | 'mobile',
  ): DashboardWidget[] | null {
    if (!Array.isArray(widgets)) return strict ? null : null;
    if (widgets.length > 24) return null;
    const seen = new Set<string>();
    const clean: DashboardWidget[] = [];
    const cols = surface === 'mobile' ? 4 : 12;
    for (const item of widgets) {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const instanceId = String(row.instanceId || '');
      const widgetKey = String(row.widgetKey || '');
      if (!/^[a-z0-9-]{1,64}$/.test(instanceId) || seen.has(instanceId)) return null;
      if (!isKnownWidgetKey(widgetKey)) {
        if (strict) return null;
        continue;
      }
      if (isCompanyWidgetKey(widgetKey) && !canUseCompanyWidgets) {
        if (strict) return null;
        continue;
      }
      const x = Number(row.x);
      const y = Number(row.y);
      const w = Number(row.w);
      const h = Number(row.h);
      if (![x, y, w, h].every((n) => Number.isInteger(n))) return null;
      if (y < 0 || y > 200) return null;
      if (surface === 'mobile') {
        if (x < 0 || w < 1 || w > cols || h < 1 || h > 20 || x + w > cols) {
          if (strict) return null;
          continue;
        }
      } else if (x < 0 || x > 11 || w < 2 || w > 12 || h < 2 || h > 20 || x + w > 12) {
        return null;
      }
      seen.add(instanceId);
      const rawSettings = row.settings;
      const teamSlot = instanceId === 'team-slot' || (
        !!rawSettings && typeof rawSettings === 'object'
        && (rawSettings as { teamSlot?: unknown }).teamSlot === true
      );
      clean.push({
        instanceId,
        widgetKey,
        x,
        y,
        w,
        h,
        ...(teamSlot ? { settings: { teamSlot: true } } : {}),
      });
    }
    if (clean.length === 0) return null;
    return clean;
  }
}
