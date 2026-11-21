import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { useManagerScope } from "./useManagerScope";

import {
  getManagerRoster,
  assignManagerRoster,
  deleteManagerRosterAssignment,
  type ManagerRosterAssignmentPayload,
} from "../api/managerRoster";

export function useManagerRoster(fromDate: string, toDate: string) {
  const { user, accessToken } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const {
    hasReportees,
    isLoading: isScopeLoading,
    isError: isScopeError,
  } = useManagerScope();

  const queryClient = useQueryClient();

  const rosterQuery = useQuery({
    queryKey: ["manager-roster", employeeId, fromDate, toDate],

    queryFn: () => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      return getManagerRoster(fromDate, toDate, accessToken);
    },

    enabled: Boolean(
      employeeId && accessToken && hasReportees && fromDate && toDate,
    ),

    staleTime: 30_000,
    retry: 1,
  });

  const assignMutation = useMutation({
    mutationFn: (payload: ManagerRosterAssignmentPayload) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      return assignManagerRoster(payload, accessToken);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["manager-roster", employeeId],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (assignmentId: number) => {
      if (!accessToken) {
        throw new Error("Your session has expired. Please log in again.");
      }

      return deleteManagerRosterAssignment(assignmentId, accessToken);
    },

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["manager-roster", employeeId],
      });
    },
  });

  return {
    data: rosterQuery.data ?? null,
    hasReportees,
    isScopeLoading,
    isScopeError,
    isLoading: rosterQuery.isLoading,
    isError: rosterQuery.isError,
    error: rosterQuery.error,
    isFetching: rosterQuery.isFetching,
    refetch: rosterQuery.refetch,
    assignMutation,
    deleteMutation,
  };
}
