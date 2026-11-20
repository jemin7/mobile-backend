import { Controller, Get, Post, Body, Query, Req, UnauthorizedException, UseGuards, Param, ForbiddenException, BadRequestException, Delete, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmpLocationAttendanceService } from '../emp-location-attendance/emp-location-attendance.service';
import { EmpManagerScopeService } from './emp-manager-scope.service';
import { MailService } from '../mail/mail.service';
import { RosterDayService } from '../roster/roster-day.service';
import { RosterEmployeeService } from '../roster/roster-employee.service';
import { BulkUpsertRosterDaysDto } from '../roster/dto/bulk-upsert-roster-days.dto';

@Controller('emp-manager-scope')
@UseGuards(AuthGuard('jwt'))
export class EmpManagerScopeController {
  constructor(
    private readonly scope: EmpManagerScopeService,
    private readonly prisma: PrismaService,
    private readonly attendance: EmpLocationAttendanceService,
    private readonly mailService: MailService,
    private readonly rosterDays: RosterDayService,
    private readonly rosterEmployees: RosterEmployeeService,
  ) {}

  private optionalId(value?: string) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private async assertDirectReportee(managerId: number, employeeId: number) {
    const ids = await this.scope.getDirectReporteeIds(managerId);
    if (!ids.includes(Number(employeeId))) {
      throw new ForbiddenException('You can only manage roster for your own reportees');
    }
  }

  private getEmployeeId(req: { user?: { employeeId?: number; sub?: number } }): number {
    const id = req.user?.employeeId ?? req.user?.sub;
    if (!id) throw new UnauthorizedException('Employee ID not found in token');
    return Number(id);
  }

  @Get('reportees')
  async reportees(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
    const descendantIds = await this.scope.getDescendantReporteeIds(employeeId);
    const reporteeIds = [employeeId, ...descendantIds];
    const hasReportees = descendantIds.length > 0;
    const canUseTeamAttendance = await this.scope.canUseTeamAttendance(employeeId);
    const reportees = descendantIds.length
      ? await this.prisma.manageEmployee.findMany({
          where: { id: { in: descendantIds } },
          select: {
            id: true,
            employeeID: true,
            employeeFirstName: true,
            employeeLastName: true,
          },
        })
      : [];
    return { employeeId, reporteeIds, directReporteeIds, hasReportees, canUseTeamAttendance, reportees, companyID: (await this.prisma.manageEmployee.findUnique({ where: { id: employeeId }, select: { companyID: true } }))?.companyID ?? null };
  }

