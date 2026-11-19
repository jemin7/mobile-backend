"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  CalendarDays,
  CheckCircle,
  Circle,
  Clock3,
  Download,
  Flag,
  Home,
  MapPin,
  Timer,
} from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import {
  groupAttendanceByDay,
  formatPunchTime,
  formatLocationLines,
  extractDayPunchTimes,
  type AttendanceDaySummary,
  type AttendanceLocationRecord,
} from "../../../utils/empAttendanceHistory";
import { cn } from "@/app/utils/cn";
import {
  classifyDay,
  dateKeyFromValue,
  eachDate,
  isWeekendKey,
  punchClockMinutes,
  type PolicyBits,
  type ShiftDay,
} from "@/app/utils/empSelfDayStatus";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type RegularizationRow = {
  attendanceDate?: string;
  status?: string;
  requestedStatus?: string;
};

type AttendanceStatusKind =
  | "present"
  | "absent"
  | "weekend"
  | "partial"
  | "leave"
  | "holiday"
  | "late"
  | "half"
  | "upcoming"
  | "wfh";

type AttendanceStatusMeta = {
  kind: AttendanceStatusKind;
  label: string;
  icon: LucideIcon;
  iconClassName: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

type AttendanceRangePreset = "today" | "last-week" | "month" | "quarter" | "year";

function dateKeyFrom(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function rangeForPreset(preset: AttendanceRangePreset, today: Date) {
  const todayKey = dateKeyFrom(today);
  if (preset === "today") return { from: todayKey, to: todayKey };
  if (preset === "last-week") {
    const day = today.getDay();
    const mondayOffset = day === 0 ? 6 : day - 1;
    const thisMonday = new Date(today);
    thisMonday.setDate(today.getDate() - mondayOffset);
    const lastMonday = new Date(thisMonday);
    lastMonday.setDate(thisMonday.getDate() - 7);
    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastMonday.getDate() + 6);
    return { from: dateKeyFrom(lastMonday), to: dateKeyFrom(lastSunday) };
  }
  if (preset === "month") {
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`, to: dateKeyFrom(last) };
  }
  if (preset === "quarter") {
    const startMonth = Math.floor(today.getMonth() / 3) * 3;
    return { from: `${today.getFullYear()}-${pad2(startMonth + 1)}-01`, to: todayKey };
  }
  return { from: `${today.getFullYear()}-01-01`, to: todayKey };
}

function dateKeysInRange(from: string, to: string) {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const keys: string[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    keys.push(cursor.toISOString().slice(0, 10));
  }
  return keys.reverse();
}

function isCompanyApprovedLeave(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  return value === "approved" || value === "partially approved" || value === "accepted" || value === "revokepending";
}

const ATTENDANCE_PAGE_SIZE = 31;

function AttendancePageBar({
  page,
  pageCount,
  start,
  end,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= ATTENDANCE_PAGE_SIZE) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] px-6 py-3 last:border-b-0 last:border-t">
      <p className="text-[13px] text-[#6B7280]">
        Showing {start}–{end} of {total} days
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 border-[#E5E7EB] bg-white px-3 text-[#111827] shadow-none hover:bg-[#F9FAFB]"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>
        <span className="text-[13px] tabular-nums text-[#6B7280]">
          Page {page} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          className="h-8 border-[#E5E7EB] bg-white px-3 text-[#111827] shadow-none hover:bg-[#F9FAFB]"
          disabled={page >= pageCount}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function csvCell(value: string) {
  const text = value.replace(/"/g, '""');
  return /[",\n]/.test(text) ? `"${text}"` : text;
}

function fullDateLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-");
  return `${d}/${m}/${y.slice(-2)}`;
}

function dayName(dateKey: string) {
  return new Date(dateKey + "T12:00:00Z").toLocaleDateString("en-IN", {
    weekday: "short",
    timeZone: "UTC",
  });
}

function isWeekend(dateKey: string) {
  const dow = new Date(dateKey + "T12:00:00Z").getUTCDay();
  return dow === 0 || dow === 6;
}

function resolveAttendanceStatus(
  day: AttendanceDaySummary | null,
  dateKey: string,
  ctx: {
    todayKey: string;
    leaveDates: Set<string>;
    holidayDates: Set<string>;
    classified?: "present" | "half" | "absent" | "late";
  },
): AttendanceStatusMeta {
  if (isWeekend(dateKey)) {
    return {
      kind: "weekend",
      label: "Weekend",
      icon: CalendarDays,
      iconClassName: "text-[#6B7280]",
    };
  }
  if (ctx.holidayDates.has(dateKey)) {
    return { kind: "holiday", label: "Holiday", icon: Flag, iconClassName: "text-[#0369A1]" };
  }
  if (ctx.leaveDates.has(dateKey)) {
    return { kind: "leave", label: "Leave", icon: Briefcase, iconClassName: "text-[#047857]" };
  }
  if (dateKey > ctx.todayKey) {
    return { kind: "upcoming", label: "—", icon: Circle, iconClassName: "text-[#D1D5DB]" };
  }
  if (ctx.classified === "late") {
    return { kind: "late", label: "Late Mark", icon: Clock3, iconClassName: "text-[#B45309]" };
  }
  if (ctx.classified === "half") {
    return { kind: "half", label: "Half Day", icon: Timer, iconClassName: "text-[#B45309]" };
  }
  if (ctx.classified === "absent" || !day?.checkIn) {
    return {
      kind: "absent",
      label: "Absent",
      icon: Circle,
      iconClassName: "text-[#9CA3AF] fill-[#9CA3AF]",
    };
  }
  if (day.checkIn && day.checkOut && ctx.classified !== "present") {
    return {
      kind: "present",
      label: "Present",
      icon: CheckCircle,
      iconClassName: "text-[#16A34A]",
    };
  }
  if (day.checkIn && !day.checkOut) {
    return {
      kind: "partial",
      label: "Partial",
      icon: Clock3,
      iconClassName: "text-[#9A6700]",
    };
  }
  return {
    kind: "present",
    label: "Present",
    icon: CheckCircle,
    iconClassName: "text-[#16A34A]",
  };
}

function AttendanceStatusCell({ status }: { status: AttendanceStatusMeta }) {
  const Icon = status.icon;
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[#111827]">
      <Icon
        className={cn("size-4 shrink-0", status.iconClassName)}
        strokeWidth={status.kind === "present" ? 1.75 : 2}
        aria-hidden
      />
      <span className="font-normal">{status.label}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group rounded-lg border border-[#E5E7EB] bg-white px-6 py-5 transition-colors hover:border-[#D1D5DB] hover:bg-[#FAFAFA]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[#6B7280]">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-[#111827]">
            {value}
            {suffix ? (
              <span className="ml-1 text-sm font-normal text-[#6B7280]">{suffix}</span>
            ) : null}
          </p>
        </div>
        <Icon className="size-4 shrink-0 text-[#9CA3AF] transition-colors group-hover:text-[#6B7280]" strokeWidth={1.75} />
      </div>
    </div>
  );
}

function PunchTimeline({ records }: { records: AttendanceLocationRecord[] }) {
  const sorted = [...records].sort(
    (a, b) => new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
  const checkIns = sorted.filter((r) => r.checkType === "CHECK_IN");
  const checkOuts = sorted.filter((r) => r.checkType === "CHECK_OUT");

  if (checkIns.length === 0 && checkOuts.length === 0) {
    return <span className="text-sm text-[#9CA3AF]">—</span>;
  }

  const firstCheckIn = checkIns[0];
  const lastCheckOut = checkOuts[checkOuts.length - 1];

  const PunchMarker = ({
    time,
    dotClass,
    edge,
  }: {
    time: string;
    dotClass: string;
    edge: "start" | "end";
  }) => (
    <div
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2",
        edge === "start" ? "left-0" : "right-0",
      )}
    >
      <div className="relative flex flex-col items-center">
        <span className="absolute bottom-full mb-1 whitespace-nowrap text-[11px] font-medium tabular-nums leading-none text-[#6B7280]">
          {time}
        </span>
        <span className={cn("size-2 rounded-full ring-2 ring-white", dotClass)} />
      </div>
    </div>
  );

  return (
    <div className="relative mx-0 h-11 min-w-[200px]">
      <div className="absolute inset-x-0 top-1/2 z-0 h-px -translate-y-1/2 bg-[#E5E7EB]" />
      {firstCheckIn ? (
        <PunchMarker
          time={formatPunchTime(firstCheckIn.checkinTime)}
          dotClass="bg-[#16A34A]"
          edge="start"
        />
      ) : null}
      {lastCheckOut ? (
        <PunchMarker
          time={formatPunchTime(lastCheckOut.checkinTime)}
          dotClass="bg-[#111827]"
          edge="end"
        />
      ) : null}
    </div>
  );
}

async function resolveWorkShiftName(
  emp: Record<string, unknown> | null,
  headers: Record<string, string>,
): Promise<string> {
  if (!emp) return "—";

  const promotion = Array.isArray(emp.empPromotion) ? emp.empPromotion[0] : null;
  const empShift = Array.isArray(emp.empWorkShift) ? emp.empWorkShift[0] : null;

  const direct =
    (empShift as { workShift?: { workShiftName?: string } })?.workShift?.workShiftName ||
    (emp.workShift as { workShiftName?: string } | undefined)?.workShiftName ||
    (promotion as { workShift?: { workShiftName?: string } })?.workShift?.workShiftName;

  if (direct) return direct;

  const workShiftID =
    (empShift as { workShiftID?: number; workShift?: { id?: number } })?.workShiftID ??
    (empShift as { workShift?: { id?: number } })?.workShift?.id ??
    (emp.workShiftID as number | undefined) ??
    (promotion as { workShiftID?: number })?.workShiftID;

  if (workShiftID) {
    try {
      const wsRes = await fetch(`${BACKEND}/work-shift/${workShiftID}`, { headers, cache: "no-store" });
      if (wsRes.ok) {
        const ws = await wsRes.json();
        if (ws?.workShiftName) return ws.workShiftName;
      }
    } catch {
      /* ignore */
    }
  }

  return "—";
}

function PunchLocationBlock({
  label,
  punch,
}: {
  label: string;
  punch: AttendanceLocationRecord | null;
}) {
  const { address, coordinates } = formatLocationLines(punch);
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-[#111827]">
        {punch ? formatPunchTime(punch.checkinTime) : "—"}
      </p>
      <div className="mt-3 flex items-start gap-2 text-sm text-[#374151]">
        <MapPin className="mt-0.5 size-4 shrink-0 text-[#9CA3AF]" strokeWidth={1.75} />
        <div className="min-w-0">
          <p>{address || "Location not recorded"}</p>
          {coordinates ? (
            <p className="mt-1 font-mono text-xs text-[#6B7280]">{coordinates}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function EmpProfileAttendanceView({ employeeId: viewEmployeeId }: { employeeId?: number } = {}) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  const [rangePreset, setRangePreset] = useState<AttendanceRangePreset | "">("month");
  const [fromDate, setFromDate] = useState(
    `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`,
  );
  const [toDate, setToDate] = useState(dateKeyFrom(new Date(today.getFullYear(), today.getMonth() + 1, 0)));

  const applyRangePreset = (preset: AttendanceRangePreset) => {
    const range = rangeForPreset(preset, new Date());
    setRangePreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  };
  const [loading, setLoading] = useState(true);
  const [dayMap, setDayMap] = useState<Map<string, AttendanceDaySummary>>(new Map());
  const [regularizedDates, setRegularizedDates] = useState<Set<string>>(new Set());
  const [leaveDates, setLeaveDates] = useState<Set<string>>(new Set());
  const [holidayDates, setHolidayDates] = useState<Set<string>>(new Set());
  const [policy, setPolicy] = useState<PolicyBits | null>(null);
  const [shiftDays, setShiftDays] = useState<ShiftDay[]>([]);
  const [flexibleShift, setFlexibleShift] = useState(false);
  const [maxHours, setMaxHours] = useState(0);
  const [workShiftName, setWorkShiftName] = useState<string>("—");
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadRange = useCallback(async (from: string, to: string) => {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
        : "";
    if (!token || !from || !to || from > to) return;
    setLoading(true);
    const headers = { Authorization: `Bearer ${token}` };

    try {
      let empId = viewEmployeeId ?? employeeId;
      if (!empId) {
        const userRaw = localStorage.getItem("user");
        if (userRaw) {
          const user = JSON.parse(userRaw);
          empId = user?.employee?.id ?? null;
          if (empId) setEmployeeId(empId);
        }
      } else {
        setEmployeeId(empId);
      }

      const attUrl = viewEmployeeId
        ? `${BACKEND}/emp-manager-scope/member/${viewEmployeeId}/attendance-history?from=${from}&to=${to}`
        : `${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`;

      const [attRes, regRes, empRes, leaveRes, holidayRes, policyRes] = await Promise.all([
        fetch(attUrl, { headers, cache: "no-store" }),
        fetch(`${BACKEND}/emp-attendance-regularise`, { headers, cache: "no-store" }),
        empId
          ? fetch(`${BACKEND}/manage-emp/${empId}`, { headers, cache: "no-store" })
          : Promise.resolve(null),
        empId
          ? fetch(`${BACKEND}/leave-application/employee/${empId}`, { headers, cache: "no-store" })
          : Promise.resolve(null),
        fetch(`${BACKEND}/public-holiday`, { headers, cache: "no-store" }),
        fetch(`${BACKEND}/attendance-policy`, { headers, cache: "no-store" }),
      ]);

      if (attRes.ok) {
        const data = await attRes.json();
        let records: AttendanceLocationRecord[] = [];
        if (Array.isArray(data)) {
          records = data;
        } else if (Array.isArray(data?.records)) {
          records = data.records;
        }
        const grouped = groupAttendanceByDay(records);
        setDayMap(new Map(grouped.map((d) => [d.dateKey, d])));
      } else {
        setDayMap(new Map());
      }

      if (regRes.ok) {
        const regs: RegularizationRow[] = await regRes.json();
        const approved = new Set<string>();
        (Array.isArray(regs) ? regs : []).forEach((r) => {
          if (!r.attendanceDate || !empId) return;
          if (Number((r as { manageEmployeeID?: number }).manageEmployeeID) !== Number(empId)) return;
          const status = String(r.status || "").toLowerCase();
          if (status === "approved" || status === "regularized") {
            approved.add(r.attendanceDate.slice(0, 10));
          }
        });
        setRegularizedDates(approved);
      } else {
        setRegularizedDates(new Set());
      }

      let companyId = 0;
      let branchId = 0;
      let nextPolicy: PolicyBits | null = null;
      let nextShiftDays: ShiftDay[] = [];
      let nextFlexible = false;
      let nextMaxHours = 0;
      if (empRes && "ok" in empRes && empRes.ok) {
        const emp = await empRes.json();
        companyId = Number(emp?.companyID || 0);
        branchId = Number(emp?.branchesID || 0);
        nextMaxHours = Number(emp?.maxHoursPerDay) || 0;
        setWorkShiftName(await resolveWorkShiftName(emp, headers));
        const shiftEntry = Array.isArray(emp?.empWorkShift) ? emp.empWorkShift[0] : null;
        const workShiftId = Number(shiftEntry?.workShiftID || emp?.workShiftID || 0);
        if (workShiftId) {
          const shiftRes = await fetch(`${BACKEND}/work-shift/${workShiftId}`, { headers, cache: "no-store" });
          if (shiftRes.ok) {
            const shift = await shiftRes.json();
            if (shift?.isFlexible) nextFlexible = true;
            nextShiftDays = Array.isArray(shift?.workShiftDay) ? shift.workShiftDay : [];
          }
        }
      }
      const policies = policyRes.ok ? await policyRes.json() : [];
      nextPolicy = (Array.isArray(policies) ? policies : []).find(
        (row: PolicyBits & { companyID?: number; branchesID?: number }) =>
          Number(row.companyID) === companyId && Number(row.branchesID) === branchId,
      ) || null;
      if (String(nextPolicy?.workingHoursType || "").toLowerCase().includes("flex")) nextFlexible = true;
      const holidays = new Set<string>();
      const holidayRows = holidayRes.ok ? await holidayRes.json() : [];
      for (const row of Array.isArray(holidayRows) ? holidayRows : []) {
        if (companyId && Number(row.companyID) !== companyId) continue;
        if (row.branchesID != null && String(row.branchesID) !== "" && Number(row.branchesID) !== branchId) continue;
        const start = dateKeyFromValue(row.startDate);
        const end = dateKeyFromValue(row.endDate) || start;
        if (!start) continue;
        for (const key of eachDate(start, end)) {
          if (key >= from && key <= to && !isWeekendKey(key)) holidays.add(key);
        }
      }
      const leaves = new Set<string>();
      const leaveRows = leaveRes && "ok" in leaveRes && leaveRes.ok ? await leaveRes.json() : [];
      for (const row of Array.isArray(leaveRows) ? leaveRows : []) {
        const owner = Number(row.manageEmployeeID || row.manageEmployee?.id || 0);
        if (!empId || !owner || owner !== Number(empId)) continue;
        if (!isCompanyApprovedLeave(row.status)) continue;
        const start = dateKeyFromValue(row.fromDate);
        const end = dateKeyFromValue(row.toDate) || start;
        if (!start) continue;
        for (const key of eachDate(start, end)) {
          if (key >= from && key <= to && !isWeekendKey(key) && !holidays.has(key)) leaves.add(key);
        }
      }
      setHolidayDates(holidays);
      setLeaveDates(leaves);
      setPolicy(nextPolicy);
      setShiftDays(nextShiftDays);
      setFlexibleShift(nextFlexible);
      setMaxHours(nextMaxHours);
    } catch {
      setDayMap(new Map());
      setRegularizedDates(new Set());
      setLeaveDates(new Set());
      setHolidayDates(new Set());
    } finally {
      setLoading(false);
    }
  }, [employeeId, viewEmployeeId]);

  useEffect(() => {
    void loadRange(fromDate, toDate);
  }, [fromDate, toDate, loadRange]);

  const monthRows = useMemo(() => {
    return dateKeysInRange(fromDate, toDate).map((dateKey) => ({
      dateKey,
      day: dayMap.get(dateKey) ?? null,
    }));
  }, [fromDate, toDate, dayMap]);

  const pageCount = Math.max(1, Math.ceil(monthRows.length / ATTENDANCE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageStart = (safePage - 1) * ATTENDANCE_PAGE_SIZE;
  const pageRows = monthRows.slice(pageStart, pageStart + ATTENDANCE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate]);

  const selectedDay = selectedDateKey ? dayMap.get(selectedDateKey) ?? null : null;
  const selectedPunches = selectedDay?.records?.length
    ? extractDayPunchTimes(selectedDay.records)
    : null;

  const classifiedByDate = useMemo(() => {
    const map = new Map<string, "present" | "half" | "absent" | "late">();
    const noCheckout = new Map<string, number>();
    const lateMarks = new Map<string, number>();
    const keys = monthRows.map((row) => row.dateKey).sort();
    for (const dateKey of keys) {
      if (dateKey > todayKey || isWeekend(dateKey) || holidayDates.has(dateKey) || leaveDates.has(dateKey)) continue;
      const day = dayMap.get(dateKey);
      const punches = (day?.records || [])
        .map((record) => punchClockMinutes(record.checkinTime))
        .filter((value): value is number => value != null);
      map.set(dateKey, classifyDay({
        punches,
        dateKey,
        today: todayKey,
        shiftDays,
        policy,
        flexible: flexibleShift,
        maxHours,
        noCheckout,
        lateMarks,
      }));
    }
    return map;
  }, [monthRows, dayMap, todayKey, holidayDates, leaveDates, shiftDays, policy, flexibleShift, maxHours]);

  const statusFor = (dateKey: string, day: AttendanceDaySummary | null) =>
    resolveAttendanceStatus(day, dateKey, {
      todayKey,
      leaveDates,
      holidayDates,
      classified: classifiedByDate.get(dateKey),
    });

  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let weekend = 0;
    let partial = 0;
    let leave = 0;
    let holiday = 0;
    let late = 0;
    let half = 0;
    let totalHours = 0;

    monthRows.forEach(({ dateKey, day }) => {
      const status = statusFor(dateKey, day);
      if (status.kind === "weekend") weekend++;
      else if (status.kind === "present") {
        present++;
        totalHours += day?.workSeconds ?? 0;
      } else if (status.kind === "partial") {
        partial++;
        totalHours += day?.workSeconds ?? 0;
      } else if (status.kind === "absent") absent++;
      else if (status.kind === "leave") leave++;
      else if (status.kind === "holiday") holiday++;
      else if (status.kind === "late") {
        late++;
        totalHours += day?.workSeconds ?? 0;
      } else if (status.kind === "half") {
        half++;
        totalHours += day?.workSeconds ?? 0;
      }
    });

    const workingDays = monthRows.filter(({ dateKey }) => !isWeekend(dateKey)).length;
    const hours = Math.floor(totalHours / 3600);
    const mins = Math.floor((totalHours % 3600) / 60);

    return {
      present,
      absent,
      weekend,
      partial,
      leave,
      holiday,
      late,
      half,
      workingDays,
      hoursLabel: `${hours}h ${mins}m`,
    };
  }, [monthRows, classifiedByDate, leaveDates, holidayDates, todayKey]);

  const downloadCsv = () => {
    const header = ["Date", "Day", "In", "Out", "Hours", "Work shift", "Regularize", "Status"];
    const lines = [header.join(",")];
    for (const { dateKey, day } of monthRows) {
      const status = statusFor(dateKey, day);
      const punches = day?.records?.length ? extractDayPunchTimes(day.records) : null;
      const inn = punches?.checkIn ? formatPunchTime(punches.checkIn.checkinTime) : "";
      const out = punches?.checkOut ? formatPunchTime(punches.checkOut.checkinTime) : "";
      lines.push(
        [
          dateKey,
          dayName(dateKey),
          inn,
          out,
          day?.workLabel && day.workLabel !== "—" ? day.workLabel : "",
          workShiftName === "—" ? "" : workShiftName,
          regularizedDates.has(dateKey) ? "Regularized" : "",
          status.label,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-${fromDate}-to-${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const daySuffix = (value: number) => (value === 1 ? "Day" : "Days");
  const statCards = [
    { label: "Present", value: summary.present, suffix: daySuffix(summary.present), icon: CheckCircle },
    { label: "Late Mark", value: summary.late, suffix: daySuffix(summary.late), icon: Clock3 },
    { label: "Half Day", value: summary.half, suffix: daySuffix(summary.half), icon: Timer },
    { label: "Absent", value: summary.absent, suffix: daySuffix(summary.absent), icon: Circle },
    { label: "Leave", value: summary.leave, suffix: daySuffix(summary.leave), icon: Briefcase },
    { label: "Holiday", value: summary.holiday, suffix: daySuffix(summary.holiday), icon: Flag },
    { label: "Weekend", value: summary.weekend, suffix: daySuffix(summary.weekend), icon: CalendarDays },
    { label: "Partial", value: summary.partial, suffix: daySuffix(summary.partial), icon: Clock3 },
    { label: "Total working days", value: summary.workingDays, suffix: "", icon: Timer },
  ];

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-[#111827]">Attendance</h3>
            <p className="mt-0.5 text-[13px] text-[#6B7280]">{summary.hoursLabel} logged in this range</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[13px] font-medium text-[#6B7280]">
              Period
              <select
                value={rangePreset}
                onChange={(e) => {
                  const next = e.target.value as AttendanceRangePreset | "";
                  if (!next) return;
                  applyRangePreset(next);
                }}
                className="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              >
                <option value="">Custom</option>
                <option value="today">Today</option>
                <option value="last-week">Last week</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="year">Year</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-[#6B7280]">
              From
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setRangePreset("");
                  setFromDate(next);
                  if (next > toDate) setToDate(next > todayKey ? todayKey : next);
                }}
                className="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-medium text-[#6B7280]">
              To
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={`${today.getFullYear()}-12-31`}
                onChange={(e) => {
                  const next = e.target.value;
                  if (!next) return;
                  setRangePreset("");
                  const yearEnd = `${today.getFullYear()}-12-31`;
                  const capped = next > yearEnd ? yearEnd : next;
                  setToDate(capped);
                  if (capped < fromDate) setFromDate(capped);
                }}
                className="h-9 rounded-md border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827]"
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="h-9 border-[#E5E7EB] bg-white text-[#111827] shadow-none hover:bg-[#F9FAFB]"
              onClick={downloadCsv}
              disabled={loading || monthRows.length === 0}
            >
              <Download className="size-4" strokeWidth={1.75} />
              Download
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
        {loading ? (
          <div className="py-20 text-center text-sm text-[#6B7280]">Loading attendance…</div>
        ) : (
          <>
            <AttendancePageBar
              page={safePage}
              pageCount={pageCount}
              start={monthRows.length === 0 ? 0 : pageStart + 1}
              end={Math.min(pageStart + ATTENDANCE_PAGE_SIZE, monthRows.length)}
              total={monthRows.length}
              onPage={setPage}
            />
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    {["Date", "Day", "In / Out", "Hours", "Work shift", "Regularize", "Status"].map((header) => (
                      <th
                        key={header}
                        className={cn(
                          "px-6 py-3 text-left text-sm font-medium text-[#6B7280]",
                          header === "In / Out" && "min-w-[220px]",
                          header === "Date" && "w-[108px]",
                          header === "Day" && "w-[72px]",
                          header === "Hours" && "w-[96px]",
                          header === "Work shift" && "w-[120px]",
                          header === "Regularize" && "w-[112px]",
                          header === "Status" && "w-[128px]",
                        )}
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(({ dateKey, day }) => {
                    const status = statusFor(dateKey, day);
                    const isRegularized = regularizedDates.has(dateKey);
                    return (
                      <tr
                        key={dateKey}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDateKey(dateKey)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDateKey(dateKey);
                          }
                        }}
                        className={cn(
                          "border-b border-[#F3F4F6] last:border-0 transition-colors hover:bg-[#FAFAFA] cursor-pointer",
                          dateKey === todayKey && "bg-[#FAFAFA]/80",
                        )}
                      >
                        <td className="px-6 py-4 text-sm font-medium tabular-nums text-[#111827]">
                          {fullDateLabel(dateKey)}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">{dayName(dateKey)}</td>
                        <td className="px-6 py-4">
                          {day?.records?.length ? (
                            <PunchTimeline records={day.records} />
                          ) : (
                            <span className="text-sm text-[#9CA3AF]">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm tabular-nums text-[#111827]">
                          {day?.workLabel ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">{workShiftName}</td>
                        <td className="px-6 py-4 text-sm text-[#6B7280]">
                          {isRegularized ? (
                            <span className="inline-flex items-center gap-1.5 text-[#111827]">
                              <CheckCircle className="size-3.5 text-[#6B7280]" strokeWidth={1.75} />
                              Regularized
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <AttendanceStatusCell status={status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-[#F3F4F6] lg:hidden">
              {pageRows.map(({ dateKey, day }) => {
                const status = statusFor(dateKey, day);
                const isRegularized = regularizedDates.has(dateKey);
                return (
                  <div
                    key={dateKey}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDateKey(dateKey)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedDateKey(dateKey);
                      }
                    }}
                    className="px-6 py-5 transition-colors hover:bg-[#FAFAFA] cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums text-[#111827]">
                          {fullDateLabel(dateKey)}
                          <span className="ml-2 font-normal text-[#6B7280]">{dayName(dateKey)}</span>
                        </p>
                        <p className="mt-1 text-[13px] text-[#6B7280]">
                          {day?.workLabel ?? "—"} · {workShiftName}
                          {isRegularized ? " · Regularized" : ""}
                        </p>
                      </div>
                      <AttendanceStatusCell status={status} />
                    </div>
                    {day?.records?.length ? (
                      <div className="mt-4">
                        <PunchTimeline records={day.records} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <AttendancePageBar
              page={safePage}
              pageCount={pageCount}
              start={monthRows.length === 0 ? 0 : pageStart + 1}
              end={Math.min(pageStart + ATTENDANCE_PAGE_SIZE, monthRows.length)}
              total={monthRows.length}
              onPage={setPage}
            />
          </>
        )}
      </div>

      <Dialog open={!!selectedDateKey} onOpenChange={(open) => { if (!open) setSelectedDateKey(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedDateKey
                ? `${fullDateLabel(selectedDateKey)} · ${dayName(selectedDateKey)}`
                : "Attendance"}
            </DialogTitle>
          </DialogHeader>
          {selectedPunches?.checkIn || selectedPunches?.checkOut ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <PunchLocationBlock label="Check-in" punch={selectedPunches.checkIn} />
              <PunchLocationBlock label="Check-out" punch={selectedPunches.checkOut} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No check-in or check-out recorded for this date.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Reserved status variants for future leave / holiday / WFH integration
export const ATTENDANCE_STATUS_PRESETS: Record<
  Extract<AttendanceStatusKind, "leave" | "holiday" | "wfh">,
  AttendanceStatusMeta
> = {
  leave: { kind: "leave", label: "Leave", icon: Briefcase, iconClassName: "text-[#6B7280]" },
  holiday: { kind: "holiday", label: "Holiday", icon: Flag, iconClassName: "text-[#6B7280]" },
  wfh: { kind: "wfh", label: "Work From Home", icon: Home, iconClassName: "text-[#6B7280]" },
};
