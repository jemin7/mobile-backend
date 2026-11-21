
import * as Print from "expo-print";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import * as IntentLauncher from "expo-intent-launcher";

export type PayslipPdfPayload = {
  companyName: string;
  branchName: string;
  employee: {
    id?: number;
    employeeID?: string | null;
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    departments?: { departmentName?: string | null } | null;
    designations?: { designation?: string | null } | null;
    company?: { address?: string | null } | null;
  };
  monthLabel: string;
  start: Date;
  end: Date;
  cycleDays: number;
  lopDays: number;
  nonLoPLeaveDays: number;
  weeklyOffDays: number;
  holidays: number;
  halfDaysUnits: number;
  gross: number;
  basic: number;
  earnings: { name: string; amount: number }[];
  deductions: { name: string; amount: number }[];
  lopAmount: number;
  earningsTotal: number;
  deductionsTotal: number;
  netPay: number;
  status?: string | null;
  paymentDate?: string | null;
  paymentMode?: string | null;
};

export type GeneratedPayslipPdf = {
  uri: string;
  fileName: string;
};

type PayslipPdfLineItem = {
  name: string;
  amount: number;
  total?: boolean;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDate(value: Date): string {
  return value.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildPayslipHtml(payload: PayslipPdfPayload): string {
  const employeeName = [
    payload.employee.employeeFirstName,
    payload.employee.employeeLastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const earningsRows: PayslipPdfLineItem[] = [
    { name: "Basic Pay", amount: payload.basic },
    ...payload.earnings,
    { name: "Total Earnings", amount: payload.earningsTotal, total: true },
  ];

  const deductionsRows: PayslipPdfLineItem[] = [
    ...payload.deductions,
    { name: "Loss of Pay", amount: payload.lopAmount },
    {
      name: "Total Deductions",
      amount: payload.deductionsTotal + payload.lopAmount,
      total: true,
    },
  ];

  const rowCount = Math.max(earningsRows.length, deductionsRows.length);

  const salaryRows = Array.from({ length: rowCount }, (_, index) => {
    const earning = earningsRows[index];
    const deduction = deductionsRows[index];

    return `
      <tr>
        <td class="${earning?.total ? "total" : ""}">
          ${escapeHtml(earning?.name ?? "")}
        </td>
        <td class="amount ${earning?.total ? "total" : ""}">
          ${earning ? formatMoney(earning.amount) : ""}
        </td>
        <td class="${deduction?.total ? "total" : ""}">
          ${escapeHtml(deduction?.name ?? "")}
        </td>
        <td class="amount ${deduction?.total ? "total" : ""}">
          ${deduction ? formatMoney(deduction.amount) : ""}
        </td>
      </tr>
    `;
  }).join("");

  const paidDays = Math.max(0, payload.cycleDays - payload.lopDays);

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @page {
          size: A4;
          margin: 18mm 14mm;
        }

        * {
          box-sizing: border-box;
        }

        body {
          font-family: Arial, Helvetica, sans-serif;
          color: #222;
          font-size: 10px;
          line-height: 1.5;
        }

        h1, h2, p {
          margin: 0;
        }

        .company {
          text-align: center;
          font-size: 19px;
          font-weight: bold;
          color: #3b4b80;
        }

        .address {
          text-align: center;
          color: #666;
          margin-top: 4px;
        }

        .heading {
          text-align: center;
          font-size: 14px;
          font-weight: bold;
          margin: 24px 0 14px;
        }

        .period {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          font-size: 10px;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
        }

        th, td {
          border: 1px solid #d5d5d5;
          padding: 7px;
          text-align: left;
          vertical-align: top;
        }

        th {
          background: #3b4b80;
          color: white;
          text-align: center;
        }

        .amount {
          text-align: right;
          white-space: nowrap;
        }

        .total {
          font-weight: bold;
          background: #f1f3f8;
        }

        .section-title {
          font-size: 11px;
          font-weight: bold;
          margin: 16px 0 7px;
        }

        .net-pay {
          margin-top: 14px;
          padding: 14px;
          border: 1px solid #3b4b80;
          text-align: center;
        }

        .net-pay-label {
          font-size: 11px;
          color: #555;
        }

        .net-pay-amount {
          font-size: 20px;
          font-weight: bold;
          color: #263b75;
          margin-top: 5px;
        }

        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 8px;
          color: #777;
        }

        .signature {
          margin-top: 45px;
          display: flex;
          justify-content: space-between;
        }

        .signature div {
          width: 35%;
          text-align: center;
          border-top: 1px solid #444;
          padding-top: 6px;
        }
      </style>
    </head>

    <body>
      <h1 class="company">${escapeHtml(payload.companyName)}</h1>
      <p class="address">
        ${escapeHtml(payload.employee.company?.address || "Head Office")}
      </p>

      <h2 class="heading">SALARY SLIP</h2>

      <div class="period">
        <span>Branch: ${escapeHtml(payload.branchName)}</span>
        <span>Period: ${escapeHtml(payload.monthLabel)}</span>
      </div>

      <div class="section-title">Employee Information</div>

      <table>
        <tr>
          <td>Employee ID</td>
          <td>${escapeHtml(payload.employee.employeeID || payload.employee.id || "-")}</td>
          <td>Employee Name</td>
          <td>${escapeHtml(employeeName || "-")}</td>
        </tr>
        <tr>
          <td>Department</td>
          <td>${escapeHtml(payload.employee.departments?.departmentName || "-")}</td>
          <td>Designation</td>
          <td>${escapeHtml(payload.employee.designations?.designation || "-")}</td>
        </tr>
        <tr>
          <td>Payment Status</td>
          <td>${escapeHtml(payload.status || "Pending")}</td>
          <td>Payment Date</td>
          <td>${escapeHtml(payload.paymentDate || "-")}</td>
        </tr>
        <tr>
          <td>Payment Mode</td>
          <td>${escapeHtml(payload.paymentMode || "-")}</td>
          <td>Gross Salary</td>
          <td>${formatMoney(payload.gross)}</td>
        </tr>
      </table>

      <div class="section-title">Attendance Summary</div>

      <table>
        <tr>
          <td>Cycle Days</td>
          <td>${payload.cycleDays}</td>
          <td>Paid Days</td>
          <td>${paidDays.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Approved Leaves</td>
          <td>${payload.nonLoPLeaveDays}</td>
          <td>LOP Days</td>
          <td>${payload.lopDays.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Weekly Offs</td>
          <td>${payload.weeklyOffDays}</td>
          <td>Holidays</td>
          <td>${payload.holidays}</td>
        </tr>
        <tr>
          <td>Half-day Units</td>
          <td>${payload.halfDaysUnits.toFixed(2)}</td>
          <td>Period End</td>
          <td>${formatDate(payload.end)}</td>
        </tr>
      </table>

      <div class="section-title">Earnings and Deductions</div>

      <table>
        <thead>
          <tr>
            <th colspan="2">Earnings</th>
            <th colspan="2">Deductions</th>
          </tr>
        </thead>
        <tbody>
          ${salaryRows}
        </tbody>
      </table>

      <div class="net-pay">
        <div class="net-pay-label">NET PAYABLE</div>
        <div class="net-pay-amount">${formatMoney(payload.netPay)}</div>
      </div>

      <div class="signature">
        <div>Employer's Signature</div>
        <div>Employee's Signature</div>
      </div>

      <div class="footer">
        This is a system-generated document.<br />
        Generated on ${escapeHtml(new Date().toLocaleDateString("en-IN"))}
      </div>
    </body>
  </html>
  `;
}

function createPayslipFileName(payload: PayslipPdfPayload): string {
  const employeeId = String(
    payload.employee.employeeID || payload.employee.id || "employee",
  ).replace(/[^a-zA-Z0-9_-]/g, "_");

  const date = payload.start;

  return `Salary_Slip_${employeeId}_${date.getFullYear()}_${String(
    date.getMonth() + 1,
  ).padStart(2, "0")}.pdf`;
}

export async function generatePayslipPdf(
  payload: PayslipPdfPayload,
): Promise<GeneratedPayslipPdf> {
  const html = buildPayslipHtml(payload);

  const result = await Print.printToFileAsync({ html });

  if (!result.uri) {
    throw new Error("The PDF could not be generated.");
  }

  return {
    uri: result.uri,
    fileName: createPayslipFileName(payload),
  };
}

export async function viewPayslipPdf(
  uri: string,
  fileName: string,
): Promise<void> {
  if (Platform.OS === "android") {
    try {
      const contentUri = await FileSystem.getContentUriAsync(uri);

      await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
        data: contentUri,
        type: "application/pdf",
        flags: 1,
      });
    } catch (error) {
      // Some Android builds do not expose a PDF viewer intent. Fall back
      // to the system share sheet so the employee can open the downloaded PDF.
      if (!(await Sharing.isAvailableAsync())) {
        throw error;
      }

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        UTI: "com.adobe.pdf",
        dialogTitle: fileName,
      });
    }

    return;
  }

  const file = new File(uri);

  if (!(await File.canPreview(file, { mimeType: "application/pdf" }))) {
    throw new Error("No compatible PDF viewer is available on this device.");
  }

  await File.preview(file, {
    title: fileName,
    mimeType: "application/pdf",
  });
}

export async function downloadPayslipPdf(
  uri: string,
  fileName: string,
): Promise<"saved" | "shared" | "cancelled"> {
  if (Platform.OS === "android") {
    const permission =
      await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

    if (!permission.granted) {
      return "cancelled";
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const destinationUri =
      await FileSystem.StorageAccessFramework.createFileAsync(
        permission.directoryUri,
        fileName,
        "application/pdf",
      );

    await FileSystem.writeAsStringAsync(destinationUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return "saved";
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing is not available on this device.");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    UTI: "com.adobe.pdf",
    dialogTitle: `Save ${fileName}`,
  });

  return "shared";
}