  @Get('reportee-roster')
  async reporteeRoster(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Query('branchesID') branchesID?: string,
    @Query('departmentID') departmentID?: string,
    @Query('designationID') designationID?: string,
  ) {
    const managerId = this.getEmployeeId(req);
    const directReporteeIds = await this.scope.getDirectReporteeIds(managerId);
    const manager = await this.prisma.manageEmployee.findUnique({
      where: { id: managerId },
      select: { companyID: true },
    });
    const branch = this.optionalId(branchesID);
    const department = this.optionalId(departmentID);
    const designation = this.optionalId(designationID);
    const employees = directReporteeIds.length
      ? await this.prisma.manageEmployee.findMany({
          where: {
            id: { in: directReporteeIds },
            isDeleted: false,
            ...(branch ? { branchesID: branch } : {}),
            ...(department ? { departmentNameID: department } : {}),
            ...(designation ? { designationID: designation } : {}),
          },
          include: {
            workShift: { select: { id: true, workShiftName: true, isRotating: true, isFlexible: true } },
            branches: { select: { id: true, branchName: true } },
            departments: { select: { id: true, departmentName: true } },
            designations: { select: { id: true, designation: true } },
          },
          orderBy: { id: 'asc' },
        })
      : [];
    const companyID = manager?.companyID || employees[0]?.companyID || null;
    const shifts = companyID
      ? await this.prisma.workShift.findMany({
          where: { companyID },
          select: { id: true, workShiftName: true, isRotating: true, isFlexible: true, companyID: true },
          orderBy: { id: 'asc' },
        })
      : [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date(today);
    todayEnd.setHours(23, 59, 59, 999);
    const rosterDays = directReporteeIds.length
      ? await this.prisma.rosterDay.findMany({
          where: {
            workDate: { gte: today, lte: todayEnd },
            dayType: { not: 'WEEKLY_OFF' },
            rosterEmployee: { employeeID: { in: directReporteeIds } },
          },
          select: { rosterEmployee: { select: { employeeID: true } } },
        })
      : [];
    const rosteredToday = new Set(rosterDays.map((day) => day.rosterEmployee.employeeID)).size;
    return { companyID, employees, shifts, rosteredToday };
  }

  @Get('reportee-roster/employee/:employeeID')
  async reporteeRosterEmployee(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Param('employeeID') employeeID: string,
  ) {
    const managerId = this.getEmployeeId(req);
    const id = Number(employeeID);
    await this.assertDirectReportee(managerId, id);
    return this.rosterEmployees.findByEmployeeId(id);
  }

  @Post('reportee-roster/bulk')
  async reporteeRosterBulk(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Body() dto: BulkUpsertRosterDaysDto,
  ) {
    const managerId = this.getEmployeeId(req);
    const employeeID = Number(dto.employeeID);
    if (!employeeID) throw new BadRequestException('Employee is required');
    await this.assertDirectReportee(managerId, employeeID);
    return this.rosterDays.bulkUpsert({ ...dto, employeeID });
  }

  @Delete('reportee-roster/day/:id')
  async reporteeRosterDeleteDay(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Param('id') id: string,
  ) {
    const managerId = this.getEmployeeId(req);
    const day = await this.prisma.rosterDay.findUnique({
      where: { id: Number(id) },
      include: { rosterEmployee: { select: { employeeID: true } } },
    });
    const employeeID = day?.rosterEmployee?.employeeID;
    if (!day || !employeeID) throw new NotFoundException('Roster day not found');
    await this.assertDirectReportee(managerId, employeeID);
    return this.rosterDays.remove(day.id);
  }

  @Get('reportees-today-status')
  async reporteesTodayStatus(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
    if (directReporteeIds.length === 0) {
      return { reportees: [] };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        id: { in: directReporteeIds },
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: this.employeeSelect,
    });

    const reportees = await this.statusForEmployees(employees);

    return { reportees };
  }

  private employeeSelect = {
    id: true,
    employeeID: true,
    employeeFirstName: true,
    employeeLastName: true,
    employeePhotoUrl: true,
    businessEmail: true,
    businessPhoneNo: true,
    personalPhoneNo: true,
    joiningDate: true,
    departmentNameID: true,
    gender: true,
    dateOfBirth: true,
    bloodGroup: true,
    employmentType: true,
    employmentStatus: true,
    empType: true,
    typeOfEmployee: true,
    lifecycleStatus: true,
    designations: { select: { designation: true } },
    departments: { select: { departmentName: true } },
    branches: { select: { branchName: true } },
    workShift: { select: { workShiftName: true } },
    attendancePolicy: { select: { attendancePolicyName: true } },
    leavePolicy: { select: { leavePolicyName: true } },
    empWorkShift: {
      select: { workShift: { select: { workShiftName: true } } },
      orderBy: { id: 'desc' as const },
      take: 1,
    },
    empAttendancePolicy: {
      select: { attendancePolicy: { select: { attendancePolicyName: true } } },
      orderBy: { id: 'desc' as const },
      take: 1,
    },
    empLeavePolicy: {
      select: { leavePolicy: { select: { leavePolicyName: true } } },
      orderBy: { id: 'desc' as const },
      take: 1,
    },
    empDepartment: {
      select: { id: true, departmentNameID: true, effectFrom: true },
      orderBy: { id: 'desc' as const },
    },
  } as const;

