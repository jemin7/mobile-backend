import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { ApprovalEngineService } from '../approval-workflow/approval-engine.service';
import { EmpLeaveBalanceService } from '../emp-leave-balance/emp-leave-balance.service';
import { CreateEmpAttendanceRegulariseDto } from './dto/create-emp-attendance-regularise.dto';
import { UpdateEmpAttendanceRegulariseDto } from './dto/update-emp-attendance-regularise.dto';

@Injectable()
export class EmpAttendanceRegulariseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly leaveBalance: EmpLeaveBalanceService,
  ) {}

  private parsePayload(
    data: Record<string, unknown>,
  ) {
    const payload = {
      ...data,
    };

    for (
      const key
      of [
        'attendanceDate',
        'checkInTime',
        'checkOutTime',
      ] as const
    ) {
      if (
        payload[key] != null &&
        payload[key] !== ''
      ) {
        payload[key] =
          key ===
          'attendanceDate'
            ? this.normalizeAttendanceDay(
                String(
                  payload[key],
                ),
              )
            : new Date(
                String(
                  payload[key],
                ),
              );
      }
    }

    return payload;
  }

  private normalizeStoredStatus(
    value: unknown,
    kind: 'actual' | 'requested',
  ): string | null {
    if (value == null || String(value).trim() === '') return null;
    const raw = String(value).replace(' (Regularized)', '').trim().toUpperCase();
    if (kind === 'requested') {
      const allowed = new Set([
        'PRESENT',
        'HALF_DAY',
        'LATE_MARK',
        'SL',
        'CL',
        'PL',
        'LOP',
        'WEEKOFF',
        'ABSENT',
      ]);
      if (raw === 'WEEK_OFF') return 'WEEKOFF';
      if (raw === 'HALFDAY') return 'HALF_DAY';
      if (raw === 'LATE') return 'LATE_MARK';
      return allowed.has(raw) ? raw : null;
    }
    const actual: Record<string, string> = {
      FULLDAY: 'FULLDAY',
      PRESENT: 'FULLDAY',
      HALFDAY: 'HALFDAY',
      HALF_DAY: 'HALFDAY',
      ABSENT: 'ABSENT',
      LOP: 'LOP',
      LATE: 'LATE',
      LATE_MARK: 'LATE',
      WEEKOFF: 'WEEKOFF',
      WEEK_OFF: 'WEEKOFF',
      PUBLIC_HOLIDAY: 'WEEKOFF',
    };
    return actual[raw] ?? null;
  }

  private normalizeAttendanceDay(
    dateInput:
      string | Date,
  ): Date {
    const raw =
      typeof dateInput ===
      'string'
        ? dateInput
            .trim()
            .slice(
              0,
              10,
            )
        : dateInput
            .toISOString()
            .slice(
              0,
              10,
            );

    return new Date(
      `${raw}T12:00:00.000Z`,
    );
  }

  async fetchAttendanceStatus(
    employeeId:
      number,
    date:
      string,
  ) {
    const targetDate =
      this.normalizeAttendanceDay(
        date,
      );

    const nextDay =
      new Date(
        targetDate,
      );

    nextDay.setUTCDate(
      nextDay.getUTCDate() +
        1,
    );

    const existingRegularization =
      await this.prisma
        .empAttendanceRegularise
        .findFirst({
          where: {
            manageEmployeeID:
              employeeId,

            attendanceDate:
              targetDate,

            status:
              'Approved',
          },
        });

    if (
      existingRegularization
    ) {
      return {
        actualStatus:
          existingRegularization
            .requestedStatus ||
          existingRegularization
            .actualStatus ||
          'ABSENT',

        checkInTime:
          existingRegularization
            .checkInTime,

        checkOutTime:
          existingRegularization
            .checkOutTime,

        isRegularized:
          true,

        punchCount:
          0,
      };
    }

    const punches =
      await this.prisma
        .process_att_logs
        .findMany({
          where: {
            manage_employee_id:
              employeeId,

            punch_time: {
              gte:
                targetDate,

              lt:
                nextDay,
            },
          },

          orderBy: {
            punch_time:
              'asc',
          },
        });

    if (
      punches.length === 0
    ) {
      return {
        actualStatus:
          'ABSENT',

        checkInTime:
          null,

        checkOutTime:
          null,

        isRegularized:
          false,

        punchCount:
          0,
      };
    }

    const firstPunch =
      punches[0]
        .punch_time;

    const lastPunch =
      punches[
        punches.length -
        1
      ].punch_time;

    const employee =
      await this.prisma
        .manageEmployee
        .findUnique({
          where: {
            id:
              employeeId,
          },

          include: {
            workShift: {
              include: {
                workShiftDay:
                  true,
              },
            },

            attendancePolicy:
              true,
          },
        });

    const empWorkShift =
      await this.prisma
        .empWorkShift
        .findFirst({
          where: {
            manageEmployeeID:
              employeeId,
          },

          include: {
            workShift: {
              include: {
                workShiftDay:
                  true,
              },
            },
          },

          orderBy: {
            id:
              'desc',
          },
        });

    const workShift =
      empWorkShift
        ?.workShift ??
      (employee as any)
        ?.workShift ??
      null;

    const weekDayNames =
      [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ];

    const dayOfWeek =
      weekDayNames[
        targetDate.getDay()
      ];

    const shiftDay =
      workShift
        ?.workShiftDay
        ?.find(
          (day: any) =>
            day.weekDay ===
              dayOfWeek &&
            day.shiftType ===
              'WORK',
        ) ??
      null;

    let policy:
      any =
      (employee as any)
        ?.attendancePolicy ??
      null;

    if (!policy) {
      const empPolicy =
        await this.prisma
          .empAttendancePolicy
          .findFirst({
            where: {
              manageEmployeeID:
                employeeId,
            },

            include: {
              attendancePolicy:
                true,
            },

            orderBy: {
              id:
                'desc',
            },
          });

      policy =
        empPolicy
          ?.attendancePolicy ??
        null;
    }

    if (
      !policy &&
      employee?.companyID &&
      employee?.branchesID
    ) {
      policy =
        await this.prisma
          .attendancePolicy
          .findFirst({
            where: {
              companyID:
                employee.companyID,

              branchesID:
                employee.branchesID,
            },
          });
    }

    if (
      punches.length === 1
    ) {
      const singlePunchStatus =
        policy?.markAs ===
        'Absent'
          ? 'ABSENT'
          : 'HALFDAY';

      return {
        actualStatus:
          singlePunchStatus,

        checkInTime:
          firstPunch,

        checkOutTime:
          null,

        isRegularized:
          false,

        punchCount:
          1,
      };
    }

    const toMin = (
      value:
        | Date
        | string
        | null
        | undefined,
    ): number => {
      if (!value) {
        return 0;
      }

      if (
        value instanceof
        Date
      ) {
        return (
          value.getHours() *
            60 +
          value.getMinutes()
        );
      }

      const parts =
        String(
          value,
        ).split(
          ':',
        );

      return (
        (
          parseInt(
            parts[0],
            10,
          ) ||
          0
        ) *
          60 +
        (
          parseInt(
            parts[1],
            10,
          ) ||
          0
        )
      );
    };

    const firstPunchMin =
      toMin(
        firstPunch,
      );

    const lastPunchMin =
      toMin(
        lastPunch,
      );

    const isFlexible =
      workShift
        ?.isFlexible ||
      false;

    let startMin =
      firstPunchMin;

    let endMin =
      lastPunchMin;

    if (
      !isFlexible &&
      shiftDay &&
      policy
    ) {
      const shiftStartMin =
        toMin(
          shiftDay
            .startTime,
        );

      const shiftEndMin =
        toMin(
          shiftDay
            .endTime,
        );

      const earlyBuffer =
        policy
          .checkin_begin_before_min ||
        0;

      if (
        startMin <
        shiftStartMin -
          earlyBuffer
      ) {
        startMin =
          shiftStartMin;
      }

      if (
        !policy
          .overtimeApplicable
      ) {
        const checkoutBuffer =
          policy
            .checkout_end_after_min ||
          0;

        if (
          endMin >
          shiftEndMin +
            checkoutBuffer
        ) {
          endMin =
            shiftEndMin;
        }
      }
    }

    let workedMinutes =
      endMin -
      startMin;

    if (
      workedMinutes < 0
    ) {
      workedMinutes +=
        24 * 60;
    }

    if (
      shiftDay
        ?.breakStart &&
      shiftDay
        ?.breakEnd
    ) {
      const breakStartMin =
        toMin(
          shiftDay
            .breakStart,
        );

      const breakEndMin =
        toMin(
          shiftDay
            .breakEnd,
        );

      if (
        breakStartMin >
          0 &&
        breakEndMin >
          0 &&
        startMin <=
          breakStartMin &&
        endMin >=
          breakEndMin
      ) {
        workedMinutes -=
          breakEndMin -
          breakStartMin;
      }
    }

    if (
      !isFlexible &&
      policy
    ) {
      workedMinutes -=
        policy
          .trimPreshiftMin ||
        0;

      workedMinutes -=
        policy
          .trimPostshiftMin ||
        0;
    }

    workedMinutes =
      Math.max(
        0,
        workedMinutes,
      );

    const halfDayMin =
      policy
        ?.min_work_hours_half_day_min ||
      0;

    const actualStatus =
      halfDayMin > 0 &&
      workedMinutes <=
        halfDayMin
        ? 'HALFDAY'
        : 'FULLDAY';

    return {
      actualStatus,

      checkInTime:
        firstPunch,

      checkOutTime:
        lastPunch,

      isRegularized:
        false,

      punchCount:
        punches.length,
    };
  }

  async create(
    createEmpAttendanceRegulariseDto:
      CreateEmpAttendanceRegulariseDto,
  ) {
    const data =
      this.parsePayload(
        createEmpAttendanceRegulariseDto as Record<
          string,
          unknown
        >,
      ) as any;

    data.actualStatus = this.normalizeStoredStatus(data.actualStatus, 'actual');
    data.requestedStatus = this.normalizeStoredStatus(data.requestedStatus, 'requested');
    if (!data.requestedStatus) {
      throw new BadRequestException('Requested status is not valid');
    }

    if (
      data.attendanceDate
    ) {
      const reqDate =
        this.normalizeAttendanceDay(
          data.attendanceDate,
        );

      const today =
        this.normalizeAttendanceDay(
          new Date(),
        );

      if (
        reqDate >
        today
      ) {
        throw new BadRequestException(
          'Attendance regularisation is only allowed for past dates',
        );
      }

      data.attendanceDate =
        reqDate;
    }

    const manageEmployeeID =
      Number(
        data.manageEmployeeID,
      );

    if (
      !Number.isInteger(
        manageEmployeeID,
      ) ||
      manageEmployeeID <= 0
    ) {
      throw new BadRequestException(
        'A valid employee is required',
      );
    }

    const companyID =
      Number(
        data.companyID,
      );

    if (
      !Number.isInteger(
        companyID,
      ) ||
      companyID <= 0
    ) {
      throw new BadRequestException(
        'A valid company is required',
      );
    }

    const branchesID =
      data.branchesID ==
      null
        ? null
        : Number(
            data.branchesID,
          );

    if (
      branchesID != null &&
      (
        !Number.isInteger(
          branchesID,
        ) ||
        branchesID <= 0
      )
    ) {
      throw new BadRequestException(
        'Branch must be a valid positive integer',
      );
    }

    if (
      data.attendanceDate
    ) {
      const existing =
        await this.prisma
          .empAttendanceRegularise
          .findFirst({
            where: {
              manageEmployeeID,

              attendanceDate:
                data.attendanceDate,
            },
          });

      if (existing) {
        return this.saveOverExisting(
          existing,
          data,
        );
      }
    }

    return this.prisma.$transaction(
      async (tx) => {
        /*
         * Backend owns approval status.
         */
        delete data.status;

        const employee =
          await tx.manageEmployee
            .findUnique({
              where: {
                id:
                  manageEmployeeID,
              },

              select: {
                id: true,

                serviceProviderID:
                  true,

                companyID:
                  true,

                branchesID:
                  true,

                departmentNameID:
                  true,

                designationID:
                  true,
              },
            });

        if (!employee) {
          throw new BadRequestException(
            'Selected employee was not found',
          );
        }

        if (
          employee.companyID ==
          null
        ) {
          throw new BadRequestException(
            'Selected employee is not mapped to a company',
          );
        }

        /*
         * Force organisation context from employee to avoid
         * frontend spoofing/mismatch.
         */
        const resolvedCompanyID =
          employee.companyID;

        const resolvedBranchID =
          employee.branchesID;

        const regularisation =
          await tx
            .empAttendanceRegularise
            .create({
              data: {
                ...data,

                manageEmployeeID,

                companyID:
                  resolvedCompanyID,

                branchesID:
                  resolvedBranchID,

                /*
                 * Temporary state. Engine will decide whether
                 * request remains Pending or becomes Approved.
                 */
                status:
                  'Pending',
              },

              include: {

                company:
                  true,

                branches:
                  true,

                departments:
                  true,

                manageEmployee:
                  true,
              },
            });

        const approval =
          await this
            .approvalEngine
            .submitAttendanceRegularisation(
              tx,
              {
                id:
                  regularisation.id,

                serviceProviderID:
                  regularisation
                    .serviceProviderID ??
                  employee
                    .serviceProviderID,

                companyID:
                  resolvedCompanyID,

                branchesID:
                  resolvedBranchID,

                manageEmployeeID,

                departmentID:
                  employee
                    .departmentNameID,

                designationID:
                  employee
                    .designationID,

                requestedStatus:
                  regularisation
                    .requestedStatus !=
                  null
                    ? String(
                        regularisation
                          .requestedStatus,
                      )
                    : null,

                regularisationDays:
                  1,
              },
            );

        if (
          !approval
            .approvalRequired
        ) {
          await this.leaveBalance.assertRegularisationFits(
            manageEmployeeID,
            regularisation.requestedStatus != null
              ? String(regularisation.requestedStatus)
              : null,
            tx,
          );
          await tx
            .empAttendanceRegularise
            .update({
              where: {
                id:
                  regularisation.id,
              },

              data: {
                status:
                  'Approved',
              },
            });
          await this.leaveBalance.recompute(
            manageEmployeeID,
            tx,
          );
        }

        const finalRecord =
          await tx
            .empAttendanceRegularise
            .findUnique({
              where: {
                id:
                  regularisation.id,
              },

              include: {

                company:
                  true,

                branches:
                  true,

                departments:
                  true,

                manageEmployee:
                  true,
              },
            });

        return {
          ...finalRecord,

          approval: {
            required:
              approval
                .approvalRequired,

            requestID:
              approval
                .approvalRequestID,

            workflowID:
              approval
                .workflowID,

            workflowName:
              approval
                .workflowName,

            currentStepNo:
              approval
                .currentStepNo,

            status:
              approval.status,
          },
        };
      },
    );
  }

  private async saveOverExisting(
    existing: {
      id: number;
      status?: string | null;
      manageEmployeeID?: number | null;
    },
    data: Record<string, unknown>,
  ) {
    const statusUpper = String(existing.status ?? '')
      .trim()
      .toUpperCase();

    if (statusUpper === 'PENDING') {
      const started = await this.hasApprovalActionTaken(existing.id);
      if (started) {
        throw new ConflictException(
          'A pending regularisation request already exists for this employee on the selected date',
        );
      }

      const pendingUpdate = { ...data };
      delete pendingUpdate.status;
      delete pendingUpdate.manageEmployeeID;
      delete pendingUpdate.companyID;
      delete pendingUpdate.branchesID;
      delete pendingUpdate.serviceProviderID;

      const updated = await this.prisma.empAttendanceRegularise.update({
        where: { id: existing.id },
        data: pendingUpdate as any,
        include: {
          company: true,
          branches: true,
          departments: true,
          manageEmployee: true,
        },
      });

      return {
        ...updated,
        approvalActionTaken: false,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const employeeId = Number(existing.manageEmployeeID);
      const employee = await tx.manageEmployee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          serviceProviderID: true,
          companyID: true,
          branchesID: true,
          departmentNameID: true,
          designationID: true,
        },
      });

      if (!employee) {
        throw new BadRequestException('Selected employee was not found');
      }

      const requestedStatus =
        data.requestedStatus != null ? String(data.requestedStatus) : null;

      await tx.empAttendanceRegularise.update({
        where: { id: existing.id },
        data: {
          requestedStatus: requestedStatus as any,
          reason: data.reason != null ? String(data.reason) : undefined,
          remarks: data.remarks != null ? String(data.remarks) : undefined,
          day: data.day != null ? String(data.day) : undefined,
          checkInTime: (data.checkInTime as Date | null | undefined) ?? undefined,
          checkOutTime: (data.checkOutTime as Date | null | undefined) ?? undefined,
          actualStatus: (data.actualStatus as any) ?? undefined,
          status: 'Pending',
        },
      });

      const approval = await this.approvalEngine.submitAttendanceRegularisation(
        tx,
        {
          id: existing.id,
          serviceProviderID: employee.serviceProviderID,
          companyID: employee.companyID,
          branchesID: employee.branchesID,
          manageEmployeeID: employeeId,
          departmentID: employee.departmentNameID,
          designationID: employee.designationID,
          requestedStatus,
          regularisationDays: 1,
        },
      );

      if (!approval.approvalRequired) {
        await this.leaveBalance.assertRegularisationFits(
          employeeId,
          requestedStatus,
          tx,
          existing.id,
        );
        await tx.empAttendanceRegularise.update({
          where: { id: existing.id },
          data: { status: 'Approved' },
        });
      }

      await this.leaveBalance.recompute(employeeId, tx);

      const finalRecord = await tx.empAttendanceRegularise.findUnique({
        where: { id: existing.id },
        include: {
          company: true,
          branches: true,
          departments: true,
          manageEmployee: true,
        },
      });

      return {
        ...finalRecord,
        approval: {
          required: approval.approvalRequired,
          requestID: approval.approvalRequestID,
          workflowID: approval.workflowID,
          workflowName: approval.workflowName,
          currentStepNo: approval.currentStepNo,
          status: approval.status,
        },
      };
    });
  }

  private async hasApprovalActionTaken(
  regularisationID: number,
): Promise<boolean> {
  const approvalRequest =
    await this.prisma.approvalRequest.findFirst({
      where: {
        subjectID:
          regularisationID,

        subjectType: {
          in: [
            'ATTENDANCE_REGULARISATION',
            'ATTENDANCE_REGULARIZATION',
            'ATTENDANCE_REGULARISE',
          ],
        },
      },

      select: {
        id: true,

        approvers: {
          where: {
            status: {
              in: [
                'APPROVED',
                'REJECTED',
                'SENT_BACK',
              ],
            },
          },

          select: {
            id: true,
          },

          take: 1,
        },
      },

      orderBy: {
        id: 'desc',
      },
    });

  return (
    approvalRequest?.approvers
      ?.length ?? 0
  ) > 0;
}

