import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";

import {
  getAttendanceHistory,
  getAttendancePunches,
  getTodayAttendance,
  punchAttendance,
  type AttendancePunchRecord,
  type PunchAttendanceRequest,
} from "../api/attendance";

function formatDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayDate() {
  return formatDate(new Date());
}

function getDateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return formatDate(date);
}

/**
 * Today's attendance.
 */
export function useAttendanceToday() {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["attendance", "today", employeeId],
    queryFn: () => getTodayAttendance(accessToken!),
    enabled: Boolean(accessToken && employeeId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * Attendance history.
 *
 * Without selectedDate: returns the latest 5 days.
 * With selectedDate: returns attendance for that date.
 */
export function useAttendanceHistory(selectedDate?: string | null) {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const today = getTodayDate();
  const from = selectedDate ?? getDateDaysAgo(4);
  const to = selectedDate ?? today;

  return useQuery({
    queryKey: ["attendance", "history", from, to, employeeId],
    queryFn: () => getAttendanceHistory(from, to, accessToken!),
    enabled: Boolean(accessToken && employeeId),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * Attendance records for a calendar date range.
 */

export function useAttendanceMonth(from: string, to: string) {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["attendance", "history", from, to, employeeId],
    queryFn: () => getAttendanceHistory(from, to, accessToken!),
    enabled: Boolean(accessToken && employeeId && from && to),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * Attendance punch records for a selected calendar date.
 */
export function useAttendancePunches(date: string, enabled = true) {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;
  return useQuery<AttendancePunchRecord[]>({
    queryKey: ["attendance", "punches", date, employeeId],
    queryFn: () => getAttendancePunches(date, accessToken!),
    enabled: Boolean(accessToken && employeeId && date && enabled),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

/**
 * Check-in / Check-out mutation.
 */

export function usePunchAttendance() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PunchAttendanceRequest) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      return punchAttendance(data, accessToken);
    },

    onSuccess: () => {
      void Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["attendance", "today"],
        }),
        queryClient.invalidateQueries({
          queryKey: ["attendance", "history"],
        }),
      ]).catch((invalidateError: unknown) => {
        console.warn(
          "Could not refresh attendance after punch:",
          invalidateError,
        );
      });
    },
  });
}
