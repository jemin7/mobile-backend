import { apiRequest } from "./client";

export type LoanAdvance = {
  id: number;
  advanceAmount: string | number;
  reason: string;
  status: string;
  previousAdvancesDue?: string | number | null;
  createdAt: string;
};

export function getMyLoanAdvances(token: string | null) {
  return apiRequest<LoanAdvance[]>("/salary-advance/me", {
    method: "GET",
    token,
  });
}

export function createMyLoanAdvance(
  data: { advanceAmount: string; reason: string },
  token: string | null,
) {
  return apiRequest<LoanAdvance>("/salary-advance/me", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}
