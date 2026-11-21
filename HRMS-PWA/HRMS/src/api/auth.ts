import { apiRequest } from "./client";
export type EmployeeUser = {
  id: number;
  username: string;
  role: string;
  type: string;
  mustChangePassword?: boolean;
  isCompanyOwner?: boolean;
  ownerTitle?: string | null;

  employee?: {
    id: number;
    employeeID: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    department?: string;
    designation?: string;
    company?: string;
    branch?: string;
    allowCreateTaskOnMobile?: boolean;
    pwaShowLeaveBalance?: boolean;
    pwaShowLoanAdvances?: boolean;
  };

  serviceProviderID?: number | null;
  companyID?: number | null;
  branchesID?: number | null;
};

export type MobileTokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type LoginResponse = MobileTokenResponse & {
  user: EmployeeUser;
};
export type ForgotPasswordResponse = {
  message: string;
  resetToken: string;
  maskedEmail?: string;
};

export type VerifyForgotPasswordResponse = {
  message?: string;
};

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  return apiRequest<LoginResponse>("/api/mobile/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
    }),
  });
}

export async function refreshMobileSession(
  refreshToken: string,
): Promise<MobileTokenResponse> {
  return apiRequest<MobileTokenResponse>("/api/mobile/v1/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  });
}

export async function forgotPassword(emailOrMobile: string) {
  return apiRequest<ForgotPasswordResponse>(
    "/api/mobile/v1/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({
        emailOrMobile,
      }),
    },
  );
}

export async function verifyForgotPassword(data: {
  resetToken: string;
  otp: string;
  newPassword: string;
  confirmPassword: string;
}) {
  return apiRequest<VerifyForgotPasswordResponse>(
    "/api/mobile/v1/auth/forgot-password/verify",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
  );
}

export async function logout(refreshToken: string | null) {
  if (!refreshToken) return;

  await apiRequest<{ ok: boolean }>("/api/mobile/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
    skipAuth: true,
  });
}
