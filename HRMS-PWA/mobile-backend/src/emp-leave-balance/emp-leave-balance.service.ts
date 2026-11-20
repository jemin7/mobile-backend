import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// Map appliedLeaveType values to balance columns
const LEAVE_TYPE_MAP: Record<string, string> = {
  sick: 'sickUsed',
  Sick: 'sickUsed',
  SL: 'sickUsed',
  casual: 'casualUsed',
  Casual: 'casualUsed',
  CL: 'casualUsed',
  privileged: 'privilegedUsed',
  Privileged: 'privilegedUsed',
  PL: 'privilegedUsed',
  compoff: 'compOffUsed',
  CompOff: 'compOffUsed',
  maternity: 'maternityUsed',
  MtL: 'maternityUsed',
  paternity: 'paternityUsed',
  PtL: 'paternityUsed',
};

const BALANCE_COLUMNS = [
  'sickUsed',
  'casualUsed',
  'privilegedUsed',
  'compOffUsed',
  'maternityUsed',
  'paternityUsed',
] as const;

type BalanceColumn = (typeof BALANCE_COLUMNS)[number];

type UsedCounts = Record<BalanceColumn, number>;

type BalanceDb = PrismaService | Prisma.TransactionClient;

const CONSUMING_LEAVE_STATUSES = [
  'Approved',
  'Accepted',
  'Partially Approved',
  'RevokePending',
];

const COLUMN_LABEL: Record<BalanceColumn, string> = {
  sickUsed: 'sick leave',
  casualUsed: 'casual leave',
  privilegedUsed: 'privilege leave',
  compOffUsed: 'comp off',
  maternityUsed: 'maternity leave',
  paternityUsed: 'paternity leave',
};

function emptyUsed(): UsedCounts {
  return {
    sickUsed: 0,
    casualUsed: 0,
    privilegedUsed: 0,
    compOffUsed: 0,
    maternityUsed: 0,
    paternityUsed: 0,
  };
}

