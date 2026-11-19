"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { authHeaders } from "@/lib/auth";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  FileText,
  ListTodo,
  LogIn,
  MapPin,
  Megaphone,
  Palmtree,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { useEmpLeaveBalance } from "@/app/hooks/useEmpLeaveBalance";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import type { TodayStatus } from "@/app/hooks/useEmpPunch";
import { useEmpPunch } from "@/app/hooks/useEmpPunch";
import { EmpPhotoPunchCapture, type EmpPhotoPunchCaptureHandle } from "@/app/components/emp/EmpPhotoPunchCapture";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { taskFetch } from "@/app/utils/taskApi";
import { isWorkingActiveAssignedTask } from "@/app/utils/taskAssignmentRequest";
import { groupAttendanceByDay, type AttendanceLocationRecord } from "@/app/utils/empAttendanceHistory";
import {
  classifyDay,
  dateKeyFromValue,
  eachDate,
  isWeekendKey,
  monthBounds,
  punchClockMinutes,
  type PolicyBits,
  type ShiftDay,
} from "@/app/utils/empSelfDayStatus";
import { canViewProductModule, useProductAccess } from "@/lib/productAccess";
import { HeroBackground } from "@/app/components/emp/desktop/HeroBackground";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type EmployeeHomeProps = {
  empFullName?: string;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
};

type TaskRow = {
  id?: number | string;
  taskName?: string;
  priority?: string;
  dueAt?: string | null;
  dueDateTime?: string | null;
  status: string;
  engineerAssignments?: { manageEmployeeID?: number | null; status?: string | null }[];
};

type MemoRow = {
  subject?: string | null;
  title?: string | null;
  description?: string | null;
  createdAt?: string | null;
  employeeID?: number | null;
};

function asList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const row = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(row.data)) return row.data as Record<string, unknown>[];
    if (Array.isArray(row.items)) return row.items as Record<string, unknown>[];
  }
  return [];
}

function isPendingStatus(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return false;
  if (/(approv|reject|cancel|declin|withdraw)/.test(value)) return false;
  return /(pend|submit|open|new)/.test(value);
}

function isCompanyApprovedLeave(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  return value === "approved" || value === "partially approved" || value === "accepted" || value === "revokepending";
}

