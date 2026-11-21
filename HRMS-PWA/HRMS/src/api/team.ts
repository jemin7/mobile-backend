import { apiRequest } from "./client";

export type TeamMember = {
  id: number;
  employeeID?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
};

export type ManagerScopeResponse = {
  employeeId: number;
  reporteeIds: number[];
  directReporteeIds: number[];
  hasReportees: boolean;
  reportees: TeamMember[];
};

export type TeamAttendanceMember = {
  id: number;
  employeeID?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  employeePhotoUrl?: string | null;

  email?: string | null;
  departmentName?: string | null;
  designation?: string | null;
  joiningDate?: string | null;

  checkInTime?: string | null;
  checkOutTime?: string | null;

  isCheckedIn?: boolean;
  isAbsentToday?: boolean;

  statusLabel?: string | null;

  isOnLeaveToday?: boolean;
  isLateArrival?: boolean;
};

type DirectReporteesResponse = {
  reportees?: TeamAttendanceMember[];
};

type NestedTeamResponse = {
  members?: TeamAttendanceMember[];
};

export function getManagerScope(token: string | null) {
  return apiRequest<ManagerScopeResponse>("/emp-manager-scope/reportees", {
    method: "GET",
    token,
  });
}

/**
 * Loads all active employees reporting to the manager,
 * including direct and indirect reportees.
 */
export async function getManagerTeamMembers(
  token: string | null,
): Promise<TeamAttendanceMember[]> {
  const [directResponse, nestedResponse] = await Promise.all([
    apiRequest<DirectReporteesResponse>(
      "/emp-manager-scope/reportees-today-status",
      {
        method: "GET",
        token,
      },
    ),

    apiRequest<NestedTeamResponse>(
      "/emp-manager-scope/team-today-status?scope=team",
      {
        method: "GET",
        token,
      },
    ),
  ]);

  const membersById = new Map<number, TeamAttendanceMember>();

  const allMembers = [
    ...(directResponse.reportees ?? []),
    ...(nestedResponse.members ?? []),
  ];

  for (const member of allMembers) {
    if (!Number.isFinite(member.id) || member.id <= 0) {
      continue;
    }

    const existing = membersById.get(member.id);

    membersById.set(member.id, {
      ...existing,
      ...member,

      employeeID: member.employeeID ?? existing?.employeeID,
      employeeFirstName:
        member.employeeFirstName ?? existing?.employeeFirstName,
      employeeLastName: member.employeeLastName ?? existing?.employeeLastName,

      employeePhotoUrl: member.employeePhotoUrl ?? existing?.employeePhotoUrl,

      email: member.email ?? existing?.email,
      departmentName: member.departmentName ?? existing?.departmentName,
      designation: member.designation ?? existing?.designation,
      joiningDate: member.joiningDate ?? existing?.joiningDate,
      checkInTime: member.checkInTime ?? existing?.checkInTime,
      checkOutTime: member.checkOutTime ?? existing?.checkOutTime,

      statusLabel: member.statusLabel ?? existing?.statusLabel,
    });
  }

  return [...membersById.values()].sort((a, b) => {
    const departmentA = a.departmentName ?? "";
    const departmentB = b.departmentName ?? "";

    const departmentCompare = departmentA.localeCompare(departmentB);

    if (departmentCompare !== 0) {
      return departmentCompare;
    }

    const nameA =
      `${a.employeeFirstName ?? ""} ${a.employeeLastName ?? ""}`.trim();

    const nameB =
      `${b.employeeFirstName ?? ""} ${b.employeeLastName ?? ""}`.trim();

    return nameA.localeCompare(nameB);
  });
}

export async function getManagerDirectReportees(
  token: string | null,
): Promise<TeamAttendanceMember[]> {
  const response = await apiRequest<DirectReporteesResponse>(
    "/emp-manager-scope/reportees-today-status",
    {
      method: "GET",
      token,
    },
  );

  return response.reportees ?? [];
}

export type TeamLeaveApplication = {
  id: number;
  manageEmployeeID: number;
  appliedLeaveType?: string | null;
  fromDate: string;
  toDate: string;
  status: string;
  purpose?: string | null;
  dayStatuses?: unknown;
};

export async function getManagerTeamLeaveApplications(
  employeeId: number,
  token: string | null,
): Promise<TeamLeaveApplication[]> {
  return apiRequest<TeamLeaveApplication[]>(
    `/leave-application/employee/${employeeId}`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getManagerTeamLateArrivals(
  token: string | null,
): Promise<number[]> {
  const response = await apiRequest<{
    date: string;
    employeeIds: number[];
  }>("/dashboard-overview/manager-late-arrivals", {
    method: "GET",
    token,
  });

  return response.employeeIds ?? [];
}
