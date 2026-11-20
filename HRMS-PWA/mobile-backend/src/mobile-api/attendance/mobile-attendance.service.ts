import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { parseCoord, parseRadiusMeters } from '../../common/geo-distance';
import {
  composeAddressQuery,
  forwardGeocode,
} from '../../common/reverse-geocode';
import {
  MobileFencePoint,
  mobileFenceRadius,
  mobileWallDateKey,
} from './mobile-attendance-geofence.util';
import { PrismaService } from '../../prisma/prisma.service';
import {
  devicePunchToStorageDate,
  wallClockInZoneToStorageDate,
} from '../../common/device-punch-time';
import { MobileAttendancePunchDto } from './dto/mobile-attendance-punch.dto';
import { assertMobileWithinFence } from './mobile-attendance-geofence.util';


import { JwtService } from '@nestjs/jwt';

@Injectable()
export class MobileAttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

    private isClosedTaskStatus(status?: string | null): boolean {
    const key = String(status || '')
      .trim()
      .replace(/[\s_-]+/g, '')
      .toLowerCase();

    return ['completed', 'closed', 'cancelled', 'canceled', 'cancel'].includes(key);
  }

  private isTaskActiveToday(task: {
    scheduleDateTime: Date | null;
    dueDateTime: Date | null;
    assignments: { assignedAt: Date }[];
    engineerAssignments: {
      assignedDate: Date | null;
      createdAt: Date;
    }[];
  }, todayKey: string): boolean {
    const starts = [
      task.scheduleDateTime,
      ...task.assignments.map((a) => a.assignedAt),
      ...task.engineerAssignments.map((a) => a.assignedDate ?? a.createdAt),
    ].filter((date): date is Date => date instanceof Date);

    const startKey = starts.length
      ? mobileWallDateKey(
          starts.reduce((a, b) => a.getTime() < b.getTime() ? a : b),
        )
      : null;

    const endKey = task.dueDateTime
      ? mobileWallDateKey(task.dueDateTime)
      : null;

    if (!startKey && !endKey) return true;
    if (startKey && endKey) return todayKey >= startKey && todayKey <= endKey;
    if (startKey) return todayKey >= startKey;

    return todayKey <= (endKey as string);
  }

   private async resolveEmployeeFence(
  employeeId: number,
  accuracy?: number,
  punchDate?: Date,
) {
  const branchSelect = {
  id: true,
  branchName: true,
      latitude: true,
      longitude: true,
      geofenchradius: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      country: true,
    } as const;

    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
  isDeleted: true,
  mobileAttendanceEnabled: true,
  enableAttBranchOnly: true,
serviceProviderID: true,
companyID: true,
branchesID: true,
        wfhAllowed: true,
        wfhHomeAddress: true,
        wfhHomeLatitude: true,
        wfhHomeLongitude: true,
        branches: { select: branchSelect },
        empBranch: {
          orderBy: { id: 'desc' },
          take: 1,
          select: { branch: { select: branchSelect } },
        },
        employeeID: true,
employeeFirstName: true,
employeeLastName: true,
company: {
  select: { companyName: true },
},
departments: {
  select: { departmentName: true },
},
      },
    });

    if (!employee || employee.isDeleted) {
      throw new ForbiddenException('Employee account is unavailable.');
    }

    const branches = [
      employee.branches,
      employee.empBranch[0]?.branch,
    ].filter((branch) => branch != null);

    const baseRadius = branches
      .map((branch) => parseRadiusMeters(branch.geofenchradius))
      .find((radius) => radius !== null);

    
    
    const radiusMeters = employee.enableAttBranchOnly
  ? mobileFenceRadius(baseRadius, accuracy)
  : null;

    const points: MobileFencePoint[] = [];

    const resolveCoordinates = async (
      latitude: unknown,
      longitude: unknown,
      address: string,
    ) => {
      const lat = parseCoord(latitude);
      const lng = parseCoord(longitude);

      if (lat !== null && lng !== null && !(lat === 0 && lng === 0)) {
        return { latitude: lat, longitude: lng };
      }

      const geocoded = await forwardGeocode(address);

      return geocoded
        ? {
            latitude: geocoded.lat,
            longitude: geocoded.lng,
          }
        : null;
    };

    const uniqueBranches = new Map(
      branches.map((branch) => [branch.id, branch]),
    );

    for (const branch of uniqueBranches.values()) {
      const coordinates = await resolveCoordinates(
        branch.latitude,
        branch.longitude,
        composeAddressQuery(
          branch.address,
          branch.city,
          branch.state,
          branch.pincode,
          branch.country,
        ),
      );

      if (coordinates) {
        points.push({ ...coordinates, type: 'OFFICE' });
      }
    }

    if (!employee.enableAttBranchOnly && employee.wfhAllowed) {
      const home = await resolveCoordinates(
        employee.wfhHomeLatitude,
        employee.wfhHomeLongitude,
        employee.wfhHomeAddress || '',
      );

      if (home) {
        points.push({ ...home, type: 'HOME' });
      }
    }

        const todayKey = mobileWallDateKey(
  punchDate ?? wallClockInZoneToStorageDate(),
);

    const tasks = await this.prisma.taskProject.findMany({
      where: {
        isDeleted: false,
        OR: [
          { assignments: { some: { manageEmployeeID: employeeId } } },
          { engineerAssignments: { some: { manageEmployeeID: employeeId } } },
        ],
      },
      select: {
        status: true,
        scheduleDateTime: true,
        dueDateTime: true,
        site: {
          select: {
            id: true,
            isDeleted: true,
            latitude: true,
            longitude: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            country: true,
          },
        },
        assignments: {
          where: { manageEmployeeID: employeeId },
          select: { assignedAt: true },
        },
        engineerAssignments: {
          where: { manageEmployeeID: employeeId },
          select: { assignedDate: true, createdAt: true },
        },
      },
    });

    const processedSites = new Set<number>();

    for (const task of employee.enableAttBranchOnly ? [] : tasks) {
      if (
        this.isClosedTaskStatus(task.status) ||
        !this.isTaskActiveToday(task, todayKey)
      ) {
        continue;
      }

      const site = task.site;

      if (!site || site.isDeleted || processedSites.has(site.id)) {
        continue;
      }

      const coordinates = await resolveCoordinates(
        site.latitude,
        site.longitude,
        composeAddressQuery(
          site.address,
          site.city,
          site.state,
          site.pincode,
          site.country,
        ),
      );

      if (coordinates) {
        processedSites.add(site.id);
        points.push({
          ...coordinates,
          type: 'SITE',
          siteId: site.id,
        });
      }
    }

    return { employee, radiusMeters, points };
  }


  
