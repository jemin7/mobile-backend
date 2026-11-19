"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileText,
  ListTodo,
  Megaphone,
  MoreVertical,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import { TASK_MANAGEMENT_ENABLED } from "@/app/config/featureFlags";
import { taskFetch } from "@/app/utils/taskApi";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { canViewProductModule, useProductAccess } from "@/lib/productAccess";
import { formatPunchTime } from "@/app/utils/empAttendanceHistory";
import { TeamAttendanceRegulariseModal } from "./TeamAttendanceRegulariseModal";

type TodayOverview = {
  summary?: { total?: number; present?: number; absent?: number; onLeave?: number };
  employees?: {
    id: number;
    employeeFirstName?: string;
    employeeLastName?: string;
    inTime?: string | null;
    outTime?: string | null;
    inLocation?: string | null;
    outLocation?: string | null;
    statusType?: string;
    statusDisplay?: string;
    hasPunches?: boolean;
  }[];
};
import { filterNotificationsForViewer } from "@/app/utils/empNotificationFilter";
import { formatManagerNotificationCopy } from "@/app/utils/empManagerDisplay";
import type { FeedNotification } from "@/app/components/emp/EmpNotificationsPanel";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type Member = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  isCheckedIn?: boolean;
  isAbsentToday?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  statusLabel?: string;
};

type AttendanceKind = "present" | "leave" | "absent" | "duty" | "late" | "waiting";
type StatKey = "total" | "present" | "leave" | "absent" | "late" | "waiting";

type TeamTask = {
  id?: number | string;
  taskName?: string;
  priority?: string;
  dueAt?: string | null;
  dueDateTime?: string | null;
  status?: string;
  assignments?: { manageEmployeeID?: number | null }[];
  engineerAssignments?: { manageEmployeeID?: number | null }[];
};

type TableRow = {
  id: number;
  name: string;
  code?: string;
  inTime?: string | null;
  outTime?: string | null;
  inLocation?: string | null;
  outLocation?: string | null;
  kind: AttendanceKind;
};

function displayPunch(value?: string | null) {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}/.test(value) && !value.includes("T")) {
    const [hourText, minuteText] = value.split(":");
    const hour = Number(hourText);
    const minute = Number(minuteText);
    if (!Number.isFinite(hour)) return value;
    const suffix = hour >= 12 ? "pm" : "am";
    const hour12 = hour % 12 || 12;
    return `${String(hour12).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${suffix}`;
  }
  const formatted = formatPunchTime(value);
  return formatted === "--:--" ? "" : formatted;
}

function punchDetail(label: string, time?: string | null, location?: string | null) {
  const clock = displayPunch(time);
  if (!clock && !location) return "";
  return [label, clock, location].filter(Boolean).join(" · ");
}

type Notice = FeedNotification;

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") || localStorage.getItem("accessToken") || "" : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asList(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (payload && typeof payload === "object") {
    const row = payload as { data?: unknown; items?: unknown };
    if (Array.isArray(row.data)) return row.data as Record<string, unknown>[];
    if (Array.isArray(row.items)) return row.items as Record<string, unknown>[];
  }
  return [];
}

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function dateKey(value: unknown) {
  const text = String(value || "");
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : "";
}

function isPendingStatus(status: unknown) {
  const value = String(status || "").trim().toLowerCase();
  if (!value) return false;
  if (/(approv|reject|cancel|declin|withdraw)/.test(value)) return false;
  return /(pend|submit|open|new)/.test(value);
}

function isApprovedStatus(status: unknown) {
  const value = String(status || "").toLowerCase();
  return /approv/.test(value) && !/(reject|cancel|declin)/.test(value);
}

function memberKind(member: Member, leaveIds: Set<number>): AttendanceKind {
  if (member.isCheckedIn || member.statusLabel === "Checked in" || member.statusLabel === "Checked out" || member.checkInTime) {
    return "present";
  }
  if (leaveIds.has(member.id)) return "leave";
  if (member.isAbsentToday || member.statusLabel === "Absent") return "absent";
  return "waiting";
}

