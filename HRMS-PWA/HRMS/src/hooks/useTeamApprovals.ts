import { useQuery } from "@tanstack/react-query";

import { useAuth } from "../auth/AuthProvider";
import { getManagerScope } from "../api/team";
import {
  getTeamLeaveApprovals,
  getTeamReimbursementApprovals,
  getTeamAdvanceApprovals,
  getMyRegularisationApprovals,
  getMyPendingWorkflowAssignments,
} from "../api/approvals";
import {
  getCompanyModuleAccess,
  getEmployeeModuleAccess,
} from "../api/moduleAccess";

export function useTeamApprovals() {
  const { user, accessToken } = useAuth();
  const employeeId = user?.employee?.id ?? null;

  const query = useQuery({
    queryKey: ["team-approvals", employeeId],
    enabled: Boolean(employeeId && accessToken),
    staleTime: 30_000,
    retry: 1,

    queryFn: async () => {
      if (!employeeId || !accessToken) {
        throw new Error("Employee information is unavailable.");
      }

      const [companyAccess, employeeAccess] = await Promise.all([
        getCompanyModuleAccess(accessToken),
        getEmployeeModuleAccess(accessToken),
      ]);

      const isCompanyOwner = employeeAccess.isCompanyOwner === true;

      const entitledModules = new Set(companyAccess.modules ?? []);

      const employeePermissions = new Map(
        (employeeAccess.permissions ?? []).map((permission) => [
          permission.moduleKey,
          permission,
        ]),
      );

      const canViewModule = (
        productModuleKey: string,
        permissionKeys: string[] = [],
      ) => {
        const subscriptionAllowed =
          !companyAccess.subscriptionRequired ||
          companyAccess.isSubscriptionExempt ||
          entitledModules.has(productModuleKey);

        if (!subscriptionAllowed) {
          return false;
        }

        if (
          employeeAccess.isCompanyOwner ||
          !employeeAccess.hasExplicitPermissions ||
          permissionKeys.length === 0
        ) {
          return true;
        }

        return permissionKeys.some(
          (key) => employeePermissions.get(key)?.canView === true,
        );
      };

      const moduleAccess = {
        teamApprovals: canViewModule("TEAM_APPROVALS_MODULE"),
        leave: canViewModule("LEAVE_MODULE", ["LEAVE_APPLICATIONS"]),
        reimbursement: canViewModule("REIMBURSEMENT_MODULE", [
          "REIMBURSEMENTS",
        ]),
        advance: canViewModule("LOAN_ADVANCE_MODULE", ["SALARY_ADVANCES"]),
        regularisation: canViewModule("REGULARISATION_MODULE", [
          "REGULARISATION",
        ]),
      };

      const emptyResult = {
        employeeId,
        isCompanyOwner,
        hasReportees: false,
        hasApprovalsAccess: moduleAccess.teamApprovals,
        moduleAccess,
        pendingLeave: [],
        pendingReimbursements: [],
        pendingAdvances: [],
        pendingRegularisations: [],
        pendingCount: 0,
      };

      if (!moduleAccess.teamApprovals) {
        return emptyResult;
      }

      const [
        scope,
        leaveApplications,
        reimbursements,
        advances,
        regularisations,
        pendingAssignments,
      ] = await Promise.all([
        getManagerScope(accessToken),
        moduleAccess.leave
          ? getTeamLeaveApprovals(employeeId, accessToken)
          : Promise.resolve([]),
        moduleAccess.reimbursement
          ? getTeamReimbursementApprovals(employeeId, accessToken)
          : Promise.resolve([]),
        moduleAccess.advance
          ? getTeamAdvanceApprovals(employeeId, accessToken)
          : Promise.resolve([]),
        moduleAccess.regularisation
          ? getMyRegularisationApprovals(accessToken)
          : Promise.resolve([]),
        moduleAccess.regularisation
          ? getMyPendingWorkflowAssignments(accessToken)
          : Promise.resolve([]),
      ]);

      const reporteeIds = new Set(
        (scope.reporteeIds ?? []).filter((id) => id !== employeeId),
      );

      const canReviewEmployee = (targetEmployeeId: number) =>
        targetEmployeeId !== employeeId &&
        (isCompanyOwner || reporteeIds.has(targetEmployeeId));

      const pendingLeave = leaveApplications.filter(
        (item) =>
          canReviewEmployee(item.manageEmployeeID) &&
          ["Pending", "Partially Approved", "RevokePending"].includes(
            item.status,
          ),
      );

      const pendingReimbursements = reimbursements.filter((item) => {
        if (!canReviewEmployee(item.manageEmployeeID)) {
          return false;
        }

        const hasPendingItems = (item.items ?? []).some(
          (expense) => (expense.status ?? "Pending") === "Pending",
        );

        return (
          item.status === "Pending" ||
          (item.status === "Partially Approved" && hasPendingItems)
        );
      });

      const pendingAdvances = advances.filter(
        (item) =>
          canReviewEmployee(item.manageEmployeeID) && item.status === "Pending",
      );

      const actionableAssignmentsByRequestId = new Map(
        pendingAssignments
          .filter(
            (assignment) =>
              String(assignment.approvalRequest?.status).toUpperCase() ===
              "PENDING",
          )
          .map(
            (assignment) =>
              [assignment.approvalRequest.id, assignment] as const,
          ),
      );

      const pendingRegularisations = regularisations.flatMap((item) => {
        const approval = item.approval;

        if (
          !approval ||
          String(approval.requestStatus).toUpperCase() !== "PENDING"
        ) {
          return [];
        }

        const actionableAssignment = actionableAssignmentsByRequestId.get(
          approval.requestID,
        );

        if (!actionableAssignment) {
          return [];
        }

        const step = actionableAssignment.approvalRequestStep;

        return [
          {
            ...item,
            approval: {
              ...approval,
              assignmentID: actionableAssignment.id,
              assignmentStatus: actionableAssignment.status,
              stepNo: step.stepNo,
              stepStatus: step.status,
              canReject: step.canRejectSnapshot,
              canSendBack: step.canSendBackSnapshot,
            },
            canApprove: true,
          },
        ];
      });

      return {
        employeeId,
        isCompanyOwner,
        hasReportees: scope.hasReportees,
        hasApprovalsAccess: true,
        moduleAccess,
        pendingLeave,
        pendingReimbursements,
        pendingAdvances,
        pendingRegularisations,
        pendingCount:
          pendingLeave.length +
          pendingReimbursements.length +
          pendingAdvances.length +
          pendingRegularisations.length,
      };
    },
  });

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
}
