import { apiRequest, apiUploadFile } from "./client";
import type { EmployeeUser } from "./auth";

export type TaskProject = {
  taskType?: string | null;
  scheduleDateTime?: string | null;
  site?: {
    branchName?: string | null;
    city?: string | null;
  } | null;
  id: number | string;
  taskName?: string | null;
  taskCode?: string | null;
  status?: string | null;
  createdByEmployeeID?: number | null;
  priority?: string | null;
  description?: string | null;
  dueDate?: string | null;
  dueAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: unknown;
};

export type TaskListResponse = {
  items: TaskProject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts?: Record<string, number>;
};

export type TaskChatMessage = {
  id: number;
  taskID: number;
  userID?: number | null;
  employeeID?: number | null;
  recipientEmployeeID?: number | null;
  senderName?: string | null;
  message: string;
  attachmentUrl?: string | null;
  createdAt: string;
};

export type GetTasksParams = {
  user: EmployeeUser;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  assignedToMe?: boolean;
};

export type CreateTaskPayload = {
  taskType: string;
  customerID?: number;
  siteID?: number;
  taskName: string;
  description?: string;
  priority: "Low" | "Medium" | "High" | "Urgent";
  dueAt: string;
  assignedEmployeeIds: number[];
};

export type TaskCustomerOption = {
  id: number;
  customerCode?: string | null;
  customerName: string;
};

export type TaskCustomerSiteOption = {
  id: number;
  customerID: number;
  branchName: string;
  siteCode?: string | null;
  city?: string | null;
};

function buildTaskDropdownQuery(user: EmployeeUser) {
  const query = new URLSearchParams();
  query.set("viewerRole", "EMPLOYEE");
  query.set("viewerUserId", String(user.id));

  if (user.employee?.id != null) {
    query.set("viewerEmployeeId", String(user.employee.id));
  }

  if (user.companyID != null) {
    query.set("companyID", String(user.companyID));
  }

  if (user.serviceProviderID != null) {
    query.set("serviceProviderID", String(user.serviceProviderID));
  }

  return query;
}

export async function getTaskCustomers(user: EmployeeUser, token: string) {
  const query = buildTaskDropdownQuery(user);
  query.set("limit", "50");

  return apiRequest<TaskCustomerOption[]>(
    `/task-customers/dropdown?${query.toString()}`,
    { method: "GET", token },
  );
}

export async function getTaskCustomerSites(
  customerID: number,
  user: EmployeeUser,
  token: string,
) {
  const query = buildTaskDropdownQuery(user);

  return apiRequest<TaskCustomerSiteOption[]>(
    `/task-customer-sites/by-customer/${customerID}?${query.toString()}`,
    { method: "GET", token },
  );
}
export async function getTasks(
  params: GetTasksParams,
  token: string,
): Promise<TaskListResponse> {
  if (!token) {
    throw new Error("You must be signed in to load tasks.");
  }

  const {
    user,
    page = 1,
    limit = 50,
    search,
    status,
    assignedToMe = true,
  } = params;

  const query = new URLSearchParams();

  query.set("page", String(Math.max(1, page)));
  query.set("limit", String(Math.min(100, Math.max(1, limit))));
  if (assignedToMe) {
    query.set("assignedToMe", "1");
  }
  query.set("viewerRole", "EMPLOYEE");
  query.set("viewerUserId", String(user.id));

  const employeeId = user.employee?.id;

  if (employeeId != null) {
    query.set("viewerEmployeeId", String(employeeId));
  }

  if (user.companyID != null) {
    query.set("companyID", String(user.companyID));
  }

  if (user.serviceProviderID != null) {
    query.set("serviceProviderID", String(user.serviceProviderID));
  }

  const trimmedSearch = search?.trim();

  if (trimmedSearch) {
    query.set("search", trimmedSearch);
  }

  if (status?.trim()) {
    query.set("status", status.trim());
  }

  return apiRequest<TaskListResponse>(`/task-projects?${query.toString()}`, {
    method: "GET",
    token,
  });
}

export async function createTask(
  data: CreateTaskPayload,
  token: string | null,
): Promise<TaskProject> {
  return apiRequest<TaskProject>("/task-projects", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

function buildTaskChatQuery(user: EmployeeUser) {
  const query = new URLSearchParams();

  query.set("viewerRole", "EMPLOYEE");
  query.set("viewerUserId", String(user.id));

  if (user.employee?.id != null) {
    query.set("viewerEmployeeId", String(user.employee.id));
  }

  if (user.companyID != null) {
    query.set("companyID", String(user.companyID));
  }

  if (user.serviceProviderID != null) {
    query.set("serviceProviderID", String(user.serviceProviderID));
  }

  return query.toString();
}

export async function updateTaskStatus(
  taskId: number | string,
  user: EmployeeUser,
  token: string,
  status: string,
) {
  const actorName =
    [user.employee?.firstName, user.employee?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() || user.username;

  return apiRequest<TaskProject>(
    `/task-projects/${taskId}/status?${buildTaskChatQuery(user)}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({ status, actorName }),
    },
  );
}

export async function getTaskChats(
  taskId: number | string,
  user: EmployeeUser,
  token: string,
) {
  return apiRequest<TaskChatMessage[]>(
    `/task-projects/${taskId}/chats?${buildTaskChatQuery(user)}`,
    { method: "GET", token },
  );
}

export async function sendTaskChatMessage(
  taskId: number | string,
  user: EmployeeUser,
  token: string,
  message: string,
  attachmentUrl?: string,
) {
  const senderName =
    [user.employee?.firstName, user.employee?.lastName]
      .filter(Boolean)
      .join(" ") || user.username;

  return apiRequest<TaskChatMessage>(
    `/task-projects/${taskId}/chats?${buildTaskChatQuery(user)}`,
    {
      method: "POST",
      token,
      body: JSON.stringify({
        message,
        attachmentUrl,
        senderName,
        broadcast: true,
      }),
    },
  );
}

export async function uploadTaskChatAttachment(
  asset: {
    uri: string;
    name?: string;
    mimeType?: string;
  },
  token: string,
): Promise<string> {
  const uploaded = await apiUploadFile<{ url: string }>(
    "/files/upload",
    asset.uri,
    {
      token,
      fieldName: "file",
      fileName: asset.name,
      mimeType: asset.mimeType,
    },
  );

  if (!uploaded.url?.startsWith("/uploads/")) {
    throw new Error("Invalid attachment URL returned by server.");
  }

  return uploaded.url;
}
