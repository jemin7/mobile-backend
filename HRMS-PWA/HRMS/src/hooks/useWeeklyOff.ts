import { useQuery } from "@tanstack/react-query";

import { getEmployeeWeeklyOffs } from "../api/weeklyOff";
import { useAuth } from "../auth/AuthProvider";

export function useWeeklyOff() {
  const { user, accessToken } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["employee-weekly-off", employeeId],
    queryFn: () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is not available.");
      }

      return getEmployeeWeeklyOffs(employeeId, accessToken);
    },
    enabled: Boolean(employeeId && accessToken),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