async findAll() {
  const rows =
    await this.prisma
      .empAttendanceRegularise
      .findMany({
        include: {

          company:
            true,

          branches:
            true,

          departments:
            true,

          manageEmployee:
            true,
        },

        orderBy: {
          id:
            'desc',
        },
      });

  if (
    rows.length === 0
  ) {
    return [];
  }

  const rowIDs =
    rows.map(
      (row) =>
        row.id,
    );

  /*
   * Load approval requests for these
   * attendance regularisations in one query.
   */
  const approvalRequests =
    await this.prisma.approvalRequest.findMany({
      where: {
        subjectID: {
          in:
            rowIDs,
        },

        subjectType: {
          in: [
            'ATTENDANCE_REGULARISATION',
            'ATTENDANCE_REGULARIZATION',
            'ATTENDANCE_REGULARISE',
          ],
        },
      },

      select: {
        id: true,
        subjectID: true,
        status: true,
        currentStepNo: true,

        approvers: {
          where: {
            status: {
              in: [
                'APPROVED',
                'REJECTED',
                'SENT_BACK',
              ],
            },
          },

          select: {
            id: true,
            status: true,
            actedAt: true,
          },

          take: 1,
        },
      },

      orderBy: {
        id:
          'desc',
      },
    });

  /*
   * One regularisation should normally have
   * one ApprovalRequest.
   *
   * Map latest request by subjectID defensively.
   */
  const approvalByRegularisationID =
    new Map<
      number,
      (typeof approvalRequests)[number]
    >();

  for (
    const request
    of approvalRequests
  ) {
    if (
      !approvalByRegularisationID.has(
        request.subjectID,
      )
    ) {
      approvalByRegularisationID.set(
        request.subjectID,
        request,
      );
    }
  }

  return rows.map(
    (row) => {
      const approvalRequest =
        approvalByRegularisationID.get(
          row.id,
        );

      return {
        ...row,

        /*
         * FALSE:
         * request is still untouched and can
         * be edited/deleted.
         *
         * TRUE:
         * somebody already approved/rejected/
         * sent it back.
         */
        approvalActionTaken:
          (
            approvalRequest
              ?.approvers
              ?.length ??
            0
          ) > 0,

        approvalRequestStatus:
          approvalRequest
            ?.status ??
          null,

        approvalCurrentStepNo:
          approvalRequest
            ?.currentStepNo ??
          null,
      };
    },
  );
}