async recordPunch(
  employeeId: number,
  dto: MobileAttendancePunchDto,
) {
  const clientEventId = dto.clientEventId?.trim() || null;
  const referenceEventId = dto.referenceEventId?.trim() || null;

  if (dto.clientEventId !== undefined && !clientEventId) {
    throw new BadRequestException('Invalid attendance event ID.');
  }

  if (!!clientEventId !== !!dto.punchTime) {
    throw new BadRequestException(
      'Event ID and original punch time must be supplied together.',
    );
  }

    if (clientEventId && !dto.timeProof?.trim()) {
    throw new BadRequestException(
      'A signed server time proof is required for queued attendance.',
    );
  }

  if (dto.timeProof && !clientEventId) {
    throw new BadRequestException(
      'Time proof is only accepted with a queued attendance event.',
    );
  }

  if (
    dto.checkType === 'CHECK_OUT' &&
    clientEventId &&
    !referenceEventId
  ) {
    throw new BadRequestException(
      'Checkout must reference its original check-in event.',
    );
  }

  const punchTime = dto.punchTime
    ? devicePunchToStorageDate(dto.punchTime)
    : wallClockInZoneToStorageDate();

  if (!punchTime) {
    throw new BadRequestException('Invalid attendance punch time.');
  }

     let proof: {
    purpose?: string;
    employeeId?: number;
    serverUtcMs?: number;
    exp?: number;
  } | null = null;

  if (clientEventId) {
    try {
      proof = await this.jwt.verifyAsync(dto.timeProof as string, {
        ignoreExpiration: true,
      });
    } catch {
      throw new BadRequestException('Attendance time proof is invalid.');
    }

    if (
      !proof ||
      proof.purpose !== 'mobile-attendance-time' ||
      proof.employeeId !== employeeId ||
      typeof proof.serverUtcMs !== 'number' ||
      !Number.isFinite(proof.serverUtcMs) ||
      proof.serverUtcMs <= 0 ||
      typeof proof.exp !== 'number' ||
      !Number.isFinite(proof.exp) ||
      proof.exp <= 0
    ) {
      throw new BadRequestException(
        'Attendance time proof does not match this employee.',
      );
    }
  }

  const pad = (value: number) => String(value).padStart(2, '0');
  const formattedPunchTime =
    `${punchTime.getUTCFullYear()}-${pad(punchTime.getUTCMonth() + 1)}-${pad(punchTime.getUTCDate())} ` +
    `${pad(punchTime.getUTCHours())}:${pad(punchTime.getUTCMinutes())}:${pad(punchTime.getUTCSeconds())}`;

  if (dto.punchTime && formattedPunchTime !== dto.punchTime) {
    throw new BadRequestException('Invalid attendance punch date or time.');
  }

  const now = wallClockInZoneToStorageDate();

  if (punchTime.getTime() > now.getTime() + 5 * 60 * 1000) {
    throw new BadRequestException('Attendance punch time cannot be in the future.');
  }

 
    const verifyReplay = (existing: {
    checkType: string;
    referenceEventId: string | null;
    checkinTime: Date;
    latitude: number;
    longitude: number;
    accuracy: number | null;
    address: string | null;
  }) => {
    if (
      existing.checkType !== dto.checkType ||
      existing.referenceEventId !== referenceEventId ||
      existing.checkinTime.getTime() !== punchTime.getTime() ||
      existing.latitude !== dto.latitude ||
      existing.longitude !== dto.longitude ||
      (existing.accuracy ?? null) !== (dto.accuracy ?? null) ||
      (existing.address ?? null) !== (dto.address ?? null)
    ) {
      throw new ConflictException(
        'This attendance event ID has already been used.',
      );
    }
  };


   if (clientEventId) {
    const existing = await this.prisma.attendanceLocation.findFirst({
      where: { employeeId, clientEventId },
    });

    if (existing) {
      verifyReplay(existing);
      return existing;
    }

    if (!proof || proof.exp! <= Math.floor(Date.now() / 1000)) {
      throw new BadRequestException(
        'Attendance time proof is invalid or expired.',
      );
    }

    const anchorTime = wallClockInZoneToStorageDate(
      new Date(proof.serverUtcMs!),
    );

    if (punchTime.getTime() < anchorTime.getTime() - 2 * 60 * 1000) {
      throw new BadRequestException(
        'Attendance punch time predates its signed server time anchor.',
      );
    }
  }



  const { employee, radiusMeters, points } =
    await this.resolveEmployeeFence(employeeId, dto.accuracy, punchTime);

  if (employee.mobileAttendanceEnabled !== true) {
    throw new ForbiddenException(
      'Mobile attendance is not enabled for your account.',
    );
  }

  const fence = employee.enableAttBranchOnly
  ? assertMobileWithinFence(
      dto.latitude,
      dto.longitude,
      points,
      radiusMeters as number,
    )
  : null;

  const { startOfDay, endOfDay } = this.dayWindow(punchTime);

  const created = await this.prisma.$transaction(async (tx) => {
    await tx.$queryRaw`
      SELECT id
      FROM "ManageEmployee"
      WHERE id = ${employeeId}
      FOR UPDATE
    `;

    if (clientEventId) {
      const existing = await tx.attendanceLocation.findFirst({
        where: { employeeId, clientEventId },
      });

      if (existing) {
        verifyReplay(existing);
        return existing;
      }
    }



    const records = await tx.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: [
        { checkinTime: 'asc' },
        { id: 'asc' },
      ],
    });

    const hadCheckInToday = records.some(
      (record) => record.checkType === 'CHECK_IN',
    );

    const previousPunch =
      records.length === 0 ||
      !records.some((record) => record.checkType === 'CHECK_IN')
        ? await tx.attendanceLocation.findFirst({
            where: {
              employeeId,
              checkinTime: { lt: startOfDay },
            },
            orderBy: [
              { checkinTime: 'desc' },
              { id: 'desc' },
            ],
          })
        : null;

    const lastPunch = records.at(-1) ?? previousPunch;
    const punchState = this.getPunchState(lastPunch?.checkType ?? null);

    if (dto.checkType === 'CHECK_IN') {
      if (punchState !== 'OUT') {
        throw new BadRequestException(
          'You already have an open attendance session.',
        );
      }

      const absentDeclaration =
        await tx.empAbsentDeclaration.findUnique({
          where: {
            employeeId_absentDate: {
              employeeId,
              absentDate: startOfDay,
            },
          },
        });

      if (absentDeclaration) {
        throw new BadRequestException(
          'You have already been marked absent for this date.',
        );
      }
    }

    if (dto.checkType === 'CHECK_OUT') {
      if (punchState !== 'IN') {
        throw new BadRequestException(
          'There is no open attendance session to check out.',
        );
      }

      const openCheckIn =
        [...records]
          .reverse()
          .find((record) => record.checkType === 'CHECK_IN') ??
        (records.length === 0 && previousPunch?.checkType === 'CHECK_IN'
          ? previousPunch
          : null);

      if (!openCheckIn) {
        throw new BadRequestException(
          'The original check-in record could not be found.',
        );
      }

      if (
        clientEventId &&
        openCheckIn.clientEventId !== referenceEventId
      ) {
        throw new BadRequestException(
          'Checkout does not reference the current open check-in.',
        );
      }

      if (punchTime.getTime() <= openCheckIn.checkinTime.getTime()) {
        throw new BadRequestException(
          'Checkout time must be after check-in time.',
        );
      }
    }


        const branchId =
      employee.branchesID ??
      employee.empBranch[0]?.branch.id ??
      null;

       const created = await tx.attendanceLocation.create({
      data: {
        employeeId,
        checkType: dto.checkType,
        checkinTime: punchTime,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        address: dto.address ?? null,
        deviceType: dto.deviceType ?? null,
        browser: dto.browser ?? null,
        operatingSystem: dto.operatingSystem ?? null,
        userAgent: dto.userAgent ?? null,
        photoUrl: dto.photoUrl ?? null,
        clientEventId,
        referenceEventId,
        fenceType: fence?.type ?? null,
fenceSiteId: fence?.siteId ?? null,
        serviceProviderID: employee.serviceProviderID,
        companyID: employee.companyID,
        branchesID: branchId,
      },
    });

    const shouldMirror =
      dto.checkType === 'CHECK_OUT' ||
      (dto.checkType === 'CHECK_IN' && !hadCheckInToday);

    if (shouldMirror) {
      const existingInMirror =
        dto.checkType === 'CHECK_IN'
          ? await tx.process_att_logs.count({
              where: {
                manage_employee_id: employeeId,
                device_sn: 'LOCATION_APP',
                punch_time: {
                  gte: startOfDay,
                  lte: endOfDay,
                },
              },
            })
          : 0;

      if (dto.checkType === 'CHECK_OUT' || existingInMirror === 0) {
        const employeeCode =
          employee.employeeID?.slice(0, 50) ?? String(employeeId);

        const fullName = [
          employee.employeeFirstName,
          employee.employeeLastName,
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 255) || employeeCode;

        await tx.process_att_logs.create({
          data: {
            device_sn: 'LOCATION_APP',
            user_id: employeeCode,
            username: fullName,
            punch_time: created.checkinTime,
            company_name: employee.company?.companyName ?? null,
            branch_name:
              employee.branches?.branchName ??
              employee.empBranch[0]?.branch.branchName ??
              null,
            department_name: employee.departments?.departmentName ?? null,
            device_emp_code: employee.employeeID?.slice(0, 50) ?? null,
            manage_employee_id: employeeId,
            device_id: null,
            raw_body: JSON.stringify({
              source: 'location_attendance',
              checkType: dto.checkType,
              latitude: dto.latitude,
              longitude: dto.longitude,
              accuracy: dto.accuracy ?? null,
              address: dto.address?.trim() || null,
             fenceType: fence?.type ?? null,
fenceSiteId: fence?.siteId ?? null,
            }),
            status: '0',
            device_name: 'Location Attendance App',
            device_type: (dto.deviceType ?? 'mobile').slice(0, 10),
            auth_type: 'GPS',
          },
        });
      }
    }

    return created;

  });



  return created;
}



  private dayWindow(date: Date) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    return {
      startOfDay: new Date(Date.UTC(y, m, d, 0, 0, 0, 0)),
      endOfDay: new Date(Date.UTC(y, m, d, 23, 59, 59, 999)),
    };
  }

  private getPunchState(lastType: string | null) {
    if (!lastType || lastType === 'CHECK_OUT') return 'OUT';
    if (lastType === 'CHECK_IN' || lastType === 'BREAK_OUT') return 'IN';
    if (lastType === 'BREAK_IN') return 'ON_BREAK';
    return 'OUT';
  }


  async getTodayStatus(employeeId: number) {
    const employee = await this.prisma.manageEmployee.findUnique({
      where: { id: employeeId },
      select: {
        mobileAttendanceEnabled: true,
        enableAttBranchOnly: true,
        photoPunchEnabled: true,
      },
    });

    const now = wallClockInZoneToStorageDate();
    const { startOfDay, endOfDay } = this.dayWindow(now);

    const records = await this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        checkinTime: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { checkinTime: 'asc' },
    });

        const previousPunch =
      !records.some((record) => record.checkType === 'CHECK_IN')
        ? await this.prisma.attendanceLocation.findFirst({
            where: {
              employeeId,
              checkinTime: { lt: startOfDay },
            },
            orderBy: [
              { checkinTime: 'desc' },
              { id: 'desc' },
            ],
          })
        : null;

    const checkIns = records.filter((r) => r.checkType === 'CHECK_IN');
