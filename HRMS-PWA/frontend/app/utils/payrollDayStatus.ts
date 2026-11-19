export const CONSUMING_LEAVE_STATUSES = ["Approved", "Accepted", "Partially Approved"]

export type RegularisationPay = "full" | "half" | "absent" | "paidLeave" | "weekoff"

export function calendarDateKey(value: unknown): string {
  if (value == null || value === "") return ""
  const text = String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString().slice(0, 10)
}

export function isConsumingLeaveStatus(status?: string | null): boolean {
  return CONSUMING_LEAVE_STATUSES.includes(String(status ?? "").trim())
}

function isLossOfPayLabel(value: string): boolean {
  const key = value.trim().toLowerCase().replace(/[\s_()]+/g, "")
  return key === "lop" || key === "lossofpay"
}

/** Paid or unpaid leave for one calendar day. Null when this application does not cover that day. */
export function leaveDayPay(
  leave: {
    status?: string | null
    appliedLeaveType?: string | null
    fromDate?: unknown
    toDate?: unknown
    dayStatuses?: unknown
  },
  dateKey: string,
): "paid" | "unpaid" | null {
  if (!dateKey || !isConsumingLeaveStatus(leave.status)) return null
  const days = Array.isArray(leave.dayStatuses) ? leave.dayStatuses : null
  if (days && days.length > 0) {
    const day = days.find((row) => calendarDateKey((row as { date?: unknown })?.date) === dateKey) as
      | { status?: string }
      | undefined
    const status = String(day?.status ?? "").trim()
    if (!status) return null
    return isLossOfPayLabel(status) ? "unpaid" : "paid"
  }
  const from = calendarDateKey(leave.fromDate)
  const to = calendarDateKey(leave.toDate)
  if (!from || !to || dateKey < from || dateKey > to) return null
  const applied = String(leave.appliedLeaveType ?? "")
  return isLossOfPayLabel(applied) ? "unpaid" : "paid"
}

export function leaveDayLabel(
  leave: {
    status?: string | null
    appliedLeaveType?: string | null
    fromDate?: unknown
    toDate?: unknown
    dayStatuses?: unknown
  },
  dateKey: string,
): string | null {
  const pay = leaveDayPay(leave, dateKey)
  if (!pay) return null
  const days = Array.isArray(leave.dayStatuses) ? leave.dayStatuses : null
  if (days && days.length > 0) {
    const day = days.find((row) => calendarDateKey((row as { date?: unknown })?.date) === dateKey) as
      | { status?: string }
      | undefined
    const status = String(day?.status ?? "").trim()
    if (status) return isLossOfPayLabel(status) ? "LOP" : status
  }
  const applied = String(leave.appliedLeaveType ?? "").trim()
  if (!applied) return pay === "unpaid" ? "LOP" : "Leave"
  return isLossOfPayLabel(applied) ? "LOP" : applied
}

export function regularisationPay(requestedStatus: unknown): RegularisationPay | null {
  const key = String(requestedStatus ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
  if (!key) return null
  if (key === "PRESENT" || key === "LATE_MARK" || key === "LATEMARK") return "full"
  if (key === "HALF_DAY" || key === "HALFDAY" || key === "HD") return "half"
  if (key === "LOP" || key === "LOSS_OF_PAY" || key === "ABSENT") return "absent"
  if (
    key === "SL" ||
    key === "CL" ||
    key === "PL" ||
    key === "SICK" ||
    key === "CASUAL" ||
    key === "PRIVILEGED" ||
    key === "PRIVILEGE" ||
    key === "SICK_LEAVE" ||
    key === "CASUAL_LEAVE" ||
    key === "PRIVILEGE_LEAVE" ||
    key === "PRIVILEGED_LEAVE"
  ) {
    return "paidLeave"
  }
  if (key === "WEEKOFF" || key === "WEEK_OFF" || key === "WO") return "weekoff"
  return null
}

export function regularisationMarkLabel(requestedStatus: unknown): string {
  const pay = regularisationPay(requestedStatus)
  if (pay === "full") {
    const key = String(requestedStatus ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")
    return key === "LATE_MARK" || key === "LATEMARK" ? "L" : "P"
  }
  if (pay === "half") return "HD"
  if (pay === "absent") return "LOP"
  if (pay === "paidLeave") {
    const key = String(requestedStatus ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_")
    if (key.startsWith("SICK") || key === "SL") return "SL"
    if (key.startsWith("CASUAL") || key === "CL") return "CL"
    return "PL"
  }
  if (pay === "weekoff") return "WO"
  return String(requestedStatus ?? "").trim() || "P"
}

/** Absent cutoff cannot be larger than half the shift, so an 8-hour rule cannot wipe a longer shift. */
export function cappedHalfDayMinutes(policyHalfMinutes: number, shiftNetMinutes: number): number {
  const policy = Number(policyHalfMinutes) || 0
  const shift = Number(shiftNetMinutes) || 0
  if (policy <= 0) return 0
  if (shift <= 0) return policy
  return Math.min(policy, Math.max(1, Math.floor(shift / 2)))
}

export function shiftNetMinutes(totalMinutes: unknown, wallMinutes: number): number {
  const stored = Number(totalMinutes)
  if (Number.isFinite(stored) && stored > 0) return stored
  return Math.max(0, wallMinutes)
}

export function percentageDeductionAmount(
  deduction: { salaryDeductionType?: string | null; salaryDeductionValue?: unknown; basedOn?: string | null },
  fullMonthBasic: number,
  monthlyGross: number,
): number {
  const type = String(deduction.salaryDeductionType || "").toLowerCase()
  const value = Number(deduction.salaryDeductionValue || 0)
  const based = String(deduction.basedOn || "").trim().toLowerCase()
  if (type === "fixed" || based === "n/a" || based === "na") return value
  const base = based === "basic" ? fullMonthBasic : monthlyGross
  return Math.round((base * value) / 100)
}
