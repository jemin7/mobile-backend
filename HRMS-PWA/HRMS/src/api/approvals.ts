import { apiRequest } from "./client";
import { getLeaveBalance } from "./leave";

export type ApprovalEmployee = {
  id?: number;
  employeeID?: string | null;
  employeeFirstName?: string | null;
  employeeLastName?: string | null;
  gender?: string | null;
};

export type TeamLeaveApproval = {
  id: number;
  manageEmployeeID: number;
  manageEmployee?: ApprovalEmployee | null;
  fromDate: string;
  toDate: string;
  appliedLeaveType: string;
  purpose?: string | null;
  status: string;
  dayStatuses?: unknown;
  createdAt?: string;
};

export type TeamReimbursementApproval = {
  id: number;
  manageEmployeeID: number;
  manageEmployee?: ApprovalEmployee | null;
  date: string;
  status: string;
  taskProjectID?: number | null;
  items: {
    id: number;
    reimbursementType: string;
    amount: string | number;
    description: string;
    status?: string | null;
  }[];
};

export type TeamAdvanceApproval = {
  id: number;
  manageEmployeeID: number;
  manageEmployee?: ApprovalEmployee | null;
  advanceAmount?: string | null;
  reason?: string | null;
  status: string;
};

export type RegularisationApproval = {
  id: number;
  manageEmployeeID: number;
  manageEmployee?: ApprovalEmployee | null;
  attendanceDate: string;
  actualStatus?: string | null;
  requestedStatus?: string | null;
  reason?: string | null;
  approval: {
    requestID: number;
    requestStatus: string;
    currentStepNo: number | null;
    workflowName?: string | null;
    assignmentID: number;
    assignmentStatus: string;
    stepNo: number;
    stepStatus: string;
    canReject: boolean;
    canSendBack: boolean;
  } | null;
};

export type WorkflowAssignment = {
  id: number;
  approvalRequestID: number;
  status: string;
  approvalRequest: {
    id: number;
    subjectType: string;
    subjectID: number;
    status: string;
    currentStepNo: number | null;
    allowAnySameDesignationSnapshot?: boolean;
  };
  approvalRequestStep: {
    id: number;
    stepNo: number;
    status: string;
    stepNameSnapshot?: string | null;
    canRejectSnapshot: boolean;
    canSendBackSnapshot: boolean;
  };
};

export function getTeamLeaveApprovals(
  employeeId: number,
  token: string | null,
) {
  return apiRequest<TeamLeaveApproval[]>(
    `/leave-application/employee/${employeeId}`,
    { method: "GET", token },
  );
}

export function getTeamReimbursementApprovals(
  managerId: number,
  token: string | null,
) {
  return apiRequest<TeamReimbursementApproval[]>(
    `/reimbursement/team/${managerId}`,
    { method: "GET", token },
  );
}

export function getTeamAdvanceApprovals(
  managerId: number,
  token: string | null,
) {
  return apiRequest<TeamAdvanceApproval[]>(
    `/salary-advance/team/${managerId}`,
    { method: "GET", token },
  );
}

export function getMyRegularisationApprovals(token: string | null) {
  return apiRequest<RegularisationApproval[]>(
    "/approval-requests/my-regularisations",
    { method: "GET", token },
  );
}

export function getMyPendingWorkflowAssignments(token: string | null) {
  return apiRequest<WorkflowAssignment[]>("/approval-requests/my-pending", {
    method: "GET",
    token,
  });
}

export function getMyAssignedWorkflowAssignments(token: string | null) {
  return apiRequest<WorkflowAssignment[]>("/approval-requests/my-assigned", {
    method: "GET",
    token,
  });
}

export type TeamLeaveDecisionPayload = {
  status: "Approved" | "Partially Approved" | "Rejected" | "Revoked";
  actorRole: "MANAGER";
  appliedLeaveType?: string;
  dayStatuses?: unknown[];
  remainingSickLeave?: number;
  remainingCasualLeave?: number;
};

export function decideTeamLeave(
  id: number,
  payload: TeamLeaveDecisionPayload,
  token: string | null,
) {
  return apiRequest<TeamLeaveApproval>(`/leave-application/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function decideTeamAdvance(
  managerId: number,
  id: number,
  status: "Approved" | "Rejected",
  token: string | null,
) {
  return apiRequest<TeamAdvanceApproval>(
    `/salary-advance/team/${managerId}/${id}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({ status }),
    },
  );
}

export function approveWorkflowRequest(
  requestId: number,
  remark: string,
  token: string | null,
) {
  return apiRequest<unknown>(`/approval-requests/${requestId}/approve`, {
    method: "POST",
    token,
    body: JSON.stringify({ remark }),
  });
}

export function rejectWorkflowRequest(
  requestId: number,
  remark: string,
  token: string | null,
) {
  return apiRequest<unknown>(`/approval-requests/${requestId}/reject`, {
    method: "POST",
    token,
    body: JSON.stringify({ remark }),
  });
}

export type LeaveApprovalBalanceEntry = {
  used: number;
  total: number;
  remaining: number;
};

export type LeaveApprovalBalance = {
  sick: LeaveApprovalBalanceEntry;
  casual: LeaveApprovalBalanceEntry;
  privileged: LeaveApprovalBalanceEntry;
  compOff: LeaveApprovalBalanceEntry;
  maternity: LeaveApprovalBalanceEntry;
  paternity: LeaveApprovalBalanceEntry;
};

export type TeamEmployeeLeaveContext = {
  balance: LeaveApprovalBalance;
  gender: string | null;
};

export async function getTeamEmployeeLeaveContext(
  employeeId: number,
  gender: string | null | undefined,
  token: string | null,
): Promise<TeamEmployeeLeaveContext> {
  const balance = await getLeaveBalance(employeeId, token);

  const toEntry = (value: number | null | undefined) => {
    const remaining = Math.max(Number(value ?? 0), 0);

    return {
      used: 0,
      total: remaining,
      remaining,
    };
  };

  return {
    balance: {
      sick: toEntry(balance.sick),
      casual: toEntry(balance.casual),
      privileged: toEntry(balance.privileged),
      compOff: toEntry(balance.compOff),
      maternity: toEntry(balance.mtl),
      paternity: toEntry(balance.ptl),
    },
    gender: gender ?? null,
  };
}