/** Sick, casual, or privilege leave selected in Request To Change As. Other statuses are attendance marks. */
export function regularisationLeaveColumn(
  requestedStatus: string | null | undefined,
): BalanceColumn | null {
  const key = String(requestedStatus ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (key === 'SL' || key === 'SICK' || key === 'SICK_LEAVE') return 'sickUsed';
  if (key === 'CL' || key === 'CASUAL' || key === 'CASUAL_LEAVE') return 'casualUsed';
  if (
    key === 'PL' ||
    key === 'PRIVILEGED' ||
    key === 'PRIVILEGE' ||
    key === 'PRIVILEGE_LEAVE' ||
    key === 'PRIVILEGED_LEAVE'
  ) {
    return 'privilegedUsed';
  }
  return null;
}

@Injectable()
export class EmpLeaveBalanceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the leave balance for an employee.
   * Used days are rebuilt from approved leave and approved leave regularisations.
   */
  async getOrInit(manageEmployeeID: number) {
    return this.recompute(manageEmployeeID);
  }

  /**
   * Called when a leave application is approved.
   * Adds the leave days to the corresponding used counter.
   */
  /** Deduct balance per leave type from manager day-by-day assignments. */
  async deductFromDayStatuses(
    manageEmployeeID: number,
    dayStatuses: { status?: string }[] | null,
  ) {
    if (!Array.isArray(dayStatuses) || dayStatuses.length === 0) return;
    const counts: Record<string, number> = {};
    for (const d of dayStatuses) {
      const t = d?.status?.trim();
      if (!t || t === 'LoP' || t === 'ShortLeave') continue;
      counts[t] = (counts[t] || 0) + 1;
    }
    for (const [type, days] of Object.entries(counts)) {
      await this.deductLeave(manageEmployeeID, type, days);
    }
  }

  async deductLeave(
    manageEmployeeID: number,
    appliedLeaveType: string,
    days: number,
  ) {
    if (days <= 0) return;
    const col = LEAVE_TYPE_MAP[appliedLeaveType];
    if (!col) return; // LoP / ShortLeave don't affect balance

    const existing = await this.prisma.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });

    if (!existing) {
      await this.recompute(manageEmployeeID);
      return;
    }

    await this.prisma.empLeaveBalance.update({
      where: { manageEmployeeID },
      data: { [col]: { increment: days } },
    });
  }

  /**
   * Called when an approved leave is revoked (undo the deduction).
   */
  async addBackLeave(
    manageEmployeeID: number,
    appliedLeaveType: string,
    days: number,
  ) {
    if (days <= 0) return;
    const col = LEAVE_TYPE_MAP[appliedLeaveType];
    if (!col) return;

    const balance = await this.prisma.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });
    if (!balance) return;

    const current = Number((balance as unknown as Record<string, number>)[col] ?? 0);
    await this.prisma.empLeaveBalance.update({
      where: { manageEmployeeID },
      data: { [col]: Math.max(0, current - days) },
    });
  }

  /**
   * Refuse approval when the requested days are more than the remaining quota.
   * A quota of 0 means that leave type is not capped.
   */
  async assertRequestedFits(
    manageEmployeeID: number,
    requested: Partial<UsedCounts>,
    db: BalanceDb = this.prisma,
    exclude?: { leaveId?: number; regulariseId?: number },
  ) {
    const used = await this.sumSources(manageEmployeeID, db, exclude);
    const totals = await this.quotaTotals(manageEmployeeID, db);
    for (const col of BALANCE_COLUMNS) {
      const req = requested[col] || 0;
      if (req <= 0) continue;
      const total = totals[col] ?? 0;
      if (total <= 0) continue;
      const remaining = Math.max(total - (used[col] || 0), 0);
      if (req > remaining) {
        throw new BadRequestException(
          `Cannot approve ${req} ${COLUMN_LABEL[col]} day(s): only ${remaining} day(s) remaining in balance.`,
        );
      }
    }
  }

  async assertRegularisationFits(
    manageEmployeeID: number,
    requestedStatus: string | null | undefined,
    db: BalanceDb = this.prisma,
    excludeRegulariseId?: number,
  ) {
    const col = regularisationLeaveColumn(requestedStatus);
    if (!col) return;
    await this.assertRequestedFits(
      manageEmployeeID,
      { [col]: 1 },
      db,
      excludeRegulariseId ? { regulariseId: excludeRegulariseId } : undefined,
    );
  }

  /** Rewrite used days from approved leave applications and approved leave regularisations. */
  async recompute(manageEmployeeID: number, db: BalanceDb = this.prisma) {
    const used = await this.sumSources(manageEmployeeID, db);
    const existing = await db.empLeaveBalance.findUnique({
      where: { manageEmployeeID },
    });
    if (!existing) {
      return db.empLeaveBalance.create({
        data: { manageEmployeeID, ...used },
      });
    }
    return db.empLeaveBalance.update({
      where: { manageEmployeeID },
      data: used,
    });
  }

  requestedCountsFromDayStatuses(
    dayStatuses: { status?: string }[] | null | undefined,
  ): UsedCounts {
    const used = emptyUsed();
    if (!Array.isArray(dayStatuses)) return used;
    for (const day of dayStatuses) {
      const status = day?.status?.trim();
      if (!status || status === 'LoP' || status === 'ShortLeave') continue;
      const col = LEAVE_TYPE_MAP[status];
      if (!col) continue;
      used[col as BalanceColumn] += 1;
    }
    return used;
  }

  private async sumSources(
    manageEmployeeID: number,
    db: BalanceDb,
    exclude?: { leaveId?: number; regulariseId?: number },
  ): Promise<UsedCounts> {
    const used = emptyUsed();

    const leaves = await db.leaveApplication.findMany({
      where: {
        manageEmployeeID,
        status: { in: CONSUMING_LEAVE_STATUSES },
        ...(exclude?.leaveId ? { id: { not: exclude.leaveId } } : {}),
      },
    });

    for (const leave of leaves) {
      const ds = leave.dayStatuses as { status?: string }[] | null;
      if (Array.isArray(ds) && ds.length > 0) {
        const fromDays = this.requestedCountsFromDayStatuses(ds);
        for (const col of BALANCE_COLUMNS) used[col] += fromDays[col];
        continue;
      }
      const col = LEAVE_TYPE_MAP[leave.appliedLeaveType ?? ''];
      if (!col || !leave.fromDate || !leave.toDate) continue;
      const from = new Date(leave.fromDate);
      const to = new Date(leave.toDate);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) continue;
      const days = Math.ceil(Math.abs(to.getTime() - from.getTime()) / 86400000) + 1;
      used[col as BalanceColumn] += days;
    }

    const regularisations = await db.empAttendanceRegularise.findMany({
      where: {
        manageEmployeeID,
        status: { in: ['Approved', 'Accepted'] },
        ...(exclude?.regulariseId ? { id: { not: exclude.regulariseId } } : {}),
      },
      select: { id: true, requestedStatus: true },
    });

    for (const row of regularisations) {
      const col = regularisationLeaveColumn(
        row.requestedStatus != null ? String(row.requestedStatus) : null,
      );
      if (!col) continue;
      used[col] += 1;
    }

    return used;
  }

  private async quotaTotals(
    manageEmployeeID: number,
    db: BalanceDb,
  ): Promise<UsedCounts> {
    const totals = emptyUsed();
    const employee = await db.manageEmployee.findUnique({
      where: { id: manageEmployeeID },
      include: {
        leavePolicy: true,
        empLeavePolicy: {
          include: { leavePolicy: true },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    });
    const policy =
      employee?.leavePolicy ?? employee?.empLeavePolicy?.[0]?.leavePolicy;

    totals.sickUsed = Number(policy?.sickLeaveCount) || 0;
    totals.casualUsed = Number(policy?.casualLeaveCount) || 0;
    totals.maternityUsed = Number(policy?.maternityLeaveCount) || 182;
    totals.paternityUsed = Number(policy?.paternityLeaveCount) || 15;

    const ledger = await db.privilegedLeaveLedger.findMany({
      where: { employeeID: manageEmployeeID },
      select: { balanceLeaves: true },
    });
    totals.privilegedUsed = ledger.reduce(
      (sum, entry) => sum + (Number(entry.balanceLeaves) || 0),
      0,
    );

    return totals;
  }
}
