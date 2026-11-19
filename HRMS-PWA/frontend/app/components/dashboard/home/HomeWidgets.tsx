"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Calendar, Clock, LogOut, UserCheck, UserX, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmpTodayStatusCard } from "@/app/components/emp/EmpTodayStatusCard";
import { EmpDesktopAttendancePanel } from "@/app/components/emp/desktop/EmpDesktopAttendancePanel";
import { EmpNotificationsPanel } from "@/app/components/emp/EmpNotificationsPanel";
import { EmpDesktopNotifications } from "@/app/components/emp/desktop/EmpDesktopNotifications";
import { EmpDesktopHomeProfileHero } from "@/app/components/emp/desktop/EmpDesktopHomeProfileHero";
import { EmpDesktopTeamReportees } from "@/app/components/emp/desktop/EmpDesktopTeamReportees";
import type { TodayStatus } from "@/app/hooks/useEmpPunch";
import { employeesForStatus, isNotCheckedIn } from "@/lib/dashboard/home-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";

export type OverviewEmployee = {
  id: number;
  employeeFirstName?: string;
  employeeLastName?: string;
  inTime?: string | null;
  outTime?: string | null;
  statusType?: string;
  statusDisplay?: string;
  hasPunches?: boolean;
};

export type TodayOverview = {
  date?: string;
  yesterday?: string | null;
  summary?: {
    total?: number;
    present?: number;
    absent?: number;
    lateMark?: number;
    onLeave?: number;
    noCheckout?: number;
  };
  employees?: OverviewEmployee[];
  yesterdayMissingCheckout?: OverviewEmployee[];
};

