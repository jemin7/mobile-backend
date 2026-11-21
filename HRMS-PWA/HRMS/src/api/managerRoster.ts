import { apiRequest } from "./client";

export type ManagerRosterDayType = "WORK" | "WEEKLY_OFF" | "LEAVE";

export type ManagerRosterLeaveType =
  | "CASUAL"
  | "SICK"
  | "PL"
  | "COMP_OFF"
  | "LOP";

export type ManagerRosterShift = {
  id: number;
  companyID: number | null;
  branchesID: number | null;
  workShiftName: string | null;
  isActive: string | null;
  isRotating: boolean | null;
  isFlexible: boolean | null;
  workShiftDay?: {
    id: number;
    weekDay: string | null;
    shiftType: string | null;
    startTime: string | null;
    endTime: string | null;
    weeklyOff: boolean | null;
    totalMinutes: number | null;
  }[];
};

export type ManagerRosterDay = {
  id: number;
  rosterEmployeeID: number;
  workDate: string;
  workShiftID: number | null;
  dayType: ManagerRosterDayType;
  leaveType: string | null;
  isLocked: boolean;
  workShift: ManagerRosterShift | null;
};

export type ManagerRosterEmployee = {
  id: number;
  employeeID: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  serviceProviderID: number | null;
  companyID: number | null;
  branchesID: number | null;
  departmentNameID: number | null;
  designationID: number | null;
  allowRotatingShift: boolean;
  departments: {
    departmentName: string | null;
  } | null;
  designations: {
    designation: string | null;
  } | null;
  rosterEmployeeID: number | null;
  days: ManagerRosterDay[];
};

export type ManagerRosterResponse = {
  fromDate: string;
  toDate: string;
  employees: ManagerRosterEmployee[];
  shifts: ManagerRosterShift[];
};

export type ManagerRosterAssignmentPayload = {
  employeeID: number;
  fromDate: string;
  toDate: string;
  dayType: ManagerRosterDayType;
  workShiftID?: number;
  leaveType?: ManagerRosterLeaveType;
};

export async function getManagerRoster(
  fromDate: string,
  toDate: string,
  token: string | null,
) {
  return apiRequest<ManagerRosterResponse>(
    `/manager-roster?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function assignManagerRoster(
  payload: ManagerRosterAssignmentPayload,
  token: string | null,
) {
  return apiRequest<{
    employeeID: number;
    assignedDays: number;
    dayType: ManagerRosterDayType;
  }>("/manager-roster/assignments", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export async function deleteManagerRosterAssignment(
  assignmentId: number,
  token: string | null,
) {
  return apiRequest<{
    success: boolean;
    message: string;
  }>(`/manager-roster/assignments/${assignmentId}`, {
    method: "DELETE",
    token,
  });
}
