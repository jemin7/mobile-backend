import { apiDownloadFile, apiRequest } from "./client";
import { downloadPdfToPublicDownloads } from "../../modules/hrms-download-manager/src";

export type PayslipRecord = {
  id: number;
  employeeID: number;
  monthPeriod: string;
  status: string | null;
  paymentMode: string | null;
  paymentType: string | null;
  paymentDate: string | null;
  paymentRemark: string | null;
  paymentProof: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PayslipPage = {
  items: PayslipRecord[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export async function getPayslips(
  token: string | null,
): Promise<PayslipRecord[]> {
  if (!token) {
    throw new Error("Please sign in to view your payslips.");
  }

  const records = await apiRequest<PayslipRecord[]>("/generate-salary", {
    method: "GET",
    token,
  });

  if (!Array.isArray(records)) {
    throw new Error("Invalid payslip data received from the server.");
  }

  return records;
}
export async function getPayslipPage(
  token: string | null,
  page: number,
  limit = 10,
  fromMonth?: string,
  toMonth?: string,
): Promise<PayslipPage> {
  if (!token) {
    throw new Error("Please sign in to view your payslips.");
  }

  const monthParams =
    fromMonth && toMonth
      ? `&fromMonth=${encodeURIComponent(fromMonth)}&toMonth=${encodeURIComponent(toMonth)}`
      : "";

  return apiRequest<PayslipPage>(
    `/generate-salary/employee/page?page=${page}&limit=${limit}${monthParams}`,
    { method: "GET", token },
  );
}

export async function getPayslipById(
  id: number,
  token: string | null,
): Promise<PayslipRecord> {
  if (!token) {
    throw new Error("Please sign in to view your payslip.");
  }

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid payslip ID.");
  }

  return apiRequest<PayslipRecord>(`/generate-salary/${id}`, {
    method: "GET",
    token,
  });
}

export async function downloadPayslipPdf(
  id: number,
  token: string | null,
): Promise<string> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid payslip ID.");
  }

  return apiDownloadFile(
    `/generate-salary/${id}/pdf`,
    `EN-Time-HR-Payslip-${id}.pdf`,
    token,
  );
}

export async function startPayslipDownload(
  id: number,
  token: string | null,
): Promise<string> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid payslip ID.");
  }

  if (!token) {
    throw new Error("Please sign in to download your payslip.");
  }

  const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

  if (!apiUrl) {
    throw new Error("EXPO_PUBLIC_API_URL is not configured.");
  }

  if (!__DEV__ && !apiUrl.toLowerCase().startsWith("https://")) {
    throw new Error("Production payslip downloads require HTTPS.");
  }

  return downloadPdfToPublicDownloads(
    `${apiUrl}/generate-salary/${id}/pdf`,
    `EN-Time-HR-Payslip-${id}.pdf`,
    token,
  );
}