const checkOuts = records.filter((r) => r.checkType === 'CHECK_OUT');
const lastPunch = records.at(-1) ?? previousPunch;



const punchState = this.getPunchState(lastPunch?.checkType ?? null);
    let workMs = 0;
    let breakMs = 0;
    let breakStart: Date | null = null;

    for (const record of records) {
      if (record.checkType === 'BREAK_IN') {
        breakStart = record.checkinTime;
      } else if (record.checkType === 'BREAK_OUT' && breakStart) {
        breakMs += Math.max(
          0,
          record.checkinTime.getTime() - breakStart.getTime(),
        );
        breakStart = null;
      }
    }

    if (breakStart) {
      breakMs += Math.max(0, now.getTime() - breakStart.getTime());
    }

    const firstCheckIn =
  checkIns[0] ??
  (checkIns.length === 0 && previousPunch?.checkType === 'CHECK_IN'
    ? previousPunch
    : null);
const lastCheckOut =
  lastPunch?.checkType === 'CHECK_OUT'
    ? checkOuts.at(-1) ?? null
    : null;
    if (firstCheckIn) {
      const endTime = lastCheckOut?.checkinTime ?? now;
      workMs = Math.max(
        0,
        endTime.getTime() -
          firstCheckIn.checkinTime.getTime() -
          breakMs,
      );
    }

    const todayDate = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
      ),
    );

    const absentDeclaration =
      await this.prisma.empAbsentDeclaration.findUnique({
        where: {
          employeeId_absentDate: {
            employeeId,
            absentDate: todayDate,
          },
        },
      });

    const isAbsentToday = !!absentDeclaration;