function dueLabel(iso?: string | null) {
  if (!iso) return "No due date";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "No due date";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate();
  if (same(due, today)) return "Today";
  if (same(due, tomorrow)) return "Tomorrow";
  if (due.getTime() < today.getTime()) return "Overdue";
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function isDashboardNotice(row: MemoRow) {
  const subject = `${row.subject || ""} ${row.title || ""}`;
  const description = row.description || "";
  if (/IM_COMPANY::|IM_PRIVATE::|IM_GROUP::/.test(subject)) return false;
  if (/^(Leave |Reimbursement |Loan advance |Payroll generated:|Salary paid:)/i.test(description.trim())) return false;
  return true;
}

function memoDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium leading-none text-[#3b6fd8] hover:text-[#2f5ec0]">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

function CardHeader({
  icon,
  title,
  aside,
  href,
  action = "View Details",
}: {
  icon: ReactNode;
  title: string;
  aside?: ReactNode;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-5 shrink-0 place-items-center text-[#64748b]">{icon}</span>
        <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">{title}</h2>
        {aside}
      </div>
      {href ? <CardLink href={href}>{action}</CardLink> : null}
    </div>
  );
}

function StatusDonut({
  slices,
}: {
  slices: { name: string; value: number; fill: string }[];
}) {
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const data = total > 0 ? slices.filter((item) => item.value > 0) : [{ name: "None", value: 1, fill: "#E2E8F0" }];
  return (
    <div className="flex min-h-0 flex-1 items-center gap-4">
      <div className="relative h-[140px] w-[140px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={62} paddingAngle={2} strokeWidth={0}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-bold leading-none text-slate-900">{total}</span>
          <span className="mt-1 text-[11px] text-slate-500">Total</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {slices.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-2 text-slate-500">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />
              <span className="truncate">{item.name}</span>
            </span>
            <span className="font-bold tabular-nums text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-full min-h-[220px] flex-col overflow-hidden rounded-sm border border-[#e7edf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] ${className}`}>
      {children}
    </section>
  );
}

function priorityTone(priority: string) {
  const value = priority.toLowerCase();
  if (value.includes("high")) return "bg-rose-50 text-rose-600";
  if (value.includes("low")) return "bg-sky-50 text-sky-600";
  return "bg-amber-50 text-amber-700";
}

function priorityLabel(priority: string) {
  const value = priority.toLowerCase();
  if (value.includes("high")) return "High";
  if (value.includes("medium") || value === "med") return "Medium";
  if (value.includes("low")) return "Low";
  return priority;
}

export function EmpEmployeeHome({
  empFullName,
  todayStatus,
  onStatusUpdate,
}: EmployeeHomeProps) {
  useProductAccess();
  const user = useCurrentUser();
  const employeeId = Number(user?.employee?.id || 0);
  const [now, setNow] = useState(() => new Date());
  const [displayName, setDisplayName] = useState(empFullName || "");
  const [counts, setCounts] = useState({ present: 0, half: 0, holiday: 0, late: 0, absent: 0, leave: 0 });
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [memos, setMemos] = useState<MemoRow[]>([]);
  const [pending, setPending] = useState({ loan: 0, reimbursement: 0, regularisation: 0, regularisationApproved: 0, regularisationRejected: 0 });
  const [absentOpen, setAbsentOpen] = useState(false);
  const [absentReason, setAbsentReason] = useState("");
  const photoCaptureRef = useRef<EmpPhotoPunchCaptureHandle>(null);
  const { cards, load: loadLeaveBalance } = useEmpLeaveBalance();
  const {
    punch,
    markAbsent,
    punchLoading,
    punchError,
    punchSuccess,
  } = useEmpPunch(onStatusUpdate);

  const attendanceOn = canViewProductModule("ATTENDANCE_MODULE");
  const leaveOn = canViewProductModule("LEAVE_MODULE");
  const tasksOn =
    TASK_MANAGEMENT_ENABLED &&
    (canViewProductModule("TASK_MODULE") || canViewProductModule("ONFIELD_TASK_MODULE"));
  const noticesOn = canViewProductModule("IM_MODULE");
  const reimbursementOn = canViewProductModule("REIMBURSEMENT_MODULE");
  const regularisationOn = canViewProductModule("REGULARISATION_MODULE");
  const loanOn = canViewProductModule("LOAN_ADVANCE_MODULE");
  const approvalsOn = loanOn || reimbursementOn || regularisationOn;
  const approvalHref = loanOn
    ? "/empProfile?tab=salary-advance"
    : reimbursementOn
      ? "/empReimbursement"
      : regularisationOn
        ? "/empProfile?tab=regularisation"
        : undefined;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (empFullName) setDisplayName(empFullName);
  }, [empFullName]);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    void fetch(`${BACKEND}/manage-emp/${employeeId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((row) => {
        if (cancelled || !row) return;
        const name = `${row.employeeFirstName || ""} ${row.employeeLastName || ""}`.trim();
        if (name) setDisplayName(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || !leaveOn) return;
    void loadLeaveBalance(employeeId);
  }, [employeeId, leaveOn, loadLeaveBalance]);

  useEffect(() => {
    if (!employeeId || !attendanceOn) return;
    let cancelled = false;
    const { from, to, today } = monthBounds();
    void Promise.all([
      fetch(`${BACKEND}/emp-location-attendance/my?from=${from}&to=${to}`, { cache: "no-store" }).then((res) =>
        res.ok ? res.json() : [],
      ),
      fetch(`${BACKEND}/public-holiday`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      fetch(`${BACKEND}/manage-emp/${employeeId}`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetch(`${BACKEND}/attendance-policy`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : [])),
      leaveOn
        ? fetch(`${BACKEND}/leave-application/employee/${employeeId}`, { cache: "no-store" }).then((res) => (res.ok ? res.json() : []))
        : Promise.resolve([]),
    ])
      .then(async ([attendancePayload, holidayPayload, employee, policyPayload, leavePayload]) => {
        if (cancelled) return;
        const companyId = Number(employee?.companyID || 0);
        const branchId = Number(employee?.branchesID || 0);
        const holidays = new Set<string>();
        if (companyId) {
          for (const row of asList(holidayPayload)) {
            if (Number(row.companyID) !== companyId) continue;
            if (row.branchesID != null && String(row.branchesID) !== "" && Number(row.branchesID) !== branchId) continue;
            const start = dateKeyFromValue(row.startDate);
            const end = dateKeyFromValue(row.endDate) || start;
            if (!start) continue;
            for (const key of eachDate(start, end)) {
              if (key >= from && key <= to) holidays.add(key);
            }
          }
        }
        const leaveDays = new Set<string>();
        for (const row of asList(leavePayload)) {
          const owner = Number(row.manageEmployeeID || (row.manageEmployee as { id?: number } | undefined)?.id || 0);
          if (!owner || owner !== Number(employeeId)) continue;
          if (!isCompanyApprovedLeave(row.status)) continue;
          const start = dateKeyFromValue(row.fromDate);
          const end = dateKeyFromValue(row.toDate) || start;
          if (!start) continue;
          for (const key of eachDate(start, end)) {
            if (key >= from && key <= to) leaveDays.add(key);
          }
        }
        const policy = asList(policyPayload).find(
          (row) => Number(row.companyID) === companyId && Number(row.branchesID) === branchId,
        ) as PolicyBits | undefined;
        const shiftEntry = Array.isArray(employee?.empWorkShift) ? employee.empWorkShift[0] : null;
        const workShiftId = Number(shiftEntry?.workShiftID || employee?.workShiftID || 0);
        let flexible = String(policy?.workingHoursType || "").toLowerCase().includes("flex");
        let shiftDays: ShiftDay[] = [];
        if (workShiftId) {
          const shiftRes = await fetch(`${BACKEND}/work-shift/${workShiftId}`, { cache: "no-store" });
          if (shiftRes.ok) {
            const shift = await shiftRes.json();
            if (shift?.isFlexible) flexible = true;
            shiftDays = Array.isArray(shift?.workShiftDay) ? shift.workShiftDay : [];
          }
        }
        if (cancelled) return;
        const punched = new Map<string, number[]>();
        for (const day of groupAttendanceByDay(asList(attendancePayload) as unknown as AttendanceLocationRecord[])) {
          const minutes = day.records
            .map((record) => punchClockMinutes(record.checkinTime))
            .filter((value): value is number => value != null);
          if (minutes.length) punched.set(day.dateKey, minutes);
        }
        const noCheckout = new Map<string, number>();
        const lateMarks = new Map<string, number>();
        const maxHours = Number(employee?.maxHoursPerDay) || 0;
        const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const isOffDay = (key: string) => {
          if (!shiftDays.length) return isWeekendKey(key);
          const dayName = weekdayNames[new Date(`${key}T12:00:00Z`).getUTCDay()];
          return shiftDays.some((day) => day.weekDay === dayName && !!day.weeklyOff);
        };
        let present = 0;
        let half = 0;
        let holiday = 0;
        let late = 0;
        let absent = 0;
        const countedLeave = new Set<string>();
        for (const key of eachDate(from, to)) {
          if (isOffDay(key)) continue;
          const punches = punched.get(key) || [];
          if (key <= today && punches.length) {
            const kind = classifyDay({
              punches,
              dateKey: key,
              today,
              shiftDays,
              policy: policy || null,
              flexible,
              maxHours,
              noCheckout,
              lateMarks,
            });
            if (kind === "half") half += 1;
            else if (kind === "absent") absent += 1;
            else {
              present += 1;
              if (kind === "late") late += 1;
            }
            continue;
          }
          if (leaveDays.has(key)) {
            countedLeave.add(key);
            continue;
          }
          if (holidays.has(key)) {
            holiday += 1;
            continue;
          }
          if (key <= today) absent += 1;
        }
        setCounts({ present, half, holiday, late, absent, leave: countedLeave.size });
      })
      .catch(() => {
        if (!cancelled) setCounts({ present: 0, half: 0, holiday: 0, late: 0, absent: 0, leave: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, attendanceOn, leaveOn]);

  useEffect(() => {
    if (!employeeId || !tasksOn) return;
    let cancelled = false;
    void taskFetch<{ items?: TaskRow[] }>("/task-projects", user, undefined, { limit: 100, assignedToMe: 1 })
      .then((data) => {
        if (cancelled) return;
        const open = (data.items || []).filter((task) => isWorkingActiveAssignedTask(task, employeeId));
        setTasks(open.slice(0, 4));
      })
      .catch(() => {
        if (!cancelled) setTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, tasksOn, user]);

  useEffect(() => {
    if (!employeeId || !noticesOn) return;
    let cancelled = false;
    void fetch(`${BACKEND}/employee-memo?employeeID=${employeeId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((payload) => {
        if (cancelled) return;
        const rows = asList(payload)
          .map((row) => row as MemoRow)
          .filter((row) => (!row.employeeID || Number(row.employeeID) === employeeId) && isDashboardNotice(row))
          .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          .slice(0, 3);
        setMemos(rows);
      })
      .catch(() => {
        if (!cancelled) setMemos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, noticesOn]);

  useEffect(() => {
    if (!employeeId || !approvalsOn) return;
    let cancelled = false;
    const headers = { cache: "no-store" as const, headers: authHeaders() };
    void Promise.all([
      loanOn
        ? fetch(`${BACKEND}/salary-advance/employee/${employeeId}`, headers).then((res) => (res.ok ? res.json() : []))
        : Promise.resolve([]),
      reimbursementOn
        ? fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, headers).then((res) => (res.ok ? res.json() : []))
        : Promise.resolve([]),
      regularisationOn
        ? fetch(`${BACKEND}/emp-attendance-regularise`, headers).then((res) => (res.ok ? res.json() : []))
        : Promise.resolve([]),
    ])
      .then(([loanRows, reimbursementRows, regularisationRows]) => {
        if (cancelled) return;
        setPending({
          loan: asList(loanRows).filter((row) => {
            const owner = Number(row.manageEmployeeID || 0);
            return (!owner || owner === employeeId) && isPendingStatus(row.status);
          }).length,
          reimbursement: asList(reimbursementRows).filter((row) => isPendingStatus(row.status)).length,
          regularisation: asList(regularisationRows).filter(
            (row) => Number(row.manageEmployeeID) === employeeId && row.isDeleted !== true && isPendingStatus(row.status),
          ).length,
          regularisationApproved: asList(regularisationRows).filter(
            (row) => Number(row.manageEmployeeID) === employeeId && row.isDeleted !== true && String(row.status || "").toLowerCase() === "approved",
          ).length,
          regularisationRejected: asList(regularisationRows).filter(
            (row) => Number(row.manageEmployeeID) === employeeId && row.isDeleted !== true && String(row.status || "").toLowerCase() === "rejected",
          ).length,
        });
      })
      .catch(() => {
        if (!cancelled) setPending({ loan: 0, reimbursement: 0, regularisation: 0, regularisationApproved: 0, regularisationRejected: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, approvalsOn, loanOn, reimbursementOn, regularisationOn]);

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good Morning," : hour < 17 ? "Good Afternoon," : hour < 20 ? "Good Evening," : "Good Night,";
  const clock = now
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    .replace(/\b(am|pm)\b/i, (part) => part.toUpperCase());
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const punchState = todayStatus?.punchState ?? (todayStatus?.isCheckedIn ? "IN" : "OUT");
  const appPunch = todayStatus?.mobileAttendanceEnabled === true;
  const canCheckIn = attendanceOn && appPunch && punchState === "OUT" && !todayStatus?.isAbsentToday;
  const canCheckOut = attendanceOn && appPunch && (punchState === "IN" || punchState === "ON_BREAK");
  const canMarkAbsent =
    attendanceOn &&
    appPunch &&
    (todayStatus?.canMarkAbsent ?? false) &&
    punchState === "OUT" &&
    !todayStatus?.isAbsentToday;
  const leaveTotals = useMemo(() => {
    const total = cards.reduce((sum, card) => sum + card.total, 0);
    const remaining = cards.reduce((sum, card) => sum + card.remaining, 0);
    return { total, remaining, used: Math.max(total - remaining, 0) };
  }, [cards]);

  const startMark = (checkType: "CHECK_IN" | "CHECK_OUT") => {
    if (todayStatus?.photoPunchEnabled) {
      photoCaptureRef.current?.startFromGesture(checkType);
      return;
    }
    void punch(checkType);
  };

  const submitAbsent = async () => {
    if (absentReason.trim().length < 3) return;
    await markAbsent(absentReason.trim());
    setAbsentOpen(false);
    setAbsentReason("");
  };

  const ring = 2 * Math.PI * 46;
  const remainingShare = leaveTotals.total > 0 ? Math.min(1, leaveTotals.remaining / leaveTotals.total) : 0;
  const attendanceStats = [
    { label: "Present", value: counts.present, icon: <span className="grid size-7 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-4" strokeWidth={3} /></span> },
    { label: "Late Mark", value: counts.late, icon: <Clock3 className="size-6 text-amber-500" /> },
    { label: "Half Day", value: counts.half, icon: <span className="grid size-7 place-items-center rounded-full bg-amber-100 text-[12px] font-bold text-amber-700">½</span> },
    { label: "Absent", value: counts.absent, icon: <span className="grid size-7 place-items-center rounded-full bg-rose-500 text-white"><X className="size-4" strokeWidth={3} /></span> },
    { label: "Holiday", value: counts.holiday, icon: <CalendarDays className="size-6 text-sky-500" /> },
    ...(leaveOn ? [{ label: "Leave", value: counts.leave, icon: <Palmtree className="size-6 text-emerald-500" /> }] : []),
  ];

  return (
    <div className="emp-home-dashboard flex h-full min-h-0 flex-1 flex-col bg-[#f4f7fb]">
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-4 overflow-y-auto md:grid-cols-2 md:auto-rows-[minmax(220px,auto)]">
        <section className="relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-sm border border-[#e7edf5] px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <HeroBackground />
          <div className="relative z-10 flex h-full min-h-0 max-w-[70%] flex-col text-white">
            <p className="text-[20px] font-medium leading-tight text-white">{greeting}</p>
            <h2 className="mt-0.5 truncate text-[22px] font-bold leading-tight !text-white">{displayName || "Employee"}</h2>
            <p className="mt-1.5 flex items-center gap-2 text-[13px] text-white/90">
              <CalendarDays className="size-3.5 text-white/80" />
              {dateLabel}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-[16px] font-semibold tabular-nums text-white">
              <Clock3 className="size-3.5 text-white/80" />
              {clock}
            </p>
            {(punchError || punchSuccess) ? (
              <p className={`mt-2 text-xs ${punchError ? "text-red-600" : "text-emerald-700"}`}>{punchError || punchSuccess}</p>
            ) : null}
            {(canCheckIn || canCheckOut || canMarkAbsent) ? (
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                {canCheckIn ? (
                  <button type="button" onClick={() => startMark("CHECK_IN")} disabled={punchLoading} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white disabled:opacity-60">
                    <LogIn className="size-4" />
                    {punchLoading ? "Please wait…" : "Check-in"}
                  </button>
                ) : null}
                {canCheckOut ? (
                  <button type="button" onClick={() => startMark("CHECK_OUT")} disabled={punchLoading} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white disabled:opacity-60">
                    <LogIn className="size-4" />
                    {punchLoading ? "Please wait…" : "Check out"}
                  </button>
                ) : null}
                {canMarkAbsent ? (
                  <button type="button" onClick={() => setAbsentOpen(true)} disabled={punchLoading} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-400 bg-white px-3.5 text-sm font-semibold text-rose-500">
                    <MapPin className="size-4" />
                    Mark Absent
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {leaveOn ? (
          <HomeCard>
            <CardHeader icon={<Palmtree className="size-5 text-emerald-500" />} title="My Leaves" href="/empLeaveApplication" />
            <div className="flex min-h-0 flex-1 items-center gap-6">
              <div className="relative aspect-square w-[24%] min-w-[92px] max-w-[132px] shrink-0">
                <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#dcfce7" strokeWidth="10" />
                  <circle cx="60" cy="60" r="46" fill="none" stroke="#16a34a" strokeWidth="10" strokeLinecap="round" strokeDasharray={ring} strokeDashoffset={ring * (1 - remainingShare)} />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-[26px] font-bold leading-none text-emerald-600">{leaveTotals.remaining}</p>
                    <p className="mt-1 text-[11px] font-medium text-slate-500">Days Left</p>
                  </div>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                {[
                  { label: "Total", value: leaveTotals.total, green: false },
                  { label: "Used", value: leaveTotals.used, green: false },
                  { label: "Remaining", value: leaveTotals.remaining, green: true },
                ].map((row, index) => (
                  <div key={row.label} className={`flex items-center justify-between py-2 text-[14px] ${index ? "border-t border-slate-100" : ""} ${row.green ? "text-emerald-600" : "text-slate-600"}`}>
                    <span>{row.label}</span>
                    <span className="font-semibold tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </HomeCard>
        ) : null}

        {attendanceOn ? (
          <HomeCard>
            <CardHeader
              icon={<CalendarDays className="size-5 text-slate-700" />}
              title="My Attendance"
              aside={<span className="shrink-0 whitespace-nowrap text-[13px] text-slate-400">(This Month)</span>}
              href="/empProfile?tab=attendance"
            />
            <div className={`grid min-h-0 flex-1 ${attendanceStats.length >= 6 ? "grid-cols-6" : "grid-cols-5"}`}>
              {attendanceStats.map((item, index) => (
                <div key={item.label} className={`flex flex-col items-center justify-center px-0.5 text-center ${index ? "border-l border-slate-100" : ""}`}>
                  <span className="grid h-6 place-items-center">{item.icon}</span>
                  <p className="mt-1 text-[20px] font-bold leading-none tabular-nums text-slate-900">{item.value}</p>
                  <p className="mt-1 text-[11px] leading-tight text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          </HomeCard>
        ) : null}

        {tasksOn ? (
          <HomeCard>
            <CardHeader icon={<ListTodo className="size-5 text-blue-600" />} title="My Tasks" href="/empMyTasks" />
            {tasks.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <ListTodo className="size-6" />
                <p className="text-sm">No open tasks</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {tasks.map((task, index) => (
                  <li key={String(task.id || index)} className="flex h-9 items-center gap-3 border-b border-slate-100 last:border-0">
                    <span className="size-4 shrink-0 rounded border border-slate-300" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-[14px] text-slate-800">{task.taskName || "Task"}</p>
                    {task.priority ? (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone(task.priority)}`}>{priorityLabel(task.priority)}</span>
                    ) : null}
                    <span className="w-[4.75rem] shrink-0 text-right text-[12px] text-slate-500">{dueLabel(task.dueAt || task.dueDateTime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </HomeCard>
        ) : null}

        {regularisationOn ? (
          <HomeCard>
            <CardHeader icon={<Clock3 className="size-5 text-emerald-600" />} title="Regularisation" href="/empProfile?tab=regularisation" action="View" />
            <StatusDonut
              slices={[
                { name: "Approved", value: pending.regularisationApproved, fill: "#16a34a" },
                { name: "Rejected", value: pending.regularisationRejected, fill: "#e11d48" },
              ]}
            />
          </HomeCard>
        ) : null}

        {noticesOn ? (
          <HomeCard className="md:row-span-2 md:min-h-[460px]">
            <CardHeader icon={<Megaphone className="size-5 text-violet-600" />} title="Notifications" href="/empProfile?tab=messaging" action="View All" />
            {memos.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <Bell className="size-6" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
                {memos.map((memo, index) => (
                  <li key={`${memo.createdAt || "memo"}-${index}`} className="flex gap-3 rounded-2xl bg-[#eef2ff] px-3 py-2.5">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-white text-indigo-500">
                      <Bell className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{memo.subject || memo.title || "Notice"}</p>
                      {memo.description ? <p className="line-clamp-2 text-[13px] text-slate-600">{memo.description}</p> : null}
                      <p className="mt-1 flex items-center gap-1 text-[12px] text-slate-400">
                        <CalendarDays className="size-3.5" />
                        {memoDate(memo.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </HomeCard>
        ) : null}

        {approvalsOn ? (
          <HomeCard>
            <CardHeader icon={<UserCheck className="size-5 text-violet-600" />} title="My Approvals" href={approvalHref} />
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
              {regularisationOn ? (
                <Link href="/empProfile?tab=regularisation" className="flex h-full flex-col items-center justify-center rounded-sm bg-[#e7f8ee] px-2 text-center text-emerald-600">
                  <Clock3 className="size-6" />
                  <p className="mt-2 text-[26px] font-bold leading-none text-slate-900">{pending.regularisation}</p>
                  <p className="mt-1 text-[13px] text-slate-600">Regularisation</p>
                </Link>
              ) : null}
              {reimbursementOn ? (
                <Link href="/empReimbursement" className="flex h-full flex-col items-center justify-center rounded-sm bg-[#f3e8ff] px-2 text-center text-violet-600">
                  <FileText className="size-6" />
                  <p className="mt-2 text-[26px] font-bold leading-none text-slate-900">{pending.reimbursement}</p>
                  <p className="mt-1 text-[13px] text-slate-600">Reimbursement</p>
                </Link>
              ) : null}
              {loanOn ? (
                <Link href="/empProfile?tab=salary-advance" className="flex h-full flex-col items-center justify-center rounded-sm bg-[#e8f1ff] px-2 text-center text-blue-600">
                  <Wallet className="size-6" />
                  <p className="mt-2 text-[26px] font-bold leading-none text-slate-900">{pending.loan}</p>
                  <p className="mt-1 text-[13px] text-slate-600">Loan Requests</p>
                </Link>
              ) : null}
            </div>
          </HomeCard>
        ) : null}
      </div>

      {absentOpen ? (
        <>
          <button type="button" className="fixed inset-0 z-50 bg-black/40" aria-label="Close" onClick={() => setAbsentOpen(false)} />
          <div className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Mark Absent</h3>
            <p className="mt-1 text-sm text-slate-500">
              Emergency absence without prior notice. A leave request will be sent to your manager.
            </p>
            <label className="mt-4 block text-xs font-semibold text-slate-600">Reason *</label>
            <textarea
              value={absentReason}
              onChange={(event) => setAbsentReason(event.target.value)}
              rows={3}
              placeholder="Describe the reason…"
              className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setAbsentOpen(false)} className="h-11 flex-1 rounded-xl border border-slate-200 font-medium text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitAbsent()}
                disabled={punchLoading || absentReason.trim().length < 3}
                className="h-11 flex-1 rounded-xl bg-red-600 font-semibold text-white disabled:opacity-50"
              >
                {punchLoading ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>
        </>
      ) : null}
      <EmpPhotoPunchCapture
        ref={photoCaptureRef}
        submitting={punchLoading}
        onSubmit={(checkType, photoFile, location) => punch(checkType, { photoFile, location })}
      />
    </div>
  );
}
