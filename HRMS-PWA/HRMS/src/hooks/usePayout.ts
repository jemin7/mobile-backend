import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { getPayslipById, getPayslipPage } from "../api/payout";

export function useInfinitePayslips(fromMonth?: string, toMonth?: string) {
  const { user, accessToken } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id;

  return useInfiniteQuery({
    queryKey: ["payslips", "pages", employeeId, fromMonth ?? "", toMonth ?? ""],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      getPayslipPage(accessToken, pageParam, 10, fromMonth, toMonth),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    enabled: Boolean(accessToken && employeeId),
    staleTime: 30_000,
    retry: 1,
  });
}

export function usePayslip(id?: number) {
  const { user, accessToken } = useAuth();
  const employeeId = user?.employee?.id ?? user?.id ?? null;

  return useQuery({
    queryKey: ["payslips", "detail", id, employeeId],
    queryFn: () => getPayslipById(id!, accessToken),
    enabled:
      Number.isSafeInteger(id) &&
      Number(id) > 0 &&
      Boolean(accessToken && employeeId),
    staleTime: 30_000,
    retry: 1,
  });
}