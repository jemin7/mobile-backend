import { apiRequest } from "./client";

export type EmployeeWeeklyOff = {
  id: number;
  employeeID: number;
  date: string;
};

export async function getEmployeeWeeklyOffs(
  employeeId: number,
  token: string | null,
): Promise<EmployeeWeeklyOff[]> {
  return apiRequest<EmployeeWeeklyOff[]>(
    `/employee-weekly-off/employee/${employeeId}`,
    {
      method: "GET",
      token,
    },
  );
}
