import type { LeaveApprovalBalance } from "../api/approvals";

export type LeaveDayStatus = {
  date: string;
  status:
    | "Sick"
    | "Casual"
    | "Privileged"
    | "ShortLeave"
    | "CompOff"
    | "LoP"
    | "MtL"
    | "PtL"
    | "";
  dayType?: "Full" | "Present" | "LateMark" | "Halfday" | "Absent";
};

export type LeaveApprovalType = LeaveDayStatus["status"];

const BALANCE_KEYS: Partial<
  Record<Exclude<LeaveApprovalType, "">, keyof LeaveApprovalBalance>
> = {
  Sick: "sick",
  Casual: "casual",
  Privileged: "privileged",
  CompOff: "compOff",
  MtL: "maternity",
  PtL: "paternity",
};

export function buildLeaveDays(fromDate: string, toDate: string) {
  const [fy, fm, fd] = fromDate.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = toDate.slice(0, 10).split("-").map(Number);

  const current = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const days: LeaveDayStatus[] = [];

  while (current <= end) {
    const date = [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, "0"),
      String(current.getDate()).padStart(2, "0"),
    ].join("-");

    days.push({ date, status: "" });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function restoreLeaveDays(
  fromDate: string,
  toDate: string,
  rawDayStatuses: unknown,
): LeaveDayStatus[] {
  let rows = rawDayStatuses;

  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      throw new Error("Saved leave assignments could not be read.");
    }
  }

  if (!Array.isArray(rows)) {
    throw new Error("Saved leave assignments are invalid.");
  }

  const allowedStatuses = new Set([
    "",
    "Sick",
    "Casual",
    "Privileged",
    "ShortLeave",
    "CompOff",
    "LoP",
    "MtL",
    "PtL",
  ]);

  const allowedDayTypes = new Set([
    "Full",
    "Present",
    "LateMark",
    "Halfday",
    "Absent",
  ]);

  const saved = new Map<string, LeaveDayStatus>();

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;

    const date = String(row.date ?? "").slice(0, 10);
    const status = String(row.status ?? "");

    if (!allowedStatuses.has(status)) {
      throw new Error("Saved leave assignments contain an invalid leave type.");
    }

    const dayType = row.dayType ? String(row.dayType) : undefined;

    if (dayType && !allowedDayTypes.has(dayType)) {
      throw new Error("Saved leave assignments contain an invalid day type.");
    }

    saved.set(date, {
      date,
      status: status as LeaveDayStatus["status"],
      ...(dayType ? { dayType: dayType as LeaveDayStatus["dayType"] } : {}),
    });
  }

  const days = buildLeaveDays(fromDate, toDate);

  return days.map((day) => saved.get(day.date) ?? day);
}

export function restoreExistingLeaveDaysToBalance(
  balance: LeaveApprovalBalance,
  days: LeaveDayStatus[],
): LeaveApprovalBalance {
  const counts = {
    sick: 0,
    casual: 0,
    privileged: 0,
    compOff: 0,
    maternity: 0,
    paternity: 0,
  };

  for (const day of days) {
    switch (day.status) {
      case "Sick":
        counts.sick++;
        break;
      case "Casual":
        counts.casual++;
        break;
      case "Privileged":
        counts.privileged++;
        break;
      case "CompOff":
        counts.compOff++;
        break;
      case "MtL":
        counts.maternity++;
        break;
      case "PtL":
        counts.paternity++;
        break;
    }
  }

  const restore = (
    entry: LeaveApprovalBalance[keyof LeaveApprovalBalance],
    count: number,
  ) => ({
    ...entry,
    total: entry.total + count,
    remaining: entry.remaining + count,
  });

  return {
    sick: restore(balance.sick, counts.sick),
    casual: restore(balance.casual, counts.casual),
    privileged: restore(balance.privileged, counts.privileged),
    compOff: restore(balance.compOff, counts.compOff),
    maternity: restore(balance.maternity, counts.maternity),
    paternity: restore(balance.paternity, counts.paternity),
  };
}

export function getAvailableLeaveTypes(
  balance: LeaveApprovalBalance,
  gender: string | null,
): Exclude<LeaveApprovalType, "">[] {
  const types: Exclude<LeaveApprovalType, "">[] = [];

  if (balance.sick.remaining > 0) types.push("Sick");
  if (balance.casual.remaining > 0) types.push("Casual");
  if (balance.privileged.remaining > 0) types.push("Privileged");

  types.push("ShortLeave", "LoP");

  if (balance.compOff.remaining > 0) types.push("CompOff");

  if (
    balance.maternity.remaining > 0 &&
    (gender === "Female" || gender === "Others")
  ) {
    types.push("MtL");
  }

  if (
    balance.paternity.remaining > 0 &&
    (gender === "Male" || gender === "Others")
  ) {
    types.push("PtL");
  }

  return types;
}

export function toggleLeaveDay(
  days: LeaveDayStatus[],
  date: string,
  type: Exclude<LeaveApprovalType, "">,
  balance: LeaveApprovalBalance,
  dayType?: LeaveDayStatus["dayType"],
): { days: LeaveDayStatus[]; exceeded: boolean } {
  const selectedDay = days.find((day) => day.date === date);

  if (!selectedDay) return { days, exceeded: false };

  if (selectedDay.status === type) {
    if (type === "ShortLeave" && dayType && selectedDay.dayType !== dayType) {
      return {
        days: days.map((day) =>
          day.date === date ? { ...day, dayType } : day,
        ),
        exceeded: false,
      };
    }

    return {
      days: days.map((day) =>
        day.date === date ? { ...day, status: "", dayType: undefined } : day,
      ),
      exceeded: false,
    };
  }

  const balanceKey = BALANCE_KEYS[type];

  if (balanceKey) {
    const assigned = days.filter((day) => day.status === type).length;

    if (assigned >= balance[balanceKey].remaining) {
      return { days, exceeded: true };
    }
  }

  return {
    days: days.map((day) =>
      day.date === date
        ? {
            ...day,
            status: type,
            dayType: type === "ShortLeave" ? dayType : undefined,
          }
        : day,
    ),
    exceeded: false,
  };
}

export type LeaveApprovalPayload = {
  status: "Approved" | "Partially Approved";
  appliedLeaveType: string;
  dayStatuses: LeaveDayStatus[];
  remainingSickLeave: number;
  remainingCasualLeave: number;
};

export function buildLeaveApprovalPayload(
  days: LeaveDayStatus[],
  balance: LeaveApprovalBalance,
): LeaveApprovalPayload {
  const assigned = days.filter((day) => day.status);
  const unassignedCount = days.length - assigned.length;

  const counts: Record<string, number> = {};

  assigned.forEach((day) => {
    if (day.status !== "LoP" && day.status !== "ShortLeave") {
      counts[day.status] = (counts[day.status] || 0) + 1;
    }
  });

  const mainLeaveType =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "LoP";

  return {
    status: unassignedCount > 0 ? "Partially Approved" : "Approved",
    appliedLeaveType: mainLeaveType,
    dayStatuses: days,
    remainingSickLeave: Math.max(
      balance.sick.remaining - (counts.Sick || 0),
      0,
    ),
    remainingCasualLeave: Math.max(
      balance.casual.remaining - (counts.Casual || 0),
      0,
    ),
  };
}
