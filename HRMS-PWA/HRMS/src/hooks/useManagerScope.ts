import { useQuery } from "@tanstack/react-query";

import { getManagerScope } from "../api/team";
import { useAuth } from "../auth/AuthProvider";

export function useManagerScope() {
  const { user, accessToken } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const managerScopeQuery = useQuery({
    queryKey: ["manager-scope", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerScope(accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });

  return {
    data: managerScopeQuery.data ?? null,

    hasReportees: managerScopeQuery.data?.hasReportees === true,

    isLoading: managerScopeQuery.isLoading,

    isError: managerScopeQuery.isError,

    error: managerScopeQuery.error,

    refetch: managerScopeQuery.refetch,
  };
}
