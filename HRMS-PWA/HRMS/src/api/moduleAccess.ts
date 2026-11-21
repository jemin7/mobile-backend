import { apiRequest } from "./client";

export type CompanyModuleAccess = {
  companyId: number | null;
  subscriptionRequired: boolean;
  subscriptionStatus: string | null;
  subscriptionValidFrom: string | null;
  subscriptionValidTo: string | null;
  isSubscriptionExempt: boolean;
  modules: string[];
};

export type EmployeeModulePermission = {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type EmployeeModuleAccess = {
  manageEmployeeId: number;
  companyId: number | null;
  hasExplicitPermissions: boolean;
  isCompanyOwner: boolean;
  ownerTitle: string | null;
  name: string;
  permissions: EmployeeModulePermission[];
  hasAnyCompanyAccess: boolean;
};

export function getCompanyModuleAccess(token: string | null) {
  return apiRequest<CompanyModuleAccess>("/company-access/me", {
    method: "GET",
    token,
  });
}

export function getEmployeeModuleAccess(token: string | null) {
  return apiRequest<EmployeeModuleAccess>("/employee-permissions/me", {
    method: "GET",
    token,
  });
}