  private dateOnly(value?: string | Date | null): string | null {
    if (!value) return null;
    const text = String(value);
    if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text;
    return parsed.toISOString().slice(0, 10);
  }

  private async statusForEmployees(
    employees: Prisma.ManageEmployeeGetPayload<{ select: EmpManagerScopeController['employeeSelect'] }>[],
    opts?: { limited?: boolean },
  ) {
    return Promise.all(
      employees.map(async (emp) => {
        const status = await this.attendance.getTodayStatus(emp.id);
        const checkInIso = status.checkIn?.checkinTime
          ? new Date(status.checkIn.checkinTime).toISOString()
          : null;
        const checkOutIso = status.checkOut?.checkinTime
          ? new Date(status.checkOut.checkinTime).toISOString()
          : null;
        let statusLabel = 'Yet to check-in';
        if (status.isAbsentToday) statusLabel = 'Absent';
        else if (status.isCheckedIn) statusLabel = 'Checked in';
        else if (status.isCheckedOut || status.checkOut) statusLabel = 'Checked out';

        const row = {
          id: emp.id,
          employeeID: emp.employeeID,
          employeeFirstName: emp.employeeFirstName,
          employeeLastName: emp.employeeLastName,
          employeePhotoUrl: emp.employeePhotoUrl ?? null,
          email: emp.businessEmail ?? null,
          contact: emp.businessPhoneNo || emp.personalPhoneNo || null,
          parentBranch: emp.branches?.branchName ?? null,
          department: emp.departments?.departmentName ?? null,
          designation: emp.designations?.designation ?? null,
          gender: emp.gender ?? null,
          dateOfBirth: this.dateOnly(emp.dateOfBirth),
          bloodGroup: emp.bloodGroup ?? null,
          isCheckedIn: status.isCheckedIn,
          isAbsentToday: status.isAbsentToday,
          checkInTime: checkInIso,
          checkOutTime: checkOutIso,
          statusLabel,
        };
        if (opts?.limited) return row;
        return {
          ...row,
          joiningDate: this.dateOnly(emp.joiningDate),
          workShift: emp.empWorkShift?.[0]?.workShift?.workShiftName || emp.workShift?.workShiftName || null,
          attendancePolicy:
            emp.empAttendancePolicy?.[0]?.attendancePolicy?.attendancePolicyName ||
            emp.attendancePolicy?.attendancePolicyName ||
            null,
          leavePolicy:
            emp.empLeavePolicy?.[0]?.leavePolicy?.leavePolicyName ||
            emp.leavePolicy?.leavePolicyName ||
            null,
          employmentType: emp.employmentType ?? null,
          employmentStatus: emp.employmentStatus ?? null,
          employeeType: emp.empType || emp.typeOfEmployee || null,
          lifecycleStatus: emp.lifecycleStatus ?? null,
        };
      }),
    );
  }

