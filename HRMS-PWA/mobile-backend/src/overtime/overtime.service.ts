// src/overtime/overtime.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import * as dayjs from "dayjs";
import * as customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

@Injectable()
export class OvertimeService {
  private readonly logger = new Logger(OvertimeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Parse string timestamp to Date object
   */
  private parseTimestamp(timestamp: string | Date): dayjs.Dayjs {
    if (typeof timestamp === 'string') {
      // Handle both "2026-01-30 10:00:00" and ISO format
      return dayjs(timestamp, ['YYYY-MM-DD HH:mm:ss', 'YYYY-MM-DDTHH:mm:ss.SSSZ']);
    }
    return dayjs(timestamp);
  }

  /**
   * Format date to string for database query (since punchTimeStamp is String)
   */
  private formatForQuery(date: dayjs.Dayjs): string {
    return date.format('YYYY-MM-DD HH:mm:ss');
  }

  /**
   * Generate OT for ONE employee for ONE date
   */
  async generateForEmployeeDate(employeeID: number, date: Date) {
    try {
      const dayStart = dayjs(date).startOf("day");
      const dayEnd = dayjs(date).endOf("day");

      // 1️⃣ Get ALL punches for the day sorted by time
      const dayPunches = await this.prisma.empAttendanceLogs.findMany({
        where: {
          employeeID,
          // Convert dates to string format for String field comparison
          punchTimeStamp: {
            gte: this.formatForQuery(dayStart),
            lte: this.formatForQuery(dayEnd),
          },
        },
        orderBy: { punchTimeStamp: "asc" },
      });

      // Need at least 2 punches (IN and OUT)
      if (dayPunches.length < 2) {
        this.logger.debug(`Employee ${employeeID}: Less than 2 punches on ${dayStart.format('YYYY-MM-DD')}`);
        return null;
      }

      const firstPunch = dayPunches[0]; // IN time
      const lastPunch = dayPunches[dayPunches.length - 1]; // OUT time
      
      // Parse timestamps
      const firstPunchTime = this.parseTimestamp(firstPunch.punchTimeStamp);
      const lastPunchTime = this.parseTimestamp(lastPunch.punchTimeStamp);
      
      // 2️⃣ Prevent duplicate OT for same day
      const existingOT = await this.prisma.overtime.findFirst({
        where: {
          employeeID,
          workDate: dayStart.toDate(),
        },
      });

   
      // 3️⃣ Get employee with all required relations
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: employeeID },
        include: {
          monthlyPayGrade: true,
        },
      });

      if (!emp) {
        this.logger.error(`Employee ${employeeID} not found`);
        return null;
      }

      // 4️⃣ Validate required fields
      if (!emp.serviceProviderID || !emp.companyID || !emp.branchesID) {
        return null;
      }

      if (!emp.monthlyPayGradeID || !emp.workShiftID) {
        return null;
      }

      // 5️⃣ Check if OT is enabled in paygrade
      if (
        !emp.monthlyPayGrade ||
        emp.monthlyPayGrade.otStatus !== true ||
        !emp.monthlyPayGrade.otRate ||
        emp.monthlyPayGrade.miniOTTime == null
      ) {
        return null;
      }

      // 6️⃣ Get work shift days
      const shiftDays = await this.prisma.workShiftDay.findMany({
        where: {
          workShiftID: emp.workShiftID,
        },
      });

      // Get weekday shift for this day
      const weekday = firstPunchTime.format("dddd"); // e.g., "Monday"
      
      const shiftDay = shiftDays.find(
        (day) => day.weekDay === weekday
      );

      if (!shiftDay || shiftDay.weeklyOff || !shiftDay.endTime) {
        return null;
      }

      // 7️⃣ Calculate shift end time on the same date as punch
      const shiftEndTime = dayjs(shiftDay.endTime);
      const shiftEndOnDate = firstPunchTime
        .hour(shiftEndTime.hour())
        .minute(shiftEndTime.minute())
        .second(shiftEndTime.second());

      const punchOutTime = lastPunchTime;

      // 8️⃣ Calculate overtime minutes (after shift end)
      if (punchOutTime.isBefore(shiftEndOnDate)) {
        return null;
      }

      const overtimeMinutes = punchOutTime.diff(shiftEndOnDate, "minute");

      // 9️⃣ Apply minimum OT time threshold
      if (overtimeMinutes < emp.monthlyPayGrade.miniOTTime) {
      
        return null;
      }

      // 🔟 Calculate OT start time (shift end)
      const otStartTime = shiftEndOnDate.clone();