function overviewKind(row: { statusType?: string; statusDisplay?: string; hasPunches?: boolean }): AttendanceKind {
  const type = String(row.statusType || "").toUpperCase();
  const label = `${type} ${String(row.statusDisplay || "").toUpperCase()}`;
  if (type === "LEAVE" || label.includes("ON LEAVE")) return "leave";
  if (label.includes("DUTY")) return "duty";
  if (type === "LATE_MARK") return "late";
  if (["PRESENT", "OT", "SINGLE_PUNCH"].includes(type) || row.hasPunches) return "present";
  if (type === "ABSENT" || type === "HALF_DAY") return "absent";
  return "waiting";
}

function statusText(kind: AttendanceKind) {
  if (kind === "present") return "Present";
  if (kind === "leave") return "On Leave";
  if (kind === "absent") return "Absent";
  if (kind === "duty") return "On Duty";
  if (kind === "late") return "Late Mark";
  return "Not Checked In";
}

function dueLabel(iso?: string | null) {
  if (!iso) return "No due date";
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return "No due date";
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const same = (left: Date, right: Date) =>
    left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
  if (same(due, today)) return "Today";
  if (same(due, tomorrow)) return "Tomorrow";
  if (due.getTime() < today.getTime()) return "Overdue";
  return due.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function priorityTone(priority: string) {
  const value = priority.toLowerCase();
  if (value.includes("high")) return "bg-rose-50 text-rose-600";
  if (value.includes("low")) return "bg-sky-50 text-sky-600";
  return "bg-amber-50 text-amber-700";
}

function isOpenTask(status?: string) {
  const value = String(status || "").toLowerCase();
  if (!value) return false;
  return !/(complet|closed|cancel)/.test(value);
}

const STAT_LABELS: Record<StatKey, string> = {
  total: "All Employees",
  present: "Present",
  leave: "Leave",
  absent: "Absent",
  late: "Late Mark",
  waiting: "Not Checked In",
};

function statusClass(kind: AttendanceKind) {
  if (kind === "present") return "bg-emerald-50 text-emerald-600";
  if (kind === "leave") return "bg-blue-50 text-blue-600";
  if (kind === "absent") return "bg-rose-50 text-rose-600";
  if (kind === "duty") return "bg-amber-50 text-amber-700";
  if (kind === "late") return "bg-amber-50 text-amber-700";
  return "bg-orange-50 text-orange-600";
}

const AVATARS = ["bg-sky-100 text-sky-700", "bg-violet-100 text-violet-700", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700"];

function CardLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium leading-none text-[#3b6fd8] hover:text-[#2f5ec0]">
      {children}
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

function StatusDonut({ slices }: { slices: { name: string; value: number; fill: string }[] }) {
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  const data = total > 0 ? slices.filter((item) => item.value > 0) : [{ name: "None", value: 1, fill: "#E2E8F0" }];
  return (
    <div className="flex min-h-0 flex-1 items-center gap-4">
      <div className="relative h-[112px] w-[112px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={34} outerRadius={50} paddingAngle={2} strokeWidth={0}>
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

function CardShell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`flex h-auto min-h-[180px] flex-col overflow-hidden rounded-sm border border-[#e7edf5] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)] lg:h-full ${className}`}>
      {children}
    </section>
  );
}

export function EmpTeamDashboard() {
  useProductAccess();
  const user = useCurrentUser();
  const { scope } = useEmpManagerScope();
  const [direct, setDirect] = useState<Member[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [leaveIds, setLeaveIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState({ leave: 0, reimbursement: 0, regularisation: 0, loan: 0 });
  const [notices, setNotices] = useState<Notice[]>([]);
  const [attendanceScope, setAttendanceScope] = useState<"reportees" | "team">("team");
  const [reporteeScope, setReporteeScope] = useState<"reportees" | "team">("reportees");
  const [openStat, setOpenStat] = useState<StatKey | null>(null);
  const [regulariseTarget, setRegulariseTarget] = useState<{ id: number; name: string } | null>(null);
  const [teamTasks, setTeamTasks] = useState<TeamTask[]>([]);
  const [rosteredToday, setRosteredToday] = useState(0);
  const [rosterPeople, setRosterPeople] = useState(0);

  const employeeId = Number(scope?.employeeId || user?.employee?.id || 0);
  const teamIds = useMemo(() => {
    const ids = new Set<number>();
    for (const id of scope?.reporteeIds || []) {
      if (id && id !== employeeId) ids.add(id);
    }
    return ids;
  }, [scope, employeeId]);

  const attendanceOn = canViewProductModule("ATTENDANCE_MODULE");
  const leaveOn = canViewProductModule("LEAVE_MODULE");
  const noticesOn = canViewProductModule("IM_MODULE");
  const reimbursementOn = canViewProductModule("REIMBURSEMENT_MODULE");
  const regularisationOn = canViewProductModule("REGULARISATION_MODULE");
  const loanOn = canViewProductModule("LOAN_ADVANCE_MODULE");
  const tasksOn =
    TASK_MANAGEMENT_ENABLED &&
    (canViewProductModule("TASK_MODULE") || canViewProductModule("ONFIELD_TASK_MODULE"));

  useEffect(() => {
    if (!tasksOn || !employeeId) return;
    let cancelled = false;
    void taskFetch<{ items?: TeamTask[] }>("/task-projects", user, undefined, { limit: 100 })
      .then((data) => {
        if (cancelled) return;
        const open = (data.items || []).filter((task) => {
          if (!isOpenTask(task.status)) return false;
          const assignees = [
            ...(task.assignments || []).map((row) => Number(row.manageEmployeeID || 0)),
            ...(task.engineerAssignments || []).map((row) => Number(row.manageEmployeeID || 0)),
          ];
          return assignees.some((id) => teamIds.has(id));
        });
        setTeamTasks(open.slice(0, 8));
      })
      .catch(() => {
        if (!cancelled) setTeamTasks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tasksOn, employeeId, user, teamIds]);

  useEffect(() => {
    let cancelled = false;
    const headers = authHeaders();
    void Promise.all([
      fetch(`${BACKEND}/emp-manager-scope/reportees-today-status`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
      fetch(`${BACKEND}/emp-manager-scope/team-today-status?scope=team`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([directPayload, nestedPayload]) => {
        if (cancelled) return;
        setDirect(Array.isArray(directPayload?.reportees) ? directPayload.reportees : []);
        setTeam(Array.isArray(nestedPayload?.members) ? nestedPayload.members : []);
      })
      .catch(() => {
        if (!cancelled) {
          setDirect([]);
          setTeam([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let companyID = 0;
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}") as { companyID?: number; activeCompanyID?: number };
      companyID = Number(stored.activeCompanyID || stored.companyID || 0);
    } catch {
      companyID = 0;
    }
    const query = companyID ? `?companyID=${companyID}` : "";
    void fetch(`${BACKEND}/dashboard-overview/today-overview${query}`, { headers: authHeaders(), cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) setOverview(data);
      })
      .catch(() => {
        if (!cancelled) setOverview(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;
    const headers = authHeaders();
    const today = todayKey();
    void Promise.all([
      leaveOn ? fetch(`${BACKEND}/leave-application/employee/${employeeId}`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      reimbursementOn ? fetch(`${BACKEND}/reimbursement/employee/${employeeId}`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      regularisationOn ? fetch(`${BACKEND}/emp-attendance-regularise`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
      loanOn ? fetch(`${BACKEND}/salary-advance/employee/${employeeId}`, { headers, cache: "no-store" }).then((res) => (res.ok ? res.json() : [])) : Promise.resolve([]),
    ])
      .then(([leaveRows, reimbursementRows, regularisationRows, loanRows]) => {
        if (cancelled) return;
        const leaves = asList(leaveRows);
        const onLeave = new Set<number>();
        let pendingLeave = 0;
        for (const row of leaves) {
          const id = Number(row.manageEmployeeID);
          if (!teamIds.has(id)) continue;
          if (isPendingStatus(row.status)) pendingLeave += 1;
          const start = dateKey(row.fromDate);
          const end = dateKey(row.toDate) || start;
          if (isApprovedStatus(row.status) && start && start <= today && today <= end) onLeave.add(id);
        }
        setLeaveIds(onLeave);
        setPending({
          leave: pendingLeave,
          reimbursement: asList(reimbursementRows).filter((row) => teamIds.has(Number(row.manageEmployeeID)) && isPendingStatus(row.status)).length,
          regularisation: asList(regularisationRows).filter(
            (row) => teamIds.has(Number(row.manageEmployeeID)) && row.isDeleted !== true && isPendingStatus(row.status),
          ).length,
          loan: asList(loanRows).filter((row) => teamIds.has(Number(row.manageEmployeeID)) && isPendingStatus(row.status)).length,
        });
      })
      .catch(() => {
        if (!cancelled) setPending({ leave: 0, reimbursement: 0, regularisation: 0, loan: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId, leaveOn, reimbursementOn, regularisationOn, loanOn, teamIds]);

  useEffect(() => {
    if (!noticesOn) return;
    let cancelled = false;
    void fetch(`${BACKEND}/emp-notifications/feed?recentDays=14&olderDays=30`, { headers: authHeaders(), cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const recent = Array.isArray(data.recent) ? data.recent : [];
        const older = Array.isArray(data.older) ? data.older : [];
        const merged = filterNotificationsForViewer([...(recent as Notice[]), ...(older as Notice[])], true);
        merged.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
        setNotices(merged.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setNotices([]);
      });
    return () => {
      cancelled = true;
    };
  }, [noticesOn]);

  const overviewById = useMemo(() => {
    const map = new Map<number, NonNullable<TodayOverview["employees"]>[number]>();
    for (const row of overview?.employees || []) map.set(row.id, row);
    return map;
  }, [overview]);

  const directIds = useMemo(() => new Set(direct.map((member) => member.id)), [direct]);
  const teamOnly = useMemo(() => team.filter((member) => !directIds.has(member.id)), [team, directIds]);

  const rowsFor = (members: Member[]) =>
    members.map((member) => {
      const source = overviewById.get(member.id);
      return {
        id: member.id,
        name: reporteeDisplayName(member),
        code: member.employeeID || "",
        inTime: source?.inTime || member.checkInTime || null,
        outTime: source?.outTime || member.checkOutTime || null,
        inLocation: source?.inLocation,
        outLocation: source?.outLocation,
        kind: source ? overviewKind(source) : memberKind(member, leaveIds),
      };
    });

  const reportees = useMemo<TableRow[]>(
    () => rowsFor(reporteeScope === "team" ? teamOnly : direct),
    [reporteeScope, teamOnly, direct, leaveIds, overviewById],
  );

  const attendanceRows = useMemo<TableRow[]>(
    () => rowsFor(attendanceScope === "reportees" ? direct : teamOnly),
    [attendanceScope, teamOnly, direct, leaveIds, overviewById],
  );

  const stats = useMemo(() => {
    const counts = { total: attendanceRows.length, present: 0, leave: 0, absent: 0, late: 0, waiting: 0 };
    for (const row of attendanceRows) {
      if (row.kind === "late") {
        counts.present += 1;
        counts.late += 1;
      } else if (row.kind === "present") counts.present += 1;
      else if (row.kind === "leave") counts.leave += 1;
      else if (row.kind === "absent") counts.absent += 1;
      else if (row.kind !== "duty") counts.waiting += 1;
    }
    return counts;
  }, [attendanceRows]);

  const statList = useMemo(() => {
    if (!openStat) return [];
    return attendanceRows.filter((row) => {
      if (openStat === "total") return true;
      if (openStat === "present") return row.kind === "present" || row.kind === "late";
      if (openStat === "late") return row.kind === "late";
      if (openStat === "leave") return row.kind === "leave";
      if (openStat === "absent") return row.kind === "absent";
      return row.kind === "waiting";
    });
  }, [openStat, attendanceRows]);

  const visibleNotices = notices.slice(0, 6).map((item) => ({
    ...formatManagerNotificationCopy(item, scope),
    at: item.at,
  }));

  const approvalTiles = [
    leaveOn ? { key: "leave", href: "/empTeam/approvals", label: "Leave Requests", value: pending.leave, icon: <FileText className="size-6" />, className: "bg-[#e8f1ff] text-blue-600" } : null,
    reimbursementOn ? { key: "reimb", href: "/empTeam/approvals", label: "Reimbursements", value: pending.reimbursement, icon: <Wallet className="size-6" />, className: "bg-[#f3e8ff] text-violet-600" } : null,
    regularisationOn ? { key: "reg", href: "/empTeam/regularisation", label: "Regularisation", value: pending.regularisation, icon: <Clock3 className="size-6" />, className: "bg-[#e7f8ee] text-emerald-600" } : null,
    loanOn ? { key: "loan", href: "/empTeam/approvals?type=advance", label: "Loan & Advances", value: pending.loan, icon: <Wallet className="size-6" />, className: "bg-[#eef2ff] text-blue-700" } : null,
  ].filter(Boolean) as { key: string; href: string; label: string; value: number; icon: ReactNode; className: string }[];

  const attendanceColumns = [
    { key: "total" as const, label: "All Employees", value: stats.total, icon: <Users className="size-5 text-slate-500" /> },
    { key: "present" as const, label: "Present", value: stats.present, icon: <span className="grid size-6 place-items-center rounded-full bg-emerald-500 text-white"><Check className="size-3.5" strokeWidth={3} /></span> },
    { key: "late" as const, label: "Late Mark", value: stats.late, icon: <Clock3 className="size-5 text-amber-600" /> },
    { key: "absent" as const, label: "Absent", value: stats.absent, icon: <span className="grid size-6 place-items-center rounded-full bg-rose-500 text-white"><X className="size-3.5" strokeWidth={3} /></span> },
    { key: "waiting" as const, label: "Not Checked In", value: stats.waiting, icon: <Users className="size-5 text-orange-500" /> },
    ...(leaveOn ? [{ key: "leave" as const, label: "Leave", value: stats.leave, icon: <CalendarDays className="size-5 text-blue-500" /> }] : []),
  ];

  useEffect(() => {
    const ids = (scope?.directReporteeIds || []).map(Number).filter((id) => id > 0);
    if (!ids.length) {
      setRosteredToday(0);
      setRosterPeople(0);
      return;
    }
    let cancelled = false;
    const token = localStorage.getItem("token") || localStorage.getItem("accessToken") || "";
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    void fetch(`${BACKEND}/emp-manager-scope/reportee-roster`, { headers, cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((roster) => {
        if (cancelled) return;
        setRosteredToday(Number(roster?.rosteredToday || 0));
        setRosterPeople(Array.isArray(roster?.employees) ? roster.employees.length : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setRosteredToday(0);
          setRosterPeople(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [scope?.directReporteeIds?.join(",")]);

  return (
    <div className="emp-home-dashboard grid h-full min-h-0 flex-1 grid-cols-1 gap-4 bg-[#f4f7fb] lg:grid-cols-2 lg:grid-rows-3">
        <CardShell className="order-5">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <CalendarClock className="size-5 text-slate-700" />
              <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">Reportee Roster</h2>
            </div>
            <CardLink href="/roster?scope=reportees">View</CardLink>
          </div>
          <StatusDonut
            slices={[
              { name: "Rostered today", value: rosteredToday, fill: "#16a34a" },
              { name: "Not rostered", value: Math.max(rosterPeople - rosteredToday, 0), fill: "#94a3b8" },
            ]}
          />
        </CardShell>
        {noticesOn ? (
        <CardShell className="order-6">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Megaphone className="size-5 text-violet-600" />
              <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">Team Notifications</h2>
            </div>
            <CardLink href="/empProfile?tab=messaging">View All</CardLink>
          </div>
          {visibleNotices.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <Bell className="size-6" />
              <p className="text-sm">No notifications</p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {visibleNotices.map((item, index) => (
                <li key={`${item.at || "notice"}-${index}`} className="flex gap-3 rounded-sm bg-[#eef2ff] px-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center self-center rounded-full bg-white text-violet-500">
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{item.title}</p>
                    {item.body ? <p className="line-clamp-2 text-[13px] text-slate-600">{item.body}</p> : null}
                    {item.at ? (
                      <p className="mt-1 flex items-center gap-1 text-[12px] text-slate-400">
                        <CalendarDays className="size-3.5" />
                        {new Date(item.at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardShell>
        ) : null}
        {attendanceOn ? (
        <CardShell className="order-1">
          <div className="mb-2 flex shrink-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Users className="size-5 shrink-0 text-slate-700" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="inline-flex min-w-0 items-center gap-1 text-[17px] font-semibold leading-none text-slate-900">
                      <span className="truncate">{attendanceScope === "reportees" ? "My Reportees Attendance" : "My Team Attendance"}</span>
                      <ChevronDown className="size-4 shrink-0 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setAttendanceScope("team"); setOpenStat(null); }}>My Team Attendance</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setAttendanceScope("reportees"); setOpenStat(null); }}>My Reportees Attendance</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <p className="mt-1 pl-7 text-[13px] text-slate-400">Today</p>
            </div>
            <CardLink href={attendanceScope === "reportees" ? "/empTeam/my-team" : "/empTeam/my-team?scope=team"}>View Details</CardLink>
          </div>
          <div className={`grid min-h-0 flex-1 grid-cols-3 ${leaveOn ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}>
            {attendanceColumns.map((item, index) => (
              <button key={item.key} type="button" onClick={() => setOpenStat(item.key)} className={`flex flex-col items-center justify-center px-1 text-center ${index ? "border-l border-slate-100" : ""}`}>
                <span className="grid h-6 place-items-center">{item.icon}</span>
                <p className="mt-1 text-[20px] font-bold leading-none tabular-nums text-slate-900">{item.value}</p>
                <p className="mt-1 text-[11px] leading-tight text-slate-500">{item.label}</p>
              </button>
            ))}
          </div>
        </CardShell>
        ) : null}

        {tasksOn ? (
          <CardShell className="order-4">
            <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <ListTodo className="size-5 text-blue-600" />
                <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">Team Tasks</h2>
              </div>
              <CardLink href="/my-company/tasks">View All</CardLink>
            </div>
            {teamTasks.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400">
                <ListTodo className="size-6" />
                <p className="text-sm">No open tasks</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {teamTasks.map((task, index) => (
                  <li key={String(task.id || index)} className="flex h-9 items-center gap-3 border-b border-slate-100 last:border-0">
                    <span className="size-4 shrink-0 rounded border border-slate-300" aria-hidden />
                    <p className="min-w-0 flex-1 truncate text-[14px] text-slate-800">{task.taskName || "Task"}</p>
                    {task.priority ? (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${priorityTone(task.priority)}`}>{task.priority}</span>
                    ) : null}
                    <span className="w-[4.75rem] shrink-0 text-right text-[12px] text-slate-500">{dueLabel(task.dueAt || task.dueDateTime)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardShell>
        ) : null}

        <CardShell className="order-2">
          <div className="mb-2 flex shrink-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <Users className="size-5 text-slate-700" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex min-w-0 items-center gap-1 text-[17px] font-semibold leading-none text-slate-900">
                    <span className="truncate">{reporteeScope === "team" ? "My Team" : "My Reportees"}</span>
                    <ChevronDown className="size-4 shrink-0 text-slate-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setReporteeScope("reportees")}>My Reportees</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setReporteeScope("team")}>My Team</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <CardLink href={reporteeScope === "team" ? "/empTeam/my-team?scope=team" : "/empTeam/my-team"}>View All</CardLink>
          </div>
          {reportees.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <Users className="size-6" />
              <p className="text-sm">{reporteeScope === "team" ? "No team members" : "No direct reportees"}</p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {reportees.map((row, index) => {
                const initials = row.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
                return (
                  <li key={row.id} className="flex min-h-12 items-center gap-3 border-b border-slate-100 py-1.5 last:border-0">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-full text-[12px] font-semibold ${AVATARS[index % AVATARS.length]}`}>{initials}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-slate-900">{row.name}</p>
                      <p className="truncate text-[12px] text-slate-400">{row.code || "—"}</p>
                      <p className="truncate text-[11px] text-slate-500">In {displayPunch(row.inTime) || "—"} · Out {displayPunch(row.outTime) || "—"}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${statusClass(row.kind)}`}>{statusText(row.kind)}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" className="grid size-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100" aria-label={`Actions for ${row.name}`}>
                          <MoreVertical className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/empTeam/member/${row.id}`}>View profile</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRegulariseTarget({ id: row.id, name: row.name })}>
                          Regularize
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                );
              })}
            </ul>
          )}
        </CardShell>

        {approvalTiles.length > 0 ? (
          <CardShell className="order-3">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="size-5 text-violet-600" />
                <h2 className="truncate text-[17px] font-semibold leading-none !text-slate-900">Team Approvals</h2>
              </div>
              <CardLink href="/empTeam/approvals">View Details</CardLink>
            </div>
            <div className={`grid min-h-0 flex-1 gap-2 ${approvalTiles.length >= 4 ? "grid-cols-4" : approvalTiles.length === 3 ? "grid-cols-3" : approvalTiles.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {approvalTiles.map((tile) => (
                <Link key={tile.key} href={tile.href} className={`flex h-full flex-col items-center justify-center rounded-sm px-1 py-2 text-center ${tile.className}`}>
                  <span className="[&_svg]:size-4">{tile.icon}</span>
                  <p className="mt-1 text-[18px] font-bold leading-none text-slate-900">{tile.value}</p>
                  <p className="mt-1 text-[11px] leading-tight text-slate-600">{tile.label}</p>
                </Link>
              ))}
            </div>
          </CardShell>
        ) : null}

        {openStat && typeof document !== "undefined"
          ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/45 px-4 pt-[12vh]">
            <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setOpenStat(null)} />
            <div className="emp-home-dashboard relative z-10 flex max-h-[68vh] w-full max-w-lg flex-col rounded-md border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-slate-900">{STAT_LABELS[openStat]}</h3>
                <button type="button" onClick={() => setOpenStat(null)} className="text-sm font-medium text-slate-500">Close</button>
              </div>
              {statList.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">No employees in this group</p>
              ) : (
                <ul className="min-h-0 flex-1 overflow-y-auto">
                  {statList.map((row) => {
                    const checkIn = punchDetail("In", row.inTime, row.inLocation);
                    const checkOut = punchDetail("Out", row.outTime, row.outLocation);
                    return (
                      <li key={row.id} className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-medium text-slate-800">{row.name}</p>
                          {checkIn ? <p className="truncate text-[12px] text-slate-500">{checkIn}</p> : null}
                          {checkOut ? <p className="truncate text-[12px] text-slate-500">{checkOut}</p> : null}
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${statusClass(row.kind)}`}>{statusText(row.kind)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        ) : null}
        <TeamAttendanceRegulariseModal
          open={regulariseTarget != null}
          onOpenChange={(open) => {
            if (!open) setRegulariseTarget(null);
          }}
          employeeId={regulariseTarget?.id ?? null}
          employeeName={regulariseTarget?.name ?? ""}
        />
    </div>
  );
}
