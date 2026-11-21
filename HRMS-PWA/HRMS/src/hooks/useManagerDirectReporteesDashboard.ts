import { useQuery } from "@tanstack/react-query";

import { getManagerDirectReporteesDashboard } from "../api/reporteesDashboard";
import { useAuth } from "../auth/AuthProvider";

export function useManagerDirectReporteesDashboard() {
  const { user, accessToken } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["manager-direct-reportees-dashboard", employeeId],

    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      return getManagerDirectReporteesDashboard(accessToken);
    },

    enabled: Boolean(employeeId && accessToken),

    staleTime: 30 * 1000,

    retry: 1,
  });
}
