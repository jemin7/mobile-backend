import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getTeamReimbursements } from "../api/reimbursement";
import {
  getManagerTeamLateArrivals,
  getManagerTeamLeaveApplications,
  getManagerTeamMembers,
  type TeamLeaveApplication,
} from "../api/team";
import { useAuth } from "../auth/AuthProvider";

function getTodayDateKey() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getApprovedLeaveTypeToday(
  application: TeamLeaveApplication,
  today: string,
): string | null {
  const status = application.status.trim().toLowerCase();

  if (!["approved", "accepted", "partially approved"].includes(status)) {
    return null;
  }

  let dayStatuses: unknown = application.dayStatuses;

  if (typeof dayStatuses === "string") {
    try {
      dayStatuses = JSON.parse(dayStatuses);
    } catch {
      dayStatuses = null;
    }
  }

  if (Array.isArray(dayStatuses) && dayStatuses.length > 0) {
    const todayEntry = dayStatuses.find((day) => {
      if (!day || typeof day !== "object") return false;

      const record = day as {
        date?: unknown;
        status?: unknown;
      };

      return (
        typeof record.date === "string" && record.date.slice(0, 10) === today
      );
    }) as { status?: unknown } | undefined;

    const approvedDayStatus =
      typeof todayEntry?.status === "string" ? todayEntry.status.trim() : "";

    return approvedDayStatus || null;
  }

  const fromDate = application.fromDate?.slice(0, 10);
  const toDate = application.toDate?.slice(0, 10);

  if (fromDate && toDate && fromDate <= today && today <= toDate) {
    return application.appliedLeaveType?.trim() || "Leave";
  }

  return null;
}

export function useManagerTeamMembers() {
  const { user, accessToken } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const teamQuery = useQuery({
    queryKey: ["manager-team-members", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerTeamMembers(accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });

  const leaveQuery = useQuery({
    queryKey: ["manager-team-leave-applications", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerTeamLeaveApplications(Number(employeeId), accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });

  const lateQuery = useQuery({
    queryKey: ["manager-team-late-arrivals", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerTeamLateArrivals(accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });

  const reimbursementsQuery = useQuery({
    queryKey: ["manager-team-reimbursements", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getTeamReimbursements(Number(employeeId), accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,
    retry: 1,
  });

  const today = getTodayDateKey();

  const lateEmployeeIds = new Set(lateQuery.data ?? []);
  const members = useMemo(() => {
    const leaveByEmployee = new Map<number, string>();

    for (const application of leaveQuery.data ?? []) {
      const leaveType = getApprovedLeaveTypeToday(application, today);

      if (leaveType && !leaveByEmployee.has(application.manageEmployeeID)) {
        leaveByEmployee.set(application.manageEmployeeID, leaveType);
      }
    }

    return (teamQuery.data ?? []).map((member) => {
      const leaveType = leaveByEmployee.get(member.id) ?? null;

      return {
        ...member,
        isOnLeaveToday: Boolean(leaveType),
        leaveType,
        isLateArrival: lateEmployeeIds.has(member.id),
      };
    });
  }, [teamQuery.data, leaveQuery.data, lateQuery.data, today]);

  const pendingLeaveApprovals = (leaveQuery.data ?? []).filter(
    (application) => application.status.trim().toLowerCase() === "pending",
  ).length;

  const pendingReimbursementApprovals = (reimbursementsQuery.data ?? []).filter(
    (reimbursement) => reimbursement.status === "Pending",
  ).length;

  const pendingApprovals =
    pendingLeaveApprovals + pendingReimbursementApprovals;

  const refetch = () =>
    Promise.all([
      teamQuery.refetch(),
      leaveQuery.refetch(),
      lateQuery.refetch(),
      reimbursementsQuery.refetch(),
    ]);

  return {
    totalEmployees: members.length,
    onLeaveToday: members.filter((member) => member.isOnLeaveToday === true)
      .length,
    attendanceAlerts: members.filter((member) => member.isLateArrival === true)
      .length,
    pendingApprovals,
    members,

    presentToday: members.filter(
      (member) =>
        member.statusLabel === "Checked in" ||
        member.statusLabel === "Checked out",
    ).length,

    absentToday: members.filter((member) => member.isAbsentToday === true)
      .length,

    isLoading:
      teamQuery.isLoading ||
      leaveQuery.isLoading ||
      lateQuery.isLoading ||
      reimbursementsQuery.isLoading,

    isError:
      teamQuery.isError ||
      leaveQuery.isError ||
      lateQuery.isError ||
      reimbursementsQuery.isError,

    error:
      teamQuery.error ??
      leaveQuery.error ??
      lateQuery.error ??
      reimbursementsQuery.error,

    isRefetching:
      teamQuery.isRefetching ||
      leaveQuery.isRefetching ||
      lateQuery.isRefetching ||
      reimbursementsQuery.isRefetching,
    refetch,
  };
}
