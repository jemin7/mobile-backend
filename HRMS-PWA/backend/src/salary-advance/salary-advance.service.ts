import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryAdvanceDto } from './dto/create-salary-advance.dto';
import { UpdateSalaryAdvanceDto } from './dto/update-salary-advance.dto';
import { ScheduleSalaryAdvanceDto } from './dto/schedule-salary-advance.dto';
import { DisburseSalaryAdvanceDto } from './dto/disburse-salary-advance.dto';
import { EmpManagerScopeService } from '../common/emp-manager-scope.service';
import { EmployeeMemoService } from '../employee-memo/employee-memo.service';
import { SalaryCycleService } from '../salary-cycle/salary-cycle.service';
import { parseSalaryPeriodLabel } from '../salary-cycle/salary-period';

const OPEN_STATUSES = new Set(['Pending', 'Approved', 'Disbursed', 'Partially Recovered']);

@Injectable()
export class SalaryAdvanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly managerScope: EmpManagerScopeService,
    private readonly employeeMemoService: EmployeeMemoService,
    private readonly salaryCycleService: SalaryCycleService,
  ) {}

  private includeRels() {
    return {
      company: true,
      branches: true,
      manageEmployee: {
        include: {
          departments: { select: { departmentName: true } },
          branches: { select: { branchName: true } },
        },
      },
      salaryAdvanceRepayment: { orderBy: { id: 'asc' as const } },
    };
  }

  private money(value: unknown): number {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  private moneyText(value: number): string {
    return (Math.round(value * 100) / 100).toFixed(2);
  }

  private splitAmounts(total: number, count: number): number[] {
    const parts = Math.max(1, count);
    const paise = Math.round(total * 100);
    const base = Math.floor(paise / parts);
    const amounts = Array.from({ length: parts }, () => base);
    amounts[parts - 1] += paise - base * parts;
    return amounts.map((p) => p / 100);
  }

  private employeeDisplayName(emp?: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  } | null): string {
    if (!emp) return 'An employee';
    const name = `${emp.employeeFirstName ?? ''} ${emp.employeeLastName ?? ''}`.trim();
    return name || emp.employeeID || 'An employee';
  }

  private postLoanBroadcast(rec: {
    companyID?: number | null;
    branchesID?: number | null;
    serviceProviderID?: number | null;
    manageEmployeeID?: number | null;
    status?: string | null;
    advanceAmount?: string | null;
    manageEmployee?: {
      employeeFirstName?: string | null;
      employeeLastName?: string | null;
      employeeID?: string | null;
    } | null;
  }): void {
    if (!rec.companyID || !rec.manageEmployeeID) return;
    const amount = rec.advanceAmount?.trim() ? ` — ${rec.advanceAmount.trim()}` : '';
    void this.employeeMemoService
      .createSystemStaffBroadcast({
        companyID: rec.companyID,
        branchesID: rec.branchesID,
        serviceProviderID: rec.serviceProviderID,
        subjectEmployeeIDs: [rec.manageEmployeeID],
        description: `Loan advance ${rec.status || 'Pending'}: ${this.employeeDisplayName(rec.manageEmployee)}${amount}`,
      })
      .catch(() => null);
  }

  private advanceData(dto: CreateSalaryAdvanceDto | UpdateSalaryAdvanceDto) {
    const { repaymentTanure: _ignored, ...data } = dto;
    return data;
  }

  async create(dto: CreateSalaryAdvanceDto) {
    const created = await this.prisma.salaryAdvance.create({
      data: {
        ...this.advanceData(dto),
        requestType: dto.requestType || 'SALARY_ADVANCE',
        repaymentType: dto.repaymentType || null,
        instalmentCount: dto.repaymentType === 'INSTALMENTS' ? dto.instalmentCount || null : dto.repaymentType ? 1 : null,
      },
      include: this.includeRels(),
    });
    this.postLoanBroadcast(created);
    if (dto.deductionStartPeriod && dto.advanceAmount) {
      try {
        return await this.replaceSchedule(created.id, {
          amount: dto.advanceAmount,
          repaymentType: dto.repaymentType === 'INSTALMENTS' ? 'INSTALMENTS' : 'ONE_TIME',
          deductionStartPeriod: dto.deductionStartPeriod,
          instalmentCount: dto.instalmentCount,
          approve: false,
        });
      } catch (error) {
        await this.prisma.salaryAdvance.delete({ where: { id: created.id } }).catch(() => null);
        throw error;
      }
    }
    return created;
  }

  async findAll() {
    return this.prisma.salaryAdvance.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findByEmployee(empId: number) {
    const [direct, nested] = await Promise.all([
      this.managerScope.getDirectReporteeIds(empId),
      this.managerScope.getNestedReporteeIds(empId),
    ]);
    const scopeIds = [...new Set([empId, ...direct, ...nested])];
    return this.prisma.salaryAdvance.findMany({
      where: { manageEmployeeID: { in: scopeIds } },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

  async findOne(id: number) {
    const rec = await this.prisma.salaryAdvance.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryAdvanceDto) {
    const before = await this.ensureExists(id);
    const updated = await this.prisma.salaryAdvance.update({
      where: { id },
      data: this.advanceData(dto),
      include: this.includeRels(),
    });
    if ((dto.status || updated.status) && before.status !== updated.status) {
      this.postLoanBroadcast(updated);
    }
    if (dto.deductionStartPeriod && OPEN_STATUSES.has(updated.status || '')) {
      return this.replaceSchedule(id, {
        amount: dto.approvedAmount || updated.approvedAmount || updated.advanceAmount || '0',
        repaymentType: (dto.repaymentType || updated.repaymentType || 'ONE_TIME') as 'ONE_TIME' | 'INSTALMENTS',
        deductionStartPeriod: dto.deductionStartPeriod,
        instalmentCount: dto.instalmentCount ?? updated.instalmentCount ?? undefined,
        approve: false,
      });
    }
    return updated;
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.salaryAdvance.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  async replaceSchedule(id: number, input: ScheduleSalaryAdvanceDto) {
    const advance = await this.prisma.salaryAdvance.findUnique({
      where: { id },
      include: { salaryAdvanceRepayment: true },
    });
    if (!advance) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    if (!advance.manageEmployeeID) throw new BadRequestException('Choose an employee before setting a repayment schedule');
    if (advance.status === 'Rejected' || advance.status === 'Fully Recovered') {
      throw new BadRequestException('This request can no longer be rescheduled');
    }

    const requested = this.money(advance.advanceAmount);
    let target = this.money(input.amount);
    if (target <= 0) throw new BadRequestException('Amount must be greater than 0');
    const disbursed = this.money(advance.disbursedAmount);
    const alreadyDisbursed =
      disbursed > 0 ||
      !!advance.disbursementDate ||
      advance.status === 'Disbursed' ||
      advance.status === 'Partially Recovered';
    if (alreadyDisbursed && disbursed > 0) target = disbursed;
    if (!alreadyDisbursed && requested > 0 && target - requested > 0.009) {
      throw new BadRequestException('Approved amount cannot exceed the requested amount');
    }

    const repaymentType = input.repaymentType === 'INSTALMENTS' ? 'INSTALMENTS' : 'ONE_TIME';
    const count = repaymentType === 'ONE_TIME' ? 1 : Math.max(1, Number(input.instalmentCount) || 1);
    const { periods } = await this.salaryCycleService.periodsForEmployee(advance.manageEmployeeID);
    if (!periods.includes(input.deductionStartPeriod)) {
      throw new BadRequestException('Deduction month is not on this employee’s salary cycle');
    }

    const salaries = await this.prisma.generateSalary.findMany({
      where: { employeeID: advance.manageEmployeeID },
      select: { monthPeriod: true },
    });
    const takenPeriods = new Set(salaries.map((row) => row.monthPeriod));
    const locked = advance.salaryAdvanceRepayment.filter((row) => {
      const period = row.periodLabel || '';
      return row.status === 'Recovered' || row.generateSalaryID != null || (!!period && takenPeriods.has(period));
    });
    const lockedIds = locked.map((row) => row.id);
    const lockedTotal = locked.reduce((sum, row) => sum + this.money(row.amount), 0);
    if (lockedTotal - target > 0.009) {
      throw new BadRequestException('Amount is less than instalments already taken by payroll');
    }
    const remaining = Math.round((target - lockedTotal) * 100) / 100;
    const occupied = new Set<string>(takenPeriods);
    for (const row of locked) {
      if (row.periodLabel) occupied.add(row.periodLabel);
    }
    const startAt = periods.indexOf(input.deductionStartPeriod);
    const open = periods.slice(Math.max(0, startAt)).filter((label) => !occupied.has(label));
    if (remaining > 0.009 && open.length < count) {
      throw new BadRequestException('Not enough open salary periods remain for this schedule');
    }
    const chosen = remaining > 0.009 ? open.slice(0, count) : [];
    const parts = chosen.length ? this.splitAmounts(remaining, chosen.length) : [];

    await this.prisma.$transaction(async (tx) => {
      await tx.salaryAdvanceRepayment.deleteMany({
        where: {
          salaryAdvanceID: id,
          ...(lockedIds.length ? { id: { notIn: lockedIds } } : {}),
        },
      });
      for (let i = 0; i < chosen.length; i++) {
        const label = chosen[i];
        const parsed = parseSalaryPeriodLabel(label);
        await tx.salaryAdvanceRepayment.create({
          data: {
            salaryAdvanceID: id,
            approvedAmount: this.moneyText(target),
            amount: this.moneyText(parts[i]),
            periodLabel: label,
            startMonth: parsed.start,
            status: 'Scheduled',
          },
        });
      }

      const recovered = this.money(advance.recoveredAmount);
      let status = advance.status || 'Pending';
      if (input.approve && !alreadyDisbursed) status = 'Approved';
      const outstanding = Math.max(0, Math.round((target - (alreadyDisbursed ? recovered : 0)) * 100) / 100);
      if (alreadyDisbursed) {
        status = outstanding <= 0.009 ? 'Fully Recovered' : recovered > 0.009 ? 'Partially Recovered' : 'Disbursed';
      }

      await tx.salaryAdvance.update({
        where: { id },
        data: {
          approvedAmount: alreadyDisbursed ? advance.approvedAmount : input.approve ? this.moneyText(target) : advance.approvedAmount,
          repaymentType,
          deductionStartPeriod: input.deductionStartPeriod,
          instalmentCount: count,
          instalmentAmount: parts[0] != null ? this.moneyText(parts[0]) : null,
          outstandingBalance: alreadyDisbursed ? this.moneyText(outstanding) : advance.outstandingBalance,
          status,
        },
      });
    });

    return this.findOne(id);
  }

  async disburse(id: number, dto: DisburseSalaryAdvanceDto) {
    const advance = await this.findOne(id);
    if (advance.status !== 'Approved') {
      throw new BadRequestException('Approve the request before recording disbursement');
    }
    if (!advance.deductionStartPeriod) {
      throw new BadRequestException('Set a deduction month before recording disbursement');
    }
    const amount = this.money(dto.disbursedAmount);
    if (amount <= 0) throw new BadRequestException('Disbursed amount must be greater than 0');
    const approved = this.money(advance.approvedAmount || advance.advanceAmount);
    if (approved > 0 && amount - approved > 0.009) {
      throw new BadRequestException('Disbursed amount cannot exceed the approved amount');
    }

    await this.prisma.salaryAdvance.update({
      where: { id },
      data: {
        disbursedAmount: this.moneyText(amount),
        disbursementDate: new Date(dto.disbursementDate),
        paymentReference: dto.paymentReference?.trim() || null,
        recoveredAmount: advance.recoveredAmount || '0.00',
        outstandingBalance: this.moneyText(amount),
        status: 'Disbursed',
      },
    });

    return this.replaceSchedule(id, {
      amount: this.moneyText(amount),
      repaymentType: advance.repaymentType === 'INSTALMENTS' ? 'INSTALMENTS' : 'ONE_TIME',
      deductionStartPeriod: advance.deductionStartPeriod,
      instalmentCount: advance.instalmentCount ?? undefined,
      approve: false,
    });
  }

  async applyPayrollRecoveries(generateSalaryID: number, employeeID: number, monthPeriod: string) {
    let periodStart: Date;
    try {
      periodStart = parseSalaryPeriodLabel(monthPeriod).start;
    } catch {
      return;
    }
    const rows = await this.prisma.salaryAdvanceRepayment.findMany({
      where: { salaryAdvance: { manageEmployeeID: employeeID } },
      include: { salaryAdvance: true },
      orderBy: { id: 'asc' },
    });
    const due = rows.filter((row) => this.instalmentMatchesPayroll(row, monthPeriod, periodStart, generateSalaryID));
    for (const row of due) {
      await this.claimInstalment(row.id, generateSalaryID);
    }
  }

  async releasePayrollRecoveries(generateSalaryID: number) {
    const rows = await this.prisma.salaryAdvanceRepayment.findMany({
      where: { generateSalaryID },
      include: { salaryAdvance: true },
    });
    const byAdvance = new Map<number, typeof rows>();
    for (const row of rows) {
      const list = byAdvance.get(row.salaryAdvanceID) || [];
      list.push(row);
      byAdvance.set(row.salaryAdvanceID, list);
    }
    for (const [advanceId, instalments] of byAdvance) {
      const released = instalments.reduce((sum, row) => sum + this.money(row.amount), 0);
      const advance = instalments[0].salaryAdvance;
      const recovered = Math.max(0, Math.round((this.money(advance.recoveredAmount) - released) * 100) / 100);
      const outstanding = Math.round((this.money(advance.outstandingBalance) + released) * 100) / 100;
      const wasDisbursed = !!advance.disbursementDate || this.money(advance.disbursedAmount) > 0;
      const status =
        recovered <= 0.009
          ? wasDisbursed
            ? 'Disbursed'
            : 'Approved'
          : outstanding <= 0.009
            ? 'Fully Recovered'
            : 'Partially Recovered';
      await this.prisma.$transaction([
        this.prisma.salaryAdvanceRepayment.updateMany({
          where: { id: { in: instalments.map((row) => row.id) } },
          data: { status: 'Scheduled', generateSalaryID: null },
        }),
        this.prisma.salaryAdvance.update({
          where: { id: advanceId },
          data: {
            recoveredAmount: this.moneyText(recovered),
            outstandingBalance: this.moneyText(outstanding),
            status,
          },
        }),
      ]);
    }
  }

  private instalmentMatchesPayroll(
    row: {
      status: string | null;
      generateSalaryID: number | null;
      periodLabel: string | null;
      startMonth: Date | null;
      salaryAdvance: { status: string | null };
    },
    monthPeriod: string,
    periodStart: Date,
    generateSalaryID: number,
  ): boolean {
    if (row.generateSalaryID === generateSalaryID || row.generateSalaryID || row.status === 'Recovered') return false;
    const parent = row.salaryAdvance.status;
    const legacy = !row.periodLabel;
    const eligible =
      parent === 'Disbursed' ||
      parent === 'Partially Recovered' ||
      (parent === 'Approved' && legacy);
    if (!eligible) return false;
    if (row.periodLabel) return row.periodLabel === monthPeriod;
    if (!row.startMonth) return false;
    return (
      row.startMonth.getUTCFullYear() === periodStart.getFullYear() &&
      row.startMonth.getUTCMonth() === periodStart.getMonth()
    );
  }

  private async claimInstalment(repaymentId: number, generateSalaryID: number) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.salaryAdvanceRepayment.findUnique({ where: { id: repaymentId } });
      if (!current || current.generateSalaryID || current.status === 'Recovered') return;
      const advance = await tx.salaryAdvance.findUnique({
        where: { id: current.salaryAdvanceID },
        include: { salaryAdvanceRepayment: true },
      });
      if (!advance) return;
      const amount = this.money(current.amount);
      const scheduleTotal = advance.salaryAdvanceRepayment.reduce((sum, row) => sum + this.money(row.amount), 0);
      const recoveredBefore = this.money(advance.recoveredAmount);
      const outstandingBefore =
        advance.outstandingBalance != null && advance.outstandingBalance !== ''
          ? this.money(advance.outstandingBalance)
          : Math.max(0, Math.round((scheduleTotal - recoveredBefore) * 100) / 100);
      const recovered = Math.round((recoveredBefore + amount) * 100) / 100;
      const outstanding = Math.max(0, Math.round((outstandingBefore - amount) * 100) / 100);
      await tx.salaryAdvanceRepayment.update({
        where: { id: current.id },
        data: { status: 'Recovered', generateSalaryID },
      });
      await tx.salaryAdvance.update({
        where: { id: advance.id },
        data: {
          recoveredAmount: this.moneyText(recovered),
          outstandingBalance: this.moneyText(outstanding),
          status: outstanding <= 0.009 ? 'Fully Recovered' : 'Partially Recovered',
        },
      });
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryAdvance.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryAdvance id ${id} not found`);
    return ok;
  }
}
