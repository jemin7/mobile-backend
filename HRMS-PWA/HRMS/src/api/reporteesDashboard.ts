import { apiRequest } from "./client";

export type ReporteeDashboardSummary = {
  total: number;
  present: number;
  absent: number;
  lateMark: number;
  halfDay: number;
  noCheckout: number;
  onLeave: number;
  weekOff: number;
  holiday: number;
  ot: number;
  regularized: number;
};

export type ReporteeDashboardEmployee = {
  id: number;
  employeeFirstName: string;
  employeeLastName: string;
  departmentName: string | null;
  designationName: string | null;
  inTime: string | null;
  outTime: string | null;
  statusType: string;
  statusLabel: string;
  statusDisplay: string;
  isLateArrival: boolean;
  hasPunches: boolean;
};

export type ReporteeDashboardResponse = {
  date: string;
  summary: ReporteeDashboardSummary;
  statusCounts: Record<string, number>;
  employees: ReporteeDashboardEmployee[];
};

export async function getManagerDirectReporteesDashboard(
  token: string | null,
): Promise<ReporteeDashboardResponse> {
  return apiRequest<ReporteeDashboardResponse>(
    "/dashboard-overview/manager-direct-reportees-today",
    {
      method: "GET",
      token,
    },
  );
}
