import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSalaryCycleDto } from './dto/create-salary-cycle.dto';
import { UpdateSalaryCycleDto } from './dto/update-salary-cycle.dto';
import { FindSalaryCycleQueryDto } from './dto/find-salary-cycle.query.dto';
import { buildSalaryPeriodLabels, resolveSalaryPeriod } from './salary-period';

@Injectable()
export class SalaryCycleService {
  constructor(private readonly prisma: PrismaService) {}

  private includeRels() {
    return {
      branches: true,
      company: true,
    };
  }

  async create(dto: CreateSalaryCycleDto) {
    return this.prisma.salaryCycle.create({
      data: {
        serviceProviderID: dto.serviceProviderID ?? null,
        companyID: dto.companyID ?? null,
        branchesID: dto.branchesID ?? null,
        salaryCycleName: dto.salaryCycleName ?? null,
        monthStartDay: dto.monthStartDay ?? null,
      },
      include: this.includeRels(),
    });
  }

  async findAll() {
    return this.prisma.salaryCycle.findMany({
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }

   async findByCompany(companyID: number) {
    return this.prisma.salaryCycle.findMany({
      where: { companyID },
      include: this.includeRels(),
      orderBy: { id: 'desc' },
    });
  }


  async findOne(id: number) {
    const rec = await this.prisma.salaryCycle.findUnique({
      where: { id },
      include: this.includeRels(),
    });
    if (!rec) throw new NotFoundException(`SalaryCycle id ${id} not found`);
    return rec;
  }

  async update(id: number, dto: UpdateSalaryCycleDto) {
    await this.ensureExists(id);
    return this.prisma.salaryCycle.update({
      where: { id },
      data: {
        serviceProviderID: dto.serviceProviderID ?? undefined,
        companyID: dto.companyID ?? undefined,
        branchesID: dto.branchesID ?? undefined,
        salaryCycleName: dto.salaryCycleName ?? undefined,
        monthStartDay: dto.monthStartDay ?? undefined,
      },
      include: this.includeRels(),
    });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    return this.prisma.salaryCycle.delete({
      where: { id },
      include: this.includeRels(),
    });
  }

  private async ensureExists(id: number) {
    const ok = await this.prisma.salaryCycle.findUnique({ where: { id } });
    if (!ok) throw new NotFoundException(`SalaryCycle id ${id} not found`);
  }

  async periodsForEmployee(employeeId: number) {
    const ctx = await this.employeeCycleContext(employeeId);
    if (!ctx.monthStartDay) {
      return {
        employeeId,
        monthStartDay: null as string | null,
        financialYearStart: ctx.financialYearStart,
        periods: [] as string[],
      };
    }
    return {
      employeeId,
      monthStartDay: ctx.monthStartDay,
      financialYearStart: ctx.financialYearStart,
      periods: buildSalaryPeriodLabels(ctx.financialYearStart, ctx.monthStartDay),
    };
  }

  async resolveForEmployee(employeeId: number, monthPeriod: string) {
    const ctx = await this.employeeCycleContext(employeeId);
    if (!ctx.monthStartDay) {
      throw new BadRequestException('This employee does not have a salary cycle.');
    }
    try {
      return resolveSalaryPeriod({
        financialYearStart: ctx.financialYearStart,
        monthStartDay: ctx.monthStartDay,
        monthPeriod,
      });
    } catch {
      throw new BadRequestException(
        'This month does not belong to the salary cycle linked to this employee.',
      );
    }
  }

  private async employeeCycleContext(employeeId: number) {
    const emp = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        companyID: true,
        salaryCycle: { select: { monthStartDay: true } },
        company: { select: { financialYearStart: true } },
      },
    });
    if (!emp) throw new NotFoundException(`Employee ${employeeId} not found`);
    let monthStartDay = emp.salaryCycle?.monthStartDay ?? null;
    if (!monthStartDay && emp.companyID) {
      const companyCycle = await this.prisma.salaryCycle.findFirst({
        where: { companyID: emp.companyID, monthStartDay: { not: null } },
        orderBy: { id: 'asc' },
        select: { monthStartDay: true },
      });
      monthStartDay = companyCycle?.monthStartDay ?? null;
    }
    return {
      monthStartDay: monthStartDay || '1',
      financialYearStart: emp.company?.financialYearStart ?? null,
    };
  }
}
