import { apiRequest } from "./client";

export type EmployeeNotificationKind =
  | "birthday"
  | "holiday"
  | "leave"
  | "reimbursement"
  | "payslip"
  | "memo"
  | "general";

export type EmployeeNotification = {
  id: string | number;
  kind: EmployeeNotificationKind;
  title: string;
  body: string;
  emoji?: string | null;
  at: string;
  href?: string | null;
  subjectEmployeeId?: number | null;
  subjectEmployeeName?: string | null;
  isTeamItem?: boolean;
};

export type NotificationFeedResponse = {
  recent: EmployeeNotification[];
  older: EmployeeNotification[];
  hasMore: boolean;
};

export type NotificationFeedScope = "personal" | "reportees" | "team";

export type TeamActivityScope = "reportees" | "team";

export type EmployeeRecentActivity = {
  id: string;
  kind: "attendance" | "task";
  title: string;
  body: string;
  at: string;
  subjectEmployeeId: number;
  subjectEmployeeName: string;
};

export async function getRecentActivity(
  token: string,
  scope: TeamActivityScope,
): Promise<EmployeeRecentActivity[]> {
  if (!token) {
    throw new Error("Please sign in to load recent activity.");
  }

  return apiRequest<EmployeeRecentActivity[]>(
    `/emp-notifications/activity?scope=${scope}&days=14`,
    {
      method: "GET",
      token,
    },
  );
}

export async function getNotificationFeed(
  token: string,
  scope?: NotificationFeedScope,
): Promise<NotificationFeedResponse> {
  if (!token) {
    throw new Error("Please sign in to load notifications.");
  }

  const scopeQuery = scope ? `&scope=${scope}` : "";

  return apiRequest<NotificationFeedResponse>(
    `/emp-notifications/feed?recentDays=7&olderDays=90${scopeQuery}`,
    {
      method: "GET",
      token,
    },
  );
}