      // Create OT record
      const otRecord = await this.prisma.overtime.create({
        data: {
          serviceProviderID: emp.serviceProviderID,
          companyID: emp.companyID,
          branchesID: emp.branchesID,
          employeeID,
          workShiftID: emp.workShiftID,
          workDate: dayStart.toDate(),
          shiftStartTime: shiftDay.startTime!,
          shiftEndTime: shiftDay.endTime!,
          punchOutTime: punchOutTime.toDate(),
          otStartTime: otStartTime.toDate(),
          otEndTime: punchOutTime.toDate(),
          otMinutes: overtimeMinutes,
          otHours: parseFloat((overtimeMinutes / 60).toFixed(2)),
          otRate: emp.monthlyPayGrade.otRate,
          status: "PENDING",
        },
      });

      return otRecord;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Bulk generate OT for a date range
   */
  async generateForDateRange(startDate: Date, endDate: Date) {
    const start = dayjs(startDate).startOf("day");
    const end = dayjs(endDate).endOf("day");
    
    // Get all employees
    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        monthlyPayGrade: {
          otStatus: true,
        },
      },
      select: { id: true },
    });


    const results: any[] = [];
    for (const emp of employees) {
      // For each day in range
      let currentDate = start.clone();
      while (currentDate.isBefore(end) || currentDate.isSame(end)) {
        try {
          const result = await this.generateForEmployeeDate(
            emp.id,
            currentDate.toDate()
          );
          if (result) {
            results.push({
              id: result.id,
              employeeID: result.employeeID,
              workDate: result.workDate,
              otMinutes: result.otMinutes,
              otHours: result.otHours,
              status: result.status
            });
          }
        } catch (error) {
          this.logger.error(`Failed for employee ${emp.id} on ${currentDate.format('YYYY-MM-DD')}:`, error);
        }
        currentDate = currentDate.add(1, "day");
      }
    }

    return {
      message: `Processed ${employees.length} employees`,
      overtimeRecordsCreated: results.length,
      records: results,
    };
  }

  /**
   * Recalculate OT for specific employee and date (if needed)
   */
  async recalculateOT(employeeID: number, date: Date) {
    // Delete existing OT for this day
    const dayStart = dayjs(date).startOf("day");
    
    await this.prisma.overtime.deleteMany({
      where: {
        employeeID,
        workDate: dayStart.toDate(),
      },
    });

    // Generate new OT
    return this.generateForEmployeeDate(employeeID, date);
  }

  // ================= CRUD Methods =================

  findAll() {
    return this.prisma.overtime.findMany({
      orderBy: { workDate: "desc" },
    });
  }

  findPending() {
    return this.prisma.overtime.findMany({
      where: { status: "PENDING" },
      orderBy: { workDate: "desc" },
    });
  }

  findForEmployee(employeeID: number, startDate?: Date, endDate?: Date) {
    const where: any = { employeeID };
    
    if (startDate && endDate) {
      where.workDate = {
        gte: dayjs(startDate).startOf("day").toDate(),
        lte: dayjs(endDate).endOf("day").toDate(),
      };
    }

    return this.prisma.overtime.findMany({
      where,
      orderBy: { workDate: "desc" },
    });
  }

  approve(id: number) {
    return this.prisma.overtime.update({
      where: { id },
      data: { status: "APPROVED", updatedAt: new Date() },
    });
  }

  reject(id: number, reason?: string) {
    return this.prisma.overtime.update({
      where: { id },
      data: { 
        status: "REJECTED", 
        updatedAt: new Date(),
        ...(reason && { rejectionReason: reason }),
      },
    });
  }

  remove(id: number) {
    return this.prisma.overtime.delete({ where: { id } });
  }

  /**
   * Debug method to check calculations
   */
  async debugEmployeeOT(employeeID: number, date: Date) {
    const dayStart = dayjs(date).startOf("day");
    const dayEnd = dayjs(date).endOf("day");

    const debugInfo: any = {
      employeeID,
      date: dayStart.format('YYYY-MM-DD'),
      punches: [],
      calculations: {}
    };

    // Get punches
    const punches = await this.prisma.empAttendanceLogs.findMany({
      where: {
        employeeID,
        punchTimeStamp: {
          gte: this.formatForQuery(dayStart),
          lte: this.formatForQuery(dayEnd)
        }
      },
      orderBy: { punchTimeStamp: 'asc' }
    });
    
    debugInfo.punches = punches.map(p => ({
      id: p.id,
      punchTimeStamp: p.punchTimeStamp,
      parsedTime: this.parseTimestamp(p.punchTimeStamp).format('YYYY-MM-DD HH:mm:ss')
    }));
    
    if (punches.length >= 2) {
      const firstPunchTime = this.parseTimestamp(punches[0].punchTimeStamp);
      const lastPunchTime = this.parseTimestamp(punches[punches.length-1].punchTimeStamp);
      
      debugInfo.calculations.firstPunch = firstPunchTime.format('HH:mm:ss');
      debugInfo.calculations.lastPunch = lastPunchTime.format('HH:mm:ss');
      
      // Get employee data
      const emp = await this.prisma.manageEmployee.findUnique({
        where: { id: employeeID },
        include: { monthlyPayGrade: true },
      });
      
      if (emp?.workShiftID) {
        const shiftDays = await this.prisma.workShiftDay.findMany({
          where: { workShiftID: emp.workShiftID }
        });
        
        const weekday = firstPunchTime.format('dddd');
        debugInfo.calculations.weekday = weekday;
        
        const shiftDay = shiftDays.find(d => d.weekDay === weekday);
        debugInfo.calculations.shiftDay = shiftDay;
        
        if (shiftDay?.endTime && emp.monthlyPayGrade) {
          const shiftEnd = dayjs(shiftDay.endTime);
          const shiftEndOnDate = firstPunchTime
            .hour(shiftEnd.hour())
            .minute(shiftEnd.minute())
            .second(shiftEnd.second());
          
          const otMinutes = lastPunchTime.diff(shiftEndOnDate, 'minute');
          
          debugInfo.calculations.shiftEnd = shiftEnd.format('HH:mm:ss');
          debugInfo.calculations.shiftEndOnDate = shiftEndOnDate.format('YYYY-MM-DD HH:mm:ss');
          debugInfo.calculations.punchOut = lastPunchTime.format('YYYY-MM-DD HH:mm:ss');
          debugInfo.calculations.otMinutes = otMinutes;
          debugInfo.calculations.miniOTTime = emp.monthlyPayGrade.miniOTTime;
          debugInfo.calculations.otEligible = otMinutes >= (emp.monthlyPayGrade.miniOTTime || 0);
        }
      }
    }
    
    return debugInfo;
  }

  private clockMinutes(value: string | Date | null | undefined): number | null {
    if (value == null || value === "") return null;
    const text = value instanceof Date ? dayjs(value).format("HH:mm:ss") : String(value);
    const match = text.match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  }

  private overtimeWindowMinutes(
    punches: string[],
    shiftEnd: string | null | undefined,
    otStart: string | null | undefined,
    otEnd: string | null | undefined,
    policy: {
      checkout_end_after_min?: number | null;
      breakTimeForOT?: number | null;
      otMealApply?: boolean | null;
      minsForBreakTimeForMeal?: number | null;
      overtimeTrimmingApply?: boolean | null;
      checkoutGracePeriodForOvertimeTrimming?: number | null;
      minOvertimeHrs?: number | null;
      maxOvertimeHrs?: number | null;
    } | null,
  ): number {
    if (punches.length < 2 || !shiftEnd || !otStart || !otEnd) return 0;
    const last = this.clockMinutes(punches[punches.length - 1]);
    const shiftEndMin = this.clockMinutes(shiftEnd);
    const windowStart = this.clockMinutes(otStart);
    const windowEnd = this.clockMinutes(otEnd);
    if (last == null || shiftEndMin == null || windowStart == null || windowEnd == null) return 0;
    const checkoutBuffer = policy?.checkout_end_after_min || 0;
    if (last <= shiftEndMin + checkoutBuffer) return 0;
    let total = Math.min(last, windowEnd) - Math.max(shiftEndMin, windowStart);
    if ((policy?.breakTimeForOT || 0) > 0) total -= policy?.breakTimeForOT || 0;
    if (policy?.otMealApply && (policy.minsForBreakTimeForMeal || 0) > 0) {
      total -= policy.minsForBreakTimeForMeal || 0;
    }
    if (policy?.overtimeTrimmingApply && (policy.checkoutGracePeriodForOvertimeTrimming || 0) > 0) {
      total -= policy.checkoutGracePeriodForOvertimeTrimming || 0;
    }
    if (total < (policy?.minOvertimeHrs || 0)) return 0;
    if ((policy?.maxOvertimeHrs || 0) > 0 && total > (policy?.maxOvertimeHrs || 0)) {
      total = policy?.maxOvertimeHrs || total;
    }
    return Math.max(0, Math.round(total));
  }

  /**
   * OT minutes after the work-shift end, inside that weekday's OT window.
   * Does not require a pay-grade OT flag, so profile and reports can show the window.
   */
  async preview(input: {
    employeeIds?: number[];
    companyID?: number;
    startDate: string;
    endDate: string;
  }) {
    const start = dayjs(input.startDate).startOf("day");
    const end = dayjs(input.endDate).endOf("day");
    if (!start.isValid() || !end.isValid()) return [];

    const employees = await this.prisma.manageEmployee.findMany({
      where: {
        isDeleted: false,
        ...(input.companyID ? { companyID: input.companyID } : {}),
        ...(input.employeeIds?.length ? { id: { in: input.employeeIds.map(Number) } } : {}),
        workShiftID: { not: null },
      },
      select: {
        id: true,
        employeeID: true,
        employeeFirstName: true,
        employeeLastName: true,
        companyID: true,
        workShiftID: true,
        attendancePolicyID: true,
        branches: { select: { branchName: true } },
        departments: { select: { departmentName: true } },
        designations: { select: { designation: true } },
      },
    });
    if (!employees.length) return [];

    const shiftIds = [...new Set(employees.map((emp) => emp.workShiftID).filter((id): id is number => !!id))];
    const policyIds = [...new Set(employees.map((emp) => emp.attendancePolicyID).filter((id): id is number => !!id))];
    const [shiftDays, policies, punches] = await Promise.all([
      this.prisma.workShiftDay.findMany({ where: { workShiftID: { in: shiftIds } } }),
      policyIds.length
        ? this.prisma.attendancePolicy.findMany({ where: { id: { in: policyIds } } })
        : Promise.resolve([]),
      this.prisma.process_att_logs.findMany({
        where: {
          manage_employee_id: { in: employees.map((emp) => emp.id) },
          punch_time: {
            gte: start.toDate(),
            lte: end.toDate(),
          },
        },
        orderBy: { punch_time: "asc" },
        select: { manage_employee_id: true, punch_time: true },
      }),
    ]);

    const daysByShift = new Map<number, typeof shiftDays>();
    for (const day of shiftDays) {
      if (!day.workShiftID) continue;
      const list = daysByShift.get(day.workShiftID) || [];
      list.push(day);
      daysByShift.set(day.workShiftID, list);
    }
    const policyById = new Map<number, (typeof policies)[number]>();
    for (const policy of policies) policyById.set(policy.id, policy);
    const punchesByEmployee = new Map<number, Map<string, string[]>>();
    for (const punch of punches) {
      if (!punch.manage_employee_id || !punch.punch_time) continue;
      const stamp = dayjs(punch.punch_time).format("YYYY-MM-DD HH:mm:ss");
      const date = stamp.slice(0, 10);
      const byDate = punchesByEmployee.get(punch.manage_employee_id) || new Map<string, string[]>();
      const list = byDate.get(date) || [];
      list.push(stamp);
      byDate.set(date, list);
      punchesByEmployee.set(punch.manage_employee_id, byDate);
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const emp of employees) {
      const days = daysByShift.get(emp.workShiftID || 0) || [];
      const policy = emp.attendancePolicyID ? policyById.get(emp.attendancePolicyID) || null : null;
      const byDate = punchesByEmployee.get(emp.id);
      if (!byDate) continue;
      for (const [date, dayPunches] of byDate) {
        const weekday = dayjs(date).format("dddd").toLowerCase();
        const sameDay = days.filter((day) => (day.weekDay || "").trim().toLowerCase() === weekday);
        const workDay = sameDay.find((day) => (day.shiftType || "WORK").toUpperCase() === "WORK");
        const otDay = sameDay.find((day) => (day.shiftType || "").toUpperCase() === "OT");
        if (!workDay?.endTime || !otDay?.startTime || !otDay.endTime) continue;
        const otMinutes = this.overtimeWindowMinutes(
          dayPunches,
          workDay.endTime,
          otDay.startTime,
          otDay.endTime,
          policy,
        );
        if (otMinutes <= 0) continue;
        rows.push({
          employeeId: emp.id,
          employeeCode: emp.employeeID,
          employeeName: `${emp.employeeFirstName || ""} ${emp.employeeLastName || ""}`.trim(),
          branch: emp.branches?.branchName || "",
          department: emp.departments?.departmentName || "",
          designation: emp.designations?.designation || "",
          date,
          shiftEnd: workDay.endTime,
          punchOut: dayPunches[dayPunches.length - 1],
          otMinutes,
        });
      }
    }
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
}