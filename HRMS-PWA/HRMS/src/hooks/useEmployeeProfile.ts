import { useQuery } from "@tanstack/react-query";

import { getEmployeeProfile } from "../api/profile";
import { useAuth } from "../auth/AuthProvider";

export function useEmployeeProfile() {
  const { accessToken, user } = useAuth();

  const employeeId = user?.employee?.id ?? user?.id ?? null;

  const profileQuery = useQuery({
    queryKey: ["employee-profile", employeeId],
    queryFn: () => getEmployeeProfile(accessToken),
    enabled: Boolean(employeeId && accessToken),
  });

  return {
    employeeId,
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    isFetching: profileQuery.isFetching,
    error: profileQuery.error ?? null,
    refetch: profileQuery.refetch,
  };
}