  @Get('team-today-status')
  async teamTodayStatus(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Query('scope') scope?: string,
  ) {
    const employeeId = this.getEmployeeId(req);
    const mode = scope === 'reportees' ? 'reportees' : 'team';

    if (mode === 'reportees') {
      const directReporteeIds = await this.scope.getDirectReporteeIds(employeeId);
      if (directReporteeIds.length === 0) {
        return { members: [], scope: mode };
      }
      const employees = await this.prisma.manageEmployee.findMany({
        where: {
          id: { in: directReporteeIds },
          isDeleted: false,
          lifecycleStatus: 'ACTIVE',
        },
        select: this.employeeSelect,
      });
      const members = await this.statusForEmployees(employees);
      return { members, scope: mode };
    }

    const nestedIds = await this.scope.getNestedReporteeIds(employeeId);
    if (nestedIds.length === 0) {
      return { members: [], scope: mode };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        id: { in: nestedIds },
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const members = await this.statusForEmployees(employees);
    return { members, scope: mode };
  }

  @Get('department-peers')
  async departmentPeers(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const me = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { departmentNameID: true },
    });
    if (!me?.departmentNameID) return { members: [] };
    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        departmentNameID: me.departmentNameID,
        id: { not: employeeId },
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });
    const members = await this.statusForEmployees(employees, { limited: true });
    return { members };
  }

  @Get('company-departments')
  async companyDepartments(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const me = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        companyID: true,
        branchesID: true,
        serviceProviderID: true,
        departmentNameID: true,
        branches: { select: { companyID: true } },
      },
    });

    if (!me) {
      return { departments: [] };
    }

    let companyID = me.companyID ?? me.branches?.companyID ?? null;
    let branchesID = me.branchesID ?? null;
    const serviceProviderID = me.serviceProviderID ?? null;

    if (!companyID && me.departmentNameID) {
      const selfDept = await this.prisma.departments.findUnique({
        where: { id: me.departmentNameID },
        select: { companyID: true, branchesID: true },
      });
      if (selfDept) {
        companyID = selfDept.companyID ?? companyID;
        branchesID = selfDept.branchesID ?? branchesID;
      }
    }

    const branchIds: number[] = [];
    if (companyID) {
      const branches = await this.prisma.branches.findMany({
        where: { companyID },
        select: { id: true },
      });
      branchIds.push(...branches.map((b) => b.id));
    } else if (branchesID) {
      branchIds.push(branchesID);
    }

    const employeeWhere: Prisma.ManageEmployeeWhereInput = {
      isDeleted: false,
      lifecycleStatus: 'ACTIVE',
    };

    if (companyID) {
      const or: Prisma.ManageEmployeeWhereInput[] = [{ companyID }];
      if (branchIds.length > 0) or.push({ branchesID: { in: branchIds } });
      employeeWhere.OR = or;
    } else if (branchesID) {
      employeeWhere.branchesID = branchesID;
    } else if (serviceProviderID) {
      employeeWhere.serviceProviderID = serviceProviderID;
    } else {
      return { departments: [] };
    }

    const employees = await this.prisma.manageEmployee.findMany({
      where: employeeWhere,
      select: this.employeeSelect,
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    const employeesWithStatus = await this.statusForEmployees(employees);
    const statusById = new Map(employeesWithStatus.map((e) => [e.id, e]));

    const grouped = new Map<number, typeof employeesWithStatus>();
    const unassigned: typeof employeesWithStatus = [];

    const resolveDepartmentId = (emp: (typeof employees)[number]): number | null => {
      if (emp.departmentNameID) return emp.departmentNameID;
      const latestHistory = Array.isArray(emp.empDepartment)
        ? emp.empDepartment[0]
        : null;
      return latestHistory?.departmentNameID ?? null;
    };

    for (const emp of employees) {
      const row = statusById.get(emp.id);
      if (!row) continue;
      const deptId = resolveDepartmentId(emp);
      if (!deptId) {
        unassigned.push(row);
        continue;
      }
      const list = grouped.get(deptId) ?? [];
      list.push(row);
      grouped.set(deptId, list);
    }

    const deptIds = [...grouped.keys()];

    const departmentBelongsToOrg = (dept: {
      companyID?: number | null;
      branchesID?: number | null;
      serviceProviderID?: number | null;
    }) => {
      if (companyID != null && dept.companyID === companyID) return true;
      if (dept.branchesID != null && branchIds.includes(dept.branchesID)) return true;
      if (
        companyID == null &&
        branchesID != null &&
        dept.branchesID === branchesID
      ) {
        return true;
      }
      if (
        companyID == null &&
        branchesID == null &&
        serviceProviderID != null &&
        dept.serviceProviderID === serviceProviderID
      ) {
        return true;
      }
      return false;
    };

    const deptOr: Prisma.DepartmentsWhereInput[] = [];
    if (companyID) {
      deptOr.push({ companyID });
      deptOr.push({ branches: { companyID } });
    }
    if (branchIds.length > 0) deptOr.push({ branchesID: { in: branchIds } });
    else if (branchesID) deptOr.push({ branchesID });
    if (serviceProviderID) deptOr.push({ serviceProviderID });

    const allOrgDepartments =
      deptOr.length > 0
        ? await this.prisma.departments.findMany({
            where: { OR: deptOr },
            select: {
              id: true,
              departmentName: true,
              companyID: true,
              branchesID: true,
              serviceProviderID: true,
            },
            orderBy: { departmentName: 'asc' },
          })
        : [];

    const orgDeptById = new Map(allOrgDepartments.map((d) => [d.id, d]));

    for (const id of deptIds) {
      if (!orgDeptById.has(id)) {
        const meta = await this.prisma.departments.findUnique({
          where: { id },
          select: {
            id: true,
            departmentName: true,
            companyID: true,
            branchesID: true,
            serviceProviderID: true,
          },
        });
        if (meta && departmentBelongsToOrg(meta)) {
          orgDeptById.set(id, meta);
        }
      }
    }

    const result = [...orgDeptById.values()]
      .map((dept) => ({
        id: dept.id,
        departmentName: dept.departmentName ?? 'Unnamed department',
        employeeCount: grouped.get(dept.id)?.length ?? 0,
        employees: grouped.get(dept.id) ?? [],
      }))
      .sort((a, b) => a.departmentName.localeCompare(b.departmentName));

    if (unassigned.length > 0) {
      result.push({
        id: 0,
        departmentName: 'Unassigned',
        employeeCount: unassigned.length,
        employees: unassigned,
      });
    }

    return { departments: result };
  }

  @Get('member/:id/attendance-history')
  async memberAttendanceHistory(
    @Req()
    req: {
      user?: {
        employeeId?: number;
        sub?: number;
        role?: string;
        companyID?: number;
        type?: string;
      };
    },
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const targetId = Number(id);
    if (!targetId) return { days: [] };

    await this.assertCanViewMemberAttendance(req.user, targetId);

    const parseBound = (v?: string) => {
      if (!v?.trim()) return undefined;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : d;
    };
    let toDate = parseBound(to) ?? new Date();
    if (to) {
      toDate = new Date(
        Date.UTC(toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate(), 23, 59, 59, 999),
      );
    }
    let fromDate = parseBound(from) ?? new Date(toDate.getTime() - 30 * 86400000);
    if (from) {
      fromDate = new Date(
        Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate(), 0, 0, 0, 0),
      );
    }

    const rawRecords = await this.attendance.getMyRecords(targetId, {
      from: fromDate,
      to: toDate,
      limit: 500,
    });
    const merged = await this.attendance.mergeDevicePunchesIntoRecords(
      targetId,
      fromDate,
      toDate,
      rawRecords,
    );
    const records = await this.attendance.enrichAddressesFromProcessLogs(
      targetId,
      fromDate,
      toDate,
      merged,
    );

    const byDay = new Map<string, { date: string; status: string; inTime?: string; outTime?: string }>();
    for (const log of records) {
      const d = new Date(log.checkinTime);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      const row = byDay.get(key) ?? { date: key, status: 'Present' };
      const time = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      if (log.checkType === 'CHECK_IN' && !row.inTime) row.inTime = time;
      if (log.checkType === 'CHECK_OUT') row.outTime = time;
      byDay.set(key, row);
    }

    return {
      days: Array.from(byDay.values()).sort((a, b) => b.date.localeCompare(a.date)),
      records,
    };
  }

  private async assertCanViewMemberAttendance(
    user:
      | {
          employeeId?: number;
          sub?: number;
          role?: string;
          companyID?: number;
          type?: string;
        }
      | undefined,
    targetId: number,
  ) {
    if (!user) throw new UnauthorizedException('Authentication required');
    const role = String(user.role || '').toUpperCase();
    const privileged = new Set([
      'SUPERADMIN',
      'SERVICE_PROVIDER',
      'COMPANY_ADMIN',
      'MULTI_COMPANY_ADMIN',
      'ADMIN',
      'BRANCH_ADMIN',
    ]);

    const target = await this.prisma.manageEmployee.findUnique({
      where: { id: targetId },
      select: { id: true, companyID: true, isDeleted: true },
    });
    if (!target || target.isDeleted) {
      throw new ForbiddenException('Not allowed to view this employee');
    }

    if (role === 'SUPERADMIN' || role === 'SERVICE_PROVIDER') return;

    const tokenCompanyId = Number(user.companyID);
    if (
      privileged.has(role) &&
      Number.isFinite(tokenCompanyId) &&
      tokenCompanyId > 0 &&
      target.companyID === tokenCompanyId
    ) {
      return;
    }

    const viewerEmployeeId = Number(
      user.employeeId ?? (role === 'EMPLOYEE' || user.type === 'employee' ? user.sub : 0),
    );
    if (viewerEmployeeId > 0) {
      const allowed = await this.scope.canViewEmployee(viewerEmployeeId, targetId);
      if (allowed) return;
    }

    throw new ForbiddenException('Not allowed to view this employee');
  }

  private delegationSelect = {
    id: true,
    delegatorId: true,
    delegateeId: true,
    delegationType: true,
    startDate: true,
    endDate: true,
    notification: true,
    description: true,
    status: true,
    createdAt: true,
    delegator: {
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
    },
    delegatee: {
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
    },
  } as const;

  private formatDelegation(row: {
    id: number;
    delegatorId: number;
    delegateeId: number;
    delegationType: string;
    startDate: Date | null;
    endDate: Date | null;
    notification: string;
    description: string | null;
    status: string;
    createdAt: Date;
    delegator: {
      id: number;
      employeeID: string | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      employeePhotoUrl: string | null;
    };
    delegatee: {
      id: number;
      employeeID: string | null;
      employeeFirstName: string | null;
      employeeLastName: string | null;
      employeePhotoUrl: string | null;
    };
  }) {
    const name = (e: { employeeFirstName: string | null; employeeLastName: string | null; employeeID: string | null }) =>
      [e.employeeFirstName, e.employeeLastName].filter(Boolean).join(' ').trim() || e.employeeID || '';
    return {
      id: row.id,
      delegatorId: row.delegatorId,
      delegateeId: row.delegateeId,
      delegationType: row.delegationType,
      startDate: row.startDate ? row.startDate.toISOString().slice(0, 10) : null,
      endDate: row.endDate ? row.endDate.toISOString().slice(0, 10) : null,
      notification: row.notification,
      description: row.description,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      delegatorName: name(row.delegator),
      delegateeName: name(row.delegatee),
      delegatorPhotoUrl: row.delegator.employeePhotoUrl,
      delegateePhotoUrl: row.delegatee.employeePhotoUrl,
    };
  }

  @Get('delegation-colleagues')
  async delegationColleagues(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const self = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: { companyID: true, branchesID: true, serviceProviderID: true },
    });
    if (!self?.companyID) return { colleagues: [] };

    const colleagues = await this.prisma.manageEmployee.findMany({
      where: {
        id: { not: employeeId },
        companyID: self.companyID,
        isDeleted: false,
        lifecycleStatus: 'ACTIVE',
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeePhotoUrl: true,
      },
      orderBy: [{ employeeFirstName: 'asc' }, { employeeLastName: 'asc' }],
    });

    return {
      colleagues: colleagues.map((c) => ({
        id: c.id,
        employeeID: c.employeeID,
        name: [c.employeeFirstName, c.employeeLastName].filter(Boolean).join(' ').trim() || c.employeeID || `Employee #${c.id}`,
        employeePhotoUrl: c.employeePhotoUrl,
      })),
    };
  }

  @Get('delegations')
  async delegations(@Req() req: { user?: { employeeId?: number; sub?: number } }) {
    const employeeId = this.getEmployeeId(req);
    const baseWhere = { isDeleted: false, status: 'ACTIVE' };

    const [asDelegator, asDelegatee] = await Promise.all([
      this.prisma.employeeDelegation.findMany({
        where: { ...baseWhere, delegatorId: employeeId },
        select: this.delegationSelect,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employeeDelegation.findMany({
        where: { ...baseWhere, delegateeId: employeeId },
        select: this.delegationSelect,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      asDelegator: asDelegator.map((r) => this.formatDelegation(r)),
      asDelegatee: asDelegatee.map((r) => this.formatDelegation(r)),
    };
  }

  @Post('delegations')
  async createDelegation(
    @Req() req: { user?: { employeeId?: number; sub?: number } },
    @Body()
    body: {
      delegateeId?: number;
      delegationType?: string;
      startDate?: string;
      endDate?: string;
      notification?: string;
      description?: string;
    },
  ) {
    const employeeId = this.getEmployeeId(req);
    const delegateeId = Number(body.delegateeId);
    if (!delegateeId || delegateeId === employeeId) {
      throw new BadRequestException('A valid delegatee is required');
    }

    const delegationType = (body.delegationType || 'TEMPORARY').toUpperCase();
    if (!['TEMPORARY', 'PERMANENT'].includes(delegationType)) {
      throw new BadRequestException('Invalid delegation type');
    }

    const notification = (body.notification || 'BOTH').toUpperCase();
    if (!['BOTH', 'DELEGATEE_ONLY'].includes(notification)) {
      throw new BadRequestException('Invalid notification option');
    }

    if (delegationType === 'TEMPORARY' && (!body.startDate || !body.endDate)) {
      throw new BadRequestException('Start and end dates are required for temporary delegation');
    }

    const allowed = await this.scope.canViewEmployee(employeeId, delegateeId);
    if (!allowed) throw new ForbiddenException('Cannot delegate to this employee');

    const self = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        companyID: true,
        branchesID: true,
        serviceProviderID: true,
        employeeFirstName: true,
        employeeLastName: true,
        employeeID: true,
      },
    });
    if (!self) throw new UnauthorizedException('Employee not found');

    const created = await this.prisma.employeeDelegation.create({
      data: {
        delegatorId: employeeId,
        delegateeId,
        delegationType,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        notification,
        description: body.description?.trim() || null,
        companyID: self.companyID,
        branchesID: self.branchesID,
        serviceProviderID: self.serviceProviderID,
      },
      select: this.delegationSelect,
    });

    const delegatorName =
      `${self.employeeFirstName ?? ''} ${self.employeeLastName ?? ''}`.trim() ||
      self.employeeID ||
      `Employee #${employeeId}`;
    const dateRange =
      body.startDate && body.endDate
        ? ` from ${body.startDate} to ${body.endDate}`
        : delegationType === 'PERMANENT'
          ? ' (permanent)'
          : '';
    const subject = 'Delegation assignment';
    const description = `${delegatorName} has assigned you as their delegatee${dateRange}.${
      body.description?.trim() ? ` Note: ${body.description.trim()}` : ''
    }`;

    // Always notify the delegatee (email + IM). BOTH also keeps preference on the row.
    void this.mailService
      .sendToEmployeeWithManagerCc({
        employeeId: delegateeId,
        companyID: self.companyID ?? undefined,
        eventType: 'GENERAL',
        vars: { subject, description },
      })
      .catch(() => undefined);

    try {
      await this.prisma.employeeMemo.create({
        data: {
          serviceProviderID: self.serviceProviderID,
          companyID: self.companyID,
          branchesID: self.branchesID,
          employeeID: delegateeId,
          employeeIDs: [delegateeId],
          memoType: 'Information',
          subject,
          description,
          issuedDate: new Date(),
          issuedBy: delegatorName,
          senderEmployeeId: employeeId,
        },
      });
    } catch {
      // Non-fatal: delegation is already created
    }

    return this.formatDelegation(created);
  }
}
