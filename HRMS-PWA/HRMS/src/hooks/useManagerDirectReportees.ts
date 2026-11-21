import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getManagerDirectReportees,
  getManagerTeamLateArrivals,
  getManagerTeamLeaveApplications,
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

export function useManagerDirectReportees() {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const reporteesQuery = useQuery({
    queryKey: ["manager-direct-reportees", employeeId],
    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerDirectReportees(accessToken);
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

    return (reporteesQuery.data ?? []).map((member) => {
      const leaveType = leaveByEmployee.get(member.id) ?? null;

      return {
        ...member,
        isOnLeaveToday: Boolean(leaveType),
        leaveType,
        isLateArrival: lateEmployeeIds.has(member.id),
      };
    });
  }, [reporteesQuery.data, leaveQuery.data, lateQuery.data, today]);

  const refetch = () =>
    Promise.all([
      reporteesQuery.refetch(),
      leaveQuery.refetch(),
      lateQuery.refetch(),
    ]);

  return {
    members,
    isLoading:
      reporteesQuery.isLoading || leaveQuery.isLoading || lateQuery.isLoading,
    isError: reporteesQuery.isError || leaveQuery.isError || lateQuery.isError,
    error: reporteesQuery.error ?? leaveQuery.error ?? lateQuery.error,
    isRefetching:
      reporteesQuery.isRefetching ||
      leaveQuery.isRefetching ||
      lateQuery.isRefetching,
    refetch,
  };
}
