import { todayPunchDateKey } from "@/app/utils/attendanceDuration";

export function dateKeyFromValue(value: unknown): string {
  if (!value) return "";
  const text = String(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return todayPunchDateKey(parsed);
}

export function isWeekendKey(key: string) {
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function eachDate(from: string, to: string) {
  const dates: string[] = [];
  const cursor = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function monthBounds() {
  const today = todayPunchDateKey();
  const [year, month] = today.split("-");
  const last = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(last).padStart(2, "0")}`,
    today,
  };
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clockToMinutes(value: string) {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour)) return null;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
}

export function punchClockMinutes(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export type ShiftDay = {
  weekDay?: string;
  shiftType?: string;
  weeklyOff?: boolean;
  startTime?: string;
  endTime?: string;
  breakStart?: string;
  breakEnd?: string;
  totalMinutes?: number;
};

export type PolicyBits = {
  workingHoursType?: string;
  markAs?: string;
  lateMarkCount?: string | number;
  lateMarkMarkAs?: string;
  lateMarkMarkCount?: string | number;
  checkin_grace_time_min?: number;
  max_late_check_in_time?: number;
  maxLateCheckinMarkAs?: string;
  min_work_hours_half_day_min?: number;
  earlyCheckoutBeforeEndMin?: number;
  checkin_begin_before_min?: number;
  overtimeApplicable?: boolean;
  checkout_end_after_min?: number;
  trimPreshiftMin?: number;
  trimPostshiftMin?: number;
};

export type DayKind = "present" | "half" | "absent" | "late";

function shiftForDay(dateKey: string, shiftDays: ShiftDay[]) {
  const dayName = WEEKDAY_NAMES[new Date(`${dateKey}T12:00:00Z`).getUTCDay()];
  return shiftDays.find((day) => day.weekDay === dayName && day.shiftType === "WORK" && !day.weeklyOff) || null;
}

function collapseMinutes(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const kept: number[] = [];
  for (const value of sorted) {
    if (!kept.length || value - kept[kept.length - 1] >= 10) kept.push(value);
  }
  return kept;
}

function ruleCount(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bumpTracker(tracker: Map<string, number>, key: string, allowed: number) {
  if (allowed <= 0) return false;
  const next = (tracker.get(key) || 0) + 1;
  if (next >= allowed) {
    tracker.set(key, 0);
    return true;
  }
  tracker.set(key, next);
  return false;
}

function kolkataNowMinutes() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value || 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value || 0);
  return hour * 60 + minute;
}

function shiftStillOpen(first: number, shift: ShiftDay | null, policy: PolicyBits | null, maxHours: number) {
  let windowEnd = 0;
  const start = shift?.startTime ? clockToMinutes(shift.startTime) : null;
  const end = shift?.endTime ? clockToMinutes(shift.endTime) : null;
  if (start != null && end != null) {
    const buffer = Number(policy?.checkout_end_after_min) || 0;
    windowEnd = (end < start ? end + 1440 : end) + buffer;
  }
  if (maxHours > 0) windowEnd = Math.max(windowEnd, first + maxHours * 60);
  if (windowEnd === 0) windowEnd = first + (maxHours > 0 ? maxHours * 60 : 600);
  const now = kolkataNowMinutes();
  return (now < first ? now + 1440 : now) <= windowEnd;
}

function workedMinutes(punches: number[], shift: ShiftDay | null, policy: PolicyBits | null, flexible: boolean) {
  if (punches.length < 2) return 0;
  let startMin = punches[0];
  let endMin = punches[punches.length - 1];
  if (!flexible && policy && shift) {
    const shiftStart = shift.startTime ? clockToMinutes(shift.startTime) : null;
    const shiftEnd = shift.endTime ? clockToMinutes(shift.endTime) : null;
    if (shiftStart != null && startMin < shiftStart - (Number(policy.checkin_begin_before_min) || 0)) startMin = shiftStart;
    if (!policy.overtimeApplicable && shiftEnd != null) {
      const maxEnd = shiftEnd + (Number(policy.checkout_end_after_min) || 0);
      if (endMin > maxEnd) endMin = shiftEnd;
    }
  }
  let worked = endMin - startMin;
  if (worked < 0) worked += 24 * 60;
  if (shift?.breakStart && shift?.breakEnd) {
    const breakStart = clockToMinutes(shift.breakStart);
    const breakEnd = clockToMinutes(shift.breakEnd);
    if (breakStart != null && breakEnd != null && breakStart > 0 && breakEnd > 0 && startMin <= breakStart && endMin >= breakEnd) {
      worked -= breakEnd - breakStart;
    }
  }
  if (!flexible && policy) {
    worked -= Number(policy.trimPreshiftMin) || 0;
    worked -= Number(policy.trimPostshiftMin) || 0;
  }
  return Math.max(0, worked);
}

export function classifyDay(input: {
  punches: number[];
  dateKey: string;
  today: string;
  shiftDays: ShiftDay[];
  policy: PolicyBits | null;
  flexible: boolean;
  maxHours: number;
  noCheckout: Map<string, number>;
  lateMarks: Map<string, number>;
}): DayKind {
  const punches = collapseMinutes(input.punches);
  const shift = shiftForDay(input.dateKey, input.shiftDays);
  const policy = input.policy;
  const monthKey = input.dateKey.slice(0, 7);
  if (!punches.length) return "absent";
  if (punches.length === 1) {
    if (input.dateKey === input.today && shiftStillOpen(punches[0], shift, policy, input.maxHours)) return "present";
    if (!policy || !shift) return "present";
    if (bumpTracker(input.noCheckout, monthKey, ruleCount(policy.lateMarkCount, 3))) {
      return policy.markAs === "Absent" ? "absent" : "half";
    }
    return "present";
  }
  if (!shift || !policy) {
    if (policy && !shift) {
      const worked = Math.max(0, punches[punches.length - 1] - punches[0]);
      const halfMin = Number(policy.min_work_hours_half_day_min) || 0;
      if (halfMin > 0 && worked <= halfMin) return "half";
    }
    return "present";
  }
  const first = punches[0];
  const shiftStart = shift.startTime ? clockToMinutes(shift.startTime) : null;
  if (shiftStart == null) return "present";
  const grace = Number(policy.checkin_grace_time_min) || 0;
  const lateWindow = Number(policy.max_late_check_in_time) || 0;
  const graceEnd = shiftStart + grace;
  const worked = workedMinutes(punches, shift, policy, input.flexible);
  const halfMin = Number(policy.min_work_hours_half_day_min) || 0;
  if (halfMin > 0 && worked <= halfMin) return "half";
  if (input.flexible) return "present";
  if (first > graceEnd + lateWindow) {
    return (policy.maxLateCheckinMarkAs || "Absent") === "Absent" ? "absent" : "half";
  }
  if (first > graceEnd && first <= graceEnd + lateWindow) {
    const markAs = policy.lateMarkMarkAs || policy.markAs || "Half Day";
    if (bumpTracker(input.lateMarks, monthKey, ruleCount(policy.lateMarkMarkCount, 3))) {
      return markAs === "Absent" ? "absent" : "half";
    }
    return "late";
  }
  return "present";
}

