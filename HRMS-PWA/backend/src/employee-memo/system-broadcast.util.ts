export const COMPANY_BROADCAST_PREFIX = 'IM_COMPANY::';

export function isCompanyBroadcastSubject(subject?: string | null): boolean {
  const s = subject?.trim() ?? '';
  return (
    s.startsWith(COMPANY_BROADCAST_PREFIX) ||
    s.startsWith(`Re: ${COMPANY_BROADCAST_PREFIX}`)
  );
}

/** Salary lines are never shown in the company chat. */
export function isSalaryBroadcastDescription(description?: string | null): boolean {
  const d = (description || '').trim();
  return /^(Payroll generated:|Salary paid:)/i.test(d);
}

/** Company chat keeps holidays, birthdays, and work anniversaries. */
export function isPublicCompanyChatDescription(description?: string | null): boolean {
  const d = (description || '').trim();
  return (
    /^Holiday announced:/i.test(d) ||
    /^Happy Birthday/i.test(d) ||
    /birthday today/i.test(d) ||
    /work anniversary/i.test(d) ||
    /joined the company/i.test(d)
  );
}

/** Leave, reimbursement, and loan notices are only for the applicant and managers above them. */
export function isPrivateApprovalBroadcastDescription(description?: string | null): boolean {
  const d = (description || '').trim();
  return /^(Leave |Reimbursement |Loan advance )/i.test(d);
}

export function personalHrDescriptionNamesViewer(
  description: string | null | undefined,
  viewer: {
    employeeFirstName?: string | null;
    employeeLastName?: string | null;
    employeeID?: string | null;
  },
): boolean {
  const d = (description || '').toLowerCase();
  if (!d) return false;
  const full = `${viewer.employeeFirstName || ''} ${viewer.employeeLastName || ''}`
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (full.length >= 3 && d.includes(full)) return true;
  const code = String(viewer.employeeID || '')
    .trim()
    .toLowerCase();
  if (code.length >= 3 && d.includes(code)) return true;
  return false;
}
