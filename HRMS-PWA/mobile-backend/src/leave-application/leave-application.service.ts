import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLeaveApplicationDto } from './dto/create-leave-application.dto';
import { UpdateLeaveApplicationDto } from './dto/update-leave-application.dto';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { EmpLeaveBalanceService } from '../emp-leave-balance/emp-leave-balance.service';
import { MailService } from '../mail/mail.service';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import {
  leavePushTitle,
  senderLabelFromRole,
} from '../common/notification-sender.util';
import { EmployeeMemoService } from '../employee-memo/employee-memo.service';

@Injectable()
export class LeaveApplicationService {
  constructor(
    private prisma: PrismaService,
    private pushService: PushNotificationsService,
    private leaveBalanceService: EmpLeaveBalanceService,
    private mailService: MailService,
    private managerScope: EmpManagerScopeService,
    private employeeMemoService: EmployeeMemoService,
  ) {}

  private employeeDisplayName(emp?: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  } | null): string {
    if (!emp) return 'An employee';
    const name = `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim();
    return name || emp.employeeID || 'An employee';
  }

  private formatLeaveDates(fromDate?: unknown, toDate?: unknown): string {
    const from = fromDate ? String(fromDate).slice(0, 10) : '';
    const to = toDate ? String(toDate).slice(0, 10) : '';
    if (from && to && from !== to) return `${from} to ${to}`;
    return from || to || '';
  }

  private postLeaveCompanyBroadcast(opts: {
    companyID?: number | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
    subjectEmployeeID?: number | null;
    employeeName: string;
    leaveType?: string | null;
    fromDate?: unknown;
    toDate?: unknown;
    status: string;
  }): void {
    if (!opts.companyID) return;
    const dates = this.formatLeaveDates(opts.fromDate, opts.toDate);
    const type = opts.leaveType?.trim() ? ` (${opts.leaveType.trim()})` : '';
    const datePart = dates ? ` for ${dates}` : '';
    void this.employeeMemoService
      .createSystemStaffBroadcast({
        companyID: opts.companyID,
        branchesID: opts.branchesID,
        serviceProviderID: opts.serviceProviderID,
        subjectEmployeeIDs: opts.subjectEmployeeID ? [opts.subjectEmployeeID] : [],
        description: `Leave ${opts.status}: ${opts.employeeName}${type}${datePart}`,
      })
      .catch(() => null);
  }

  private parsePayload(data: Record<string, unknown>) {
    const payload = { ...data };
    for (const key of ['fromDate', 'toDate', 'revokedAt'] as const) {
      if (payload[key] != null && payload[key] !== '') {
        payload[key] = new Date(String(payload[key]));
      }
    }
    return payload;
  }

  async create(createLeaveApplicationDto: CreateLeaveApplicationDto) {
    const created = await this.prisma.leaveApplication.create({
      data: this.parsePayload(createLeaveApplicationDto as Record<string, unknown>) as any,
      include: {
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
    if (created.manageEmployeeID) {
      void this.mailService.sendToEmployeeWithManagerCc({
        employeeId: created.manageEmployeeID,
        companyID: created.companyID,
        eventType: 'LEAVE_APPLICATION',
        vars: {
          fromDate: String(created.fromDate ?? ''),
          toDate: String(created.toDate ?? ''),
          status: String(created.status ?? 'Pending'),
          purpose: String(created.purpose ?? ''),
        },
      });
      this.postLeaveCompanyBroadcast({
        companyID: created.companyID,
        branchesID: created.branchesID,
        serviceProviderID: created.serviceProviderID,
        subjectEmployeeID: created.manageEmployeeID,
        employeeName: this.employeeDisplayName(created.manageEmployee),
        leaveType: created.appliedLeaveType,
        fromDate: created.fromDate,
        toDate: created.toDate,
        status: String(created.status ?? 'Pending'),
      });
    }
    return created;
  }

  async findByEmployee(empId: number) {
    const scopeIds = await this.managerScope.getReporteeIds(empId);
    return this.prisma.leaveApplication.findMany({
      where: { manageEmployeeID: { in: scopeIds } },
      include: {
        company: true,
        branches: true,
        manageEmployee: {
          include: {
            departments: { select: { id: true, departmentName: true } },
            designations: { select: { id: true, designation: true } },
            branches: { select: { branchName: true } },
          },
        },
      },
      orderBy: { id: 'desc' },
    });
  }


  findAll() {
    return this.prisma.leaveApplication.findMany({
      include: {
        company: true,
        branches: true,
        manageEmployee: {
          include: {
            departments: { select: { id: true, departmentName: true } },
            designations: { select: { id: true, designation: true } },
          },
        },
      },
    });
  }

  findOne(id: number) {
    return this.prisma.leaveApplication.findUnique({
      where: { id },
      include: {
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });
  }

 async revokeLeave(id: number, revokedReason?: string) {
  const leave = await this.prisma.leaveApplication.findUnique({ where: { id } })
  if (!leave) throw new NotFoundException('Leave not found')

  // Only approved leaves can go to revoke request
  if (leave.status !== 'Approved') {
    throw new BadRequestException('Only approved leaves can be revoked')
  }

  // === Append to old revoke history (in the same String field) ===
  const oldReason = leave.revokedReason ? leave.revokedReason + '\n' : ''
  const reasonLog =
    oldReason +
    `[${new Date().toLocaleString()}] Revoke requested: ${
      revokedReason ?? '(no reason provided)'
    }`

  // === Update leave record ===
  const updated = await this.prisma.leaveApplication.update({
    where: { id },
    data: {
      status: 'RevokePending', // waiting for manager approval
      revokedReason: reasonLog, // append old + new reasons
      revokedAt: new Date(), // store last request date/time
    },
  })

  return {
    message: 'Revoke request logged and waiting for approval',
    data: updated,
  }
}





  private normalizeDayStatusesInput(
    raw: unknown,
  ): { date: string; status: string; dayType?: string }[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    return raw
      .map((d: { date?: string; status?: string; dayType?: string }) => {
        const date = d?.date ? String(d.date).slice(0, 10) : '';
        if (!date) return null;
        const status = d?.status ? String(d.status).trim() : '';
        const row: { date: string; status: string; dayType?: string } = { date, status };
        if (d?.dayType) row.dayType = String(d.dayType);
        return row;
      })
      .filter((d): d is { date: string; status: string; dayType?: string } => d != null);
  }

  private async assertApprovalWithinLeaveBalance(
    manageEmployeeID: number,
    excludeApplicationId: number,
    dayStatuses: { status?: string }[],
  ) {
    if (!dayStatuses?.length) return;
    const requested = this.leaveBalanceService.requestedCountsFromDayStatuses(dayStatuses);
    await this.leaveBalanceService.assertRequestedFits(
      manageEmployeeID,
      requested,
      this.prisma,
      { leaveId: excludeApplicationId },
    );
  }

  async update(id: number, updateLeaveApplicationDto: UpdateLeaveApplicationDto) {
    const { actorRole, ...leaveData } = updateLeaveApplicationDto;
    const actorLabel = actorRole ? senderLabelFromRole(actorRole) : undefined;

    // Fetch the current leave record so we know the previous status
    const current = await this.prisma.leaveApplication.findUnique({ where: { id } });

    const APPROVED_STATUSES = ['Approved', 'Accepted', 'Partially Approved'];
    let nextStatus = leaveData.status ?? current?.status ?? '';
    const ds = this.normalizeDayStatusesInput(leaveData.dayStatuses);

    if (Array.isArray(ds) && ds.length > 0) {
      const assigned = ds.filter((d) => d?.status).length;
      const unassigned = ds.length - assigned;
      if (assigned > 0 && unassigned > 0) {
        nextStatus = 'Partially Approved';
        leaveData.status = 'Partially Approved';
      } else if (assigned > 0 && unassigned === 0 && nextStatus === 'Partially Approved') {
        leaveData.status = 'Approved';
        nextStatus = 'Approved';
      } else if (assigned > 0 && unassigned === 0 && !['Rejected', 'Pending'].includes(nextStatus)) {
        leaveData.status = leaveData.status || 'Approved';
        nextStatus = leaveData.status;
      }
    }

    if (
      APPROVED_STATUSES.includes(nextStatus) &&
      current?.manageEmployeeID &&
      Array.isArray(ds) &&
      ds.some((d) => d?.status)
    ) {
      await this.assertApprovalWithinLeaveBalance(
        current.manageEmployeeID,
        id,
        ds,
      );
    }

    const prismaData = this.parsePayload({ ...leaveData } as Record<string, unknown>);
    if (Array.isArray(ds) && ds.length > 0) {
      prismaData.dayStatuses = ds;
    }

    const updated = await this.prisma.leaveApplication.update({
      where: { id },
      data: prismaData as typeof leaveData,
      include: {
        company: true,
        branches: true,
        manageEmployee: true,
      },
    });

    const isNowApproved = APPROVED_STATUSES.includes(updated.status ?? '');
    const wasNotApproved = !APPROVED_STATUSES.includes(current?.status ?? '');

    // Rebuild used days from every approved leave and every approved leave regularisation.
    if (updated.manageEmployeeID && (isNowApproved || !wasNotApproved)) {
      await this.leaveBalanceService.recompute(updated.manageEmployeeID);
    }

    const empId = updated.manageEmployeeID;
    if (empId) {
      const newStatus = updated.status ?? '';
      const prevStatus = current?.status ?? '';
      if (newStatus === 'Rejected' && prevStatus !== 'Rejected') {
        this.pushService
          .sendToEmployeeAndManagers(
            empId,
            leavePushTitle('Rejected', actorLabel),
            'Your leave application has been rejected.',
            { url: '/empLeaveApplication', kind: 'leave' },
          )
          .catch(() => null);
      } else if (
        newStatus === 'Partially Approved' &&
        prevStatus !== 'Partially Approved'
      ) {
        const ds = (updated.dayStatuses as { status?: string }[]) || [];
        const approved = ds.filter((d) => d?.status).length;
        const total = ds.length;
        this.pushService
          .sendToEmployeeAndManagers(
            empId,
            leavePushTitle('Partially Approved', actorLabel),
            `Your leave was partially approved: ${approved} of ${total} day(s) approved.`,
            { url: '/empLeaveApplication', kind: 'leave' },
          )
          .catch(() => null);
      } else if (
        (newStatus === 'Approved' || newStatus === 'Accepted') &&
        !['Approved', 'Accepted'].includes(prevStatus)
      ) {
        this.pushService
          .sendToEmployeeAndManagers(
            empId,
            leavePushTitle(newStatus, actorLabel),
            'Your leave application has been approved.',
            { url: '/empLeaveApplication', kind: 'leave' },
          )
          .catch(() => null);
      }

      if (newStatus !== prevStatus) {
        void this.mailService.sendToEmployeeWithManagerCc({
          employeeId: empId,
          companyID: updated.companyID,
          eventType: 'LEAVE_APPLICATION',
          vars: {
            fromDate: String(updated.fromDate ?? ''),
            toDate: String(updated.toDate ?? ''),
            status: String(newStatus),
            purpose: String(updated.purpose ?? ''),
          },
        });
        this.postLeaveCompanyBroadcast({
          companyID: updated.companyID,
          branchesID: updated.branchesID,
          serviceProviderID: updated.serviceProviderID,
          subjectEmployeeID: updated.manageEmployeeID,
          employeeName: this.employeeDisplayName(updated.manageEmployee),
          leaveType: updated.appliedLeaveType,
          fromDate: updated.fromDate,
          toDate: updated.toDate,
          status: String(newStatus),
        });
      }
    }

    return updated;
  }

  async remove(id: number) {
    const existing = await this.prisma.leaveApplication.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Leave application not found');
    }
    await this.prisma.leaveApplicationRequest.deleteMany({
      where: { leaveApplicationID: id },
    });
    return this.prisma.leaveApplication.delete({
      where: { id },
    });
  }
}
