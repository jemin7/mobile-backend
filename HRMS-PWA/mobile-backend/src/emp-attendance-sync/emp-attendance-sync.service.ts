// src/emp-attendance-sync/emp-attendance-sync.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { devicePunchToStorageDate } from '../common/device-punch-time';
import { DeviceStatus, Prisma } from '@prisma/client';

@Injectable()
export class EmpAttendanceSyncService {
  constructor(private readonly prisma: PrismaService) {}

 
  async sync(input: { take: number; dryRun: boolean }) {
    const { take, dryRun } = input;

    // Run everything atomically
    return await this.prisma.$transaction(async (tx) => {
      // 1) Fetch up to `take` unprocessed logs (across all devices)
      const logs = await tx.attendanceLogs.findMany({
        where: { processed: '0' },  // <- only not-processed
        orderBy: { id: 'asc' },
        take,
        include: {
          device: {
            select: {
              id: true,
              status: true,
              serviceProviderID: true,
              companyID: true,
              branchesID: true,
              deviceSN: true,
              deviceType: true,
              authTypes: true,
              deviceName: true,
            },
          },
        },
      });

      if (!logs.length) {
        return {
          picked: 0,
          preMarkedProcessed: 0,
          inserted: 0,
          skippedNoDevice: 0,
          skippedInactiveDevice: 0,
          skippedNoMapping: 0,
          details: [] as any[],
        };
      }

      const pickedIds = logs.map((l) => l.id);

      // 2) Pre-mark fetched logs to '1' so they won't be re-fetched next run
      //    (Skip this in dryRun)
    // inside transaction
const successIds: number[] = [];
const insertRows: Prisma.EmpAttendanceLogsCreateManyInput[] = [];
const processAttRows: Prisma.process_att_logsCreateManyInput[] = [];
let skippedNoDevice = 0;
let skippedInactiveDevice = 0;
let skippedNoMapping = 0;
const details: any[] = [];

for (const log of logs) {
  const dev = log.device;

  if (!dev) {
    skippedNoDevice++;
    details.push({ logId: log.id, reason: 'device_not_found' });
    continue;
  }

  if (dev.status !== DeviceStatus.Active) {
    skippedInactiveDevice++;
    details.push({ logId: log.id, reason: 'device_inactive', deviceId: dev.id });
    continue;
  }

  const deviceType = dev.deviceType || 'AT';
  const authType = log.authType || null;

  const mapping = await tx.empDeviceMapping.findFirst({
    where: { deviceID: dev.id, deviceEmpCode: log.userId },
    select: { manageEmployeeID: true },
  });

  if (!mapping) {
    skippedNoMapping++;
    details.push({
      logId: log.id,
      reason: 'emp_mapping_not_found',
      deviceId: dev.id,
      deviceSN: dev.deviceSN,
      userId: log.userId,
    });
    continue;
  }

  // Fetch employee details for process_att_logs
  const emp = await tx.manageEmployee.findUnique({
    where: { id: mapping.manageEmployeeID! },
    select: {
      employeeFirstName: true,
      employeeLastName: true,
      branchesID: true,
      mobileAttendanceEnabled: true,
      company: { select: { companyName: true } },
      branches: { select: { branchName: true } },
      departments: { select: { departmentName: true } },
    },
  });
  const username = `${emp?.employeeFirstName || ''} ${emp?.employeeLastName || ''}`.trim();

  // ✅ This log is valid → queue for EmpAttendanceLogs insertion (raw archive)
  insertRows.push({
    serviceProviderID: dev.serviceProviderID ?? 0,
    companyID:         dev.companyID ?? 0,
    branchesID:        emp?.branchesID ?? dev.branchesID ?? null,
    deviceID:          dev.id,
    employeeID:        mapping.manageEmployeeID,
    punchTimeStamp:    log.logTime,
    exported:          0,
    latitude:          null,
    longitude:         null,
    googleMapLink:     null,
    location:          null,
    mobileDeviceID:    null,
    mobileDeviceInfo:  null,
  });

  // ✅ Only mirror device punches into process_att_logs (the attendance source
  // of truth used by the dashboard, reports & salary) for employees who punch
  // via device. Mobile-attendance employees punch only through the PWA, so
  // their device punches are archived (above) but excluded from attendance.
  if (!emp?.mobileAttendanceEnabled) {
    processAttRows.push({
      device_sn:          dev.deviceSN,
      user_id:            log.userId,
      username,
      punch_time:         log.logTime ? devicePunchToStorageDate(log.logTime) : null,
      company_name:       emp?.company?.companyName ?? null,
      branch_name:        emp?.branches?.branchName ?? null,
      department_name:    emp?.departments?.departmentName ?? null,
      device_emp_code:    log.userId,
      manage_employee_id: mapping.manageEmployeeID,
      device_id:          dev.id,
      device_name:        dev.deviceName,
      device_type:        deviceType,
      auth_type:          authType,
      raw_body:           log.rawData,
      status:             '0',
    });
  }

  successIds.push(log.id);

  details.push({
    logId: log.id,
    queued: true,
    route: 'attendance',
    deviceId: dev.id,
    employeeId: mapping.manageEmployeeID,
    punchTimeStamp: log.logTime,
    authType,
    mobileOnly: !!emp?.mobileAttendanceEnabled,
  });
}

// ✅ Only mark *successful* logs as processed
let preMarkedProcessed = 0;
if (!dryRun && successIds.length) {
  const upd = await tx.attendanceLogs.updateMany({
    where: { id: { in: successIds } },
    data: { processed: '1' },
  });
  preMarkedProcessed = upd.count ?? successIds.length;
}

// Insert attendance rows (if not dryRun)
let inserted = 0;
let processAttInserted = 0;
if (!dryRun && insertRows.length) {
  const ins = await tx.empAttendanceLogs.createMany({
    data: insertRows,
  });
  inserted = ins.count ?? 0;
}

// Insert process_att_logs rows for dashboard, reports, and salary (if not dryRun)
if (!dryRun && processAttRows.length) {
  const pIns = await tx.process_att_logs.createMany({
    data: processAttRows,
  });
  processAttInserted = pIns.count ?? 0;
}

return {
  picked: logs.length,
  preMarkedProcessed,
  inserted,
  processAttInserted,
  skippedNoDevice,
  skippedInactiveDevice,
  skippedNoMapping,
  details,
};

    });
  }
}