const hasPunches = records.length > 0;

    return {
      isCheckedIn: punchState === 'IN' || punchState === 'ON_BREAK',
      isCheckedOut: punchState === 'OUT' && !!lastCheckOut,
      isAbsentToday,
      absentDeclaration,
      punchState,
      canCheckIn:
        employee?.mobileAttendanceEnabled === true &&
        punchState === 'OUT' &&
        !isAbsentToday,
      canCheckOut:
        employee?.mobileAttendanceEnabled === true &&
        (punchState === 'IN' || punchState === 'ON_BREAK'),
      mobileAttendanceEnabled:
        employee?.mobileAttendanceEnabled === true,
      photoPunchEnabled: employee?.photoPunchEnabled === true,
      mobileBreakEnabled: false,
      canBreakIn: false,
      canBreakOut: false,
      canMarkAbsent: !hasPunches && !isAbsentToday && punchState === 'OUT',
      checkIn: firstCheckIn,
      checkOut: lastCheckOut,
      lastPunch,
      allToday: records,
      workMinutes: Math.floor(workMs / 60000),
      breakMinutes: Math.floor(breakMs / 60000),
      workSeconds: Math.floor(workMs / 1000),
      breakSeconds: Math.floor(breakMs / 1000),
      sessionCount: checkIns.length,
      deviceCheckedIn: false,
    };
  }

  async getMyRecords(
    employeeId: number,
    from?: string,
    to?: string,
  ) {
    const parseDay = (value: string | undefined, end: boolean) => {
      if (!value?.trim()) return undefined;

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new BadRequestException('Invalid attendance date filter.');
      }

      return new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          end ? 23 : 0,
          end ? 59 : 0,
          end ? 59 : 0,
          end ? 999 : 0,
        ),
      );
    };

    const fromDate = parseDay(from, false);
    const toDate = parseDay(to, true);

    if (fromDate && toDate && fromDate > toDate) {
      throw new BadRequestException('The from date cannot be after the to date.');
    }

    return this.prisma.attendanceLocation.findMany({
      where: {
        employeeId,
        ...(fromDate || toDate
          ? {
              checkinTime: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
      },
      orderBy: { checkinTime: 'desc' },
      take: 500,
    });
  }
}