import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { getMyLoanAdvances, createMyLoanAdvance } from "../api/loan";

export function useMyLoanAdvances() {
  const { accessToken, user } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["loan-advances", "mine", employeeId],
    queryFn: () => getMyLoanAdvances(accessToken),
    enabled: Boolean(accessToken && employeeId),
  });
}

export function useCreateMyLoanAdvance() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { advanceAmount: string; reason: string }) =>
      createMyLoanAdvance(data, accessToken),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["loan-advances", "mine"],
      });
    },
  });
}