function formatOverviewDate(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

type HomeWidgetData = {
  isMobile: boolean;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
  taskBadge: number;
  noticeBadge: number;
  reimbBadge: number;
  leaveBadge: number;
  onNoticeClick?: () => void;
  empFullName?: string;
  empPhoto?: string | null;
  empInitials?: string;
  designation?: string | null;
  department?: string | null;
  overview: TodayOverview | null;
  overviewLoading: boolean;
  onRefreshOverview: () => void;
};

const HomeWidgetContext = createContext<HomeWidgetData | null>(null);

export function HomeWidgetProvider({
  value,
  children,
}: {
  value: HomeWidgetData;
  children: ReactNode;
}) {
  return <HomeWidgetContext.Provider value={value}>{children}</HomeWidgetContext.Provider>;
}

function useHomeWidget() {
  const value = useContext(HomeWidgetContext);
  if (!value) throw new Error("Home widget is outside its provider");
  return value;
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  iconClass,
  widgetKey,
  dialogNote,
}: {
  label: string;
  value: number | null;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
  widgetKey: string;
  dialogNote?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="widget-action flex h-full min-h-0 w-full items-center justify-between gap-3 bg-white p-4 text-left"
        onClick={() => setOpen(true)}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            {value == null ? "—" : value.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-gray-500">{hint}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-full ${iconClass}`}>
          <Icon className="size-5" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            {dialogNote ? <p className="text-sm text-gray-500">{dialogNote}</p> : null}
          </DialogHeader>
          <StatusPeopleList widgetKey={widgetKey} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function StatusPeopleList({ widgetKey }: { widgetKey: string }) {
  const data = useHomeWidget();
  const rows =
    widgetKey === "missing-checkout"
      ? data.overview?.yesterdayMissingCheckout || []
      : employeesForStatus(widgetKey, data.overview?.employees || []) || [];
  if (data.overviewLoading && !data.overview?.employees) {
    return <p className="text-sm text-gray-500">Loading attendance…</p>;
  }
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No employees for this status.</p>;
  }
  return (
    <ul className="divide-y divide-gray-100">
      {rows.map((row) => {
        const name = [row.employeeFirstName, row.employeeLastName].filter(Boolean).join(" ") || "Employee";
        return (
          <li key={row.id} className="flex items-start justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{name}</p>
              <p className="mt-0.5 text-xs text-gray-500">In {row.inTime || "—"} · Out {row.outTime || "—"}</p>
            </div>
            <span className={`shrink-0 text-xs ${statusClass(row.statusDisplay || row.statusType)}`}>
              {row.statusDisplay || row.statusType || "—"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function summaryValue(overview: TodayOverview | null, key: keyof NonNullable<TodayOverview["summary"]>) {
  if (!overview?.summary) return null;
  const value = overview.summary[key];
  return typeof value === "number" ? value : null;
}

export function HomeWidgetBody({ widgetKey }: { widgetKey: string }) {
  const data = useHomeWidget();
  if (widgetKey === "greeting") {
    return (
      <div className="h-full min-h-0">
        <EmpDesktopHomeProfileHero
          empFullName={data.empFullName || "there"}
          empPhoto={data.empPhoto ?? null}
          empInitials={data.empInitials || "E"}
          designation={data.designation}
          department={data.department}
          todayStatus={data.todayStatus}
          loadingStatus={data.loadingStatus}
          onStatusUpdate={data.onStatusUpdate}
          fill
        />
      </div>
    );
  }
  if (widgetKey === "my-attendance") {
    return data.isMobile ? (
      <div className="h-full overflow-auto bg-[#f8fafc] p-1">
        <EmpTodayStatusCard
          todayStatus={data.todayStatus}
          loading={data.loadingStatus}
          onStatusUpdate={data.onStatusUpdate}
          allowAppPunch
        />
      </div>
    ) : (
      <div className="h-full min-h-0 overflow-auto">
        <EmpDesktopAttendancePanel
          todayStatus={data.todayStatus}
          loading={data.loadingStatus}
          onStatusUpdate={data.onStatusUpdate}
          compact
          showActions
          allowAppPunch
        />
      </div>
    );
  }
  if (widgetKey === "team-attendance") {
    return (
      <div className="h-full min-h-0">
        <EmpDesktopTeamReportees embedded />
      </div>
    );
  }
  if (widgetKey === "notifications") {
    return (
      <div className="h-full min-h-0 overflow-auto bg-white">
        {data.isMobile ? <EmpNotificationsPanel /> : <EmpDesktopNotifications />}
      </div>
    );
  }
  if (widgetKey === "total-employees") {
    return <KpiCard widgetKey="total-employees" label="Total employees" value={summaryValue(data.overview, "total")} hint="Active workforce" icon={Users} iconClass="bg-blue-50 text-blue-600" />;
  }
  if (widgetKey === "present-today") {
    return <KpiCard widgetKey="present-today" label="Present today" value={summaryValue(data.overview, "present")} hint="Checked in under today's rules" icon={UserCheck} iconClass="bg-green-50 text-green-600" />;
  }
  if (widgetKey === "absent-today") {
    return <KpiCard widgetKey="absent-today" label="Absent today" value={summaryValue(data.overview, "absent")} hint="Marked absent for today" icon={UserX} iconClass="bg-red-50 text-red-500" />;
  }
  if (widgetKey === "late-arrivals") {
    return <KpiCard widgetKey="late-arrivals" label="Late arrivals" value={summaryValue(data.overview, "lateMark")} hint="After the scheduled start" icon={Clock} iconClass="bg-amber-50 text-amber-600" />;
  }
  if (widgetKey === "on-leave-today") {
    return <KpiCard widgetKey="on-leave-today" label="On leave today" value={summaryValue(data.overview, "onLeave")} hint="Approved leave" icon={Calendar} iconClass="bg-violet-50 text-violet-600" />;
  }
  if (widgetKey === "missing-checkout") {
    const yesterdayLabel = formatOverviewDate(data.overview?.yesterday);
    const note = yesterdayLabel ? `Checkout missed on ${yesterdayLabel}` : "Yesterday's checkout";
    const count = data.overview?.yesterdayMissingCheckout?.length;
    return (
      <KpiCard
        widgetKey="missing-checkout"
        label="Yesterday's missed checkout"
        value={data.overviewLoading && count == null ? null : count ?? 0}
        hint={note}
        dialogNote={note}
        icon={LogOut}
        iconClass="bg-orange-50 text-orange-500"
      />
    );
  }
  if (widgetKey === "not-checked-in") {
    const count = data.overview?.employees ? data.overview.employees.filter(isNotCheckedIn).length : null;
    return <KpiCard widgetKey="not-checked-in" label="Not checked in" value={data.overviewLoading && count == null ? null : count} hint="Not the same as absent" icon={Clock} iconClass="bg-orange-50 text-orange-500" />;
  }
  if (widgetKey === "attendance-table") return <AttendanceTable />;
  return null;
}

function statusClass(status?: string) {
  const value = String(status || "").toUpperCase();
  if (value.includes("ABSENT")) return "font-medium text-red-600";
  if (value.includes("PRESENT")) return "font-medium text-green-600";
  return "text-gray-700";
}

function AttendanceTable() {
  const data = useHomeWidget();
  const rows = data.overview?.employees || [];
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
        <p className="text-sm font-semibold text-gray-900">Employee attendance</p>
        <button type="button" className="text-xs font-medium text-blue-600" onClick={data.onRefreshOverview}>
          Refresh
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">In</th>
              <th className="px-3 py-2 font-medium">Out</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.overviewLoading && rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={4}>Loading attendance…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-gray-500" colSpan={4}>No employees for today.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-900">
                    {[row.employeeFirstName, row.employeeLastName].filter(Boolean).join(" ") || "Employee"}
                  </td>
                  <td className="px-3 py-2">{row.inTime || "—"}</td>
                  <td className="px-3 py-2">{row.outTime || "—"}</td>
                  <td className={`px-3 py-2 ${statusClass(row.statusDisplay || row.statusType)}`}>
                    {row.statusDisplay || row.statusType || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
