import { useQuery } from "@tanstack/react-query";

import { getManagerTeamMembers } from "../api/team";
import { useAuth } from "../auth/AuthProvider";

export function useManagerTeamDirectory() {
  const { user, accessToken } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const query = useQuery({
    queryKey: ["manager-team-members", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerTeamMembers(accessToken);
    },

    enabled: Boolean(employeeId && accessToken),
    staleTime: 30_000,
    retry: 1,
  });

  return {
    members: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