async findOne(
  id: number,
) {
  const row =
    await this.prisma
      .empAttendanceRegularise
      .findUnique({
        where: {
          id,
        },

        include: {

          company:
            true,

          branches:
            true,

          departments:
            true,

          manageEmployee:
            true,
        },
      });

  if (!row) {
    return null;
  }

  const approvalActionTaken =
    await this.hasApprovalActionTaken(
      id,
    );

  return {
    ...row,
    approvalActionTaken,
  };
}

async update(
  id: number,

  updateEmpAttendanceRegulariseDto:
    UpdateEmpAttendanceRegulariseDto,
) {
  const existing =
    await this.prisma
      .empAttendanceRegularise
      .findUnique({
        where: {
          id,
        },
      });

  if (!existing) {
    throw new BadRequestException(
      'Attendance regularisation request was not found',
    );
  }

  const data =
    this.parsePayload(
      updateEmpAttendanceRegulariseDto as Record<
        string,
        unknown
      >,
    ) as any;

  /*
   * Frontend must never change approval status.
   */
  delete data.status;

  /*
   * Prevent reassignment of request after creation.
   *
   * If you want employee/branch switching during
   * edit later, that requires rebuilding the
   * ApprovalRequest and approver snapshots.
   */
  delete data.manageEmployeeID;
  delete data.companyID;
  delete data.branchesID;
  delete data.serviceProviderID;

  if ('actualStatus' in data) {
    data.actualStatus = this.normalizeStoredStatus(data.actualStatus, 'actual');
  }
  if ('requestedStatus' in data) {
    data.requestedStatus = this.normalizeStoredStatus(data.requestedStatus, 'requested');
    if (!data.requestedStatus) {
      throw new BadRequestException('Requested status is not valid');
    }
  }

  if (
    data.attendanceDate
  ) {
    const reqDate =
      this.normalizeAttendanceDay(
        data.attendanceDate,
      );

    const today =
      this.normalizeAttendanceDay(
        new Date(),
      );

    if (
      reqDate >
      today
    ) {
      throw new BadRequestException(
        'Attendance regularisation is only allowed for past dates',
      );
    }

    data.attendanceDate =
      reqDate;
  }

  return this.saveOverExisting(
    existing,
    data,
  );
}

  async remove(
  id: number,
) {
  const existing =
    await this.prisma
      .empAttendanceRegularise
      .findUnique({
        where: {
          id,
        },
      });

  if (!existing) {
    throw new BadRequestException(
      'Attendance regularisation request was not found',
    );
  }

  if (
    String(
      existing.status ??
      '',
    )
      .trim()
      .toUpperCase() !==
    'PENDING'
  ) {
    throw new ConflictException(
      'Only pending attendance regularisation requests can be deleted',
    );
  }

  const approvalActionTaken =
    await this.hasApprovalActionTaken(
      id,
    );

  if (
    approvalActionTaken
  ) {
    throw new ConflictException(
      'This attendance regularisation can no longer be deleted because approval has already started',
    );
  }

  /*
   * Delete ApprovalRequest first because
   * ApprovalRequest.subjectID is not a DB FK
   * to EmpAttendanceRegularise.
   *
   * Child request steps/approvers/actions
   * should cascade through your existing
   * ApprovalRequest relations.
   */
  return this.prisma.$transaction(
    async (tx) => {
      const approvalRequests =
        await tx.approvalRequest.findMany({
          where: {
            subjectID:
              id,

            subjectType: {
              in: [
                'ATTENDANCE_REGULARISATION',
                'ATTENDANCE_REGULARIZATION',
                'ATTENDANCE_REGULARISE',
              ],
            },
          },

          select: {
            id: true,
          },
        });

      if (
        approvalRequests.length >
        0
      ) {
        await tx.approvalRequest.deleteMany({
          where: {
            id: {
              in:
                approvalRequests.map(
                  (request) =>
                    request.id,
                ),
            },
          },
        });
      }

      const deleted =
        await tx.empAttendanceRegularise.delete({
          where: {
            id,
          },
        });

      return {
        message:
          'Attendance regularisation deleted successfully',

        data:
          deleted,
      };
    },
  );
}
}