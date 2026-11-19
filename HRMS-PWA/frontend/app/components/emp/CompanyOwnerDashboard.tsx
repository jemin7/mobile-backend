"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type EmployeeRow = {
  id: number;
  employeeFirstName?: string;
  employeeLastName?: string;
  statusType?: string;
  statusDisplay?: string;
};

type BoardEvent = { date: string; kind: string; label: string };
type TrendPoint = { date: string; present: number };

const CARD_KEYS = [
  { key: "total", label: "Total Employees" },
  { key: "present", label: "Present Today" },
  { key: "latemark", label: "Latemarks" },
  { key: "absent", label: "Absent" },
  { key: "missed", label: "Yesterday’s Missed Checkout" },
] as const;

function matchesCard(row: EmployeeRow, key: (typeof CARD_KEYS)[number]["key"], missedIds: Set<number>) {
  if (key === "total") return true;
  if (key === "present") return ["PRESENT", "OT", "LATE_MARK", "SINGLE_PUNCH"].includes(String(row.statusType));
  if (key === "latemark") return row.statusType === "LATE_MARK";
  if (key === "absent") return row.statusType === "ABSENT";
  if (key === "missed") return missedIds.has(row.id);
  return false;
}

export function CompanyOwnerDashboard({
  branches,
  branchId,
  onBranchChange,
  summary,
  employees,
  missedCheckout,
  events,
  trend,
}: {
  branches: { id: number; branchName: string }[];
  branchId: string;
  onBranchChange: (value: string) => void;
  summary: { total?: number; present?: number; lateMark?: number; absent?: number; halfDay?: number; onLeave?: number };
  employees: EmployeeRow[];
  missedCheckout: EmployeeRow[];
  events: BoardEvent[];
  trend: TrendPoint[];
}) {
  const [openCard, setOpenCard] = useState<(typeof CARD_KEYS)[number]["key"] | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const missedIds = useMemo(() => new Set(missedCheckout.map((row) => row.id)), [missedCheckout]);
  const counts = {
    total: Number(summary.total || employees.length || 0),
    present: Number(summary.present || 0),
    latemark: Number(summary.lateMark || 0),
    absent: Number(summary.absent || 0),
    missed: missedCheckout.length,
  };
  const pie = [
    { label: "Present", value: Number(summary.present || 0), color: "#16a34a" },
    { label: "Latemark", value: Number(summary.lateMark || 0), color: "#d97706" },
    { label: "Half day", value: Number(summary.halfDay || 0), color: "#0284c7" },
    { label: "Absent", value: Number(summary.absent || 0), color: "#e11d48" },
    { label: "On Leave", value: Number(summary.onLeave || 0), color: "#7c3aed" },
  ];
  const pieTotal = pie.reduce((sum, item) => sum + item.value, 0) || 1;
  let cursor = 0;
  const gradient = pie
    .map((item) => {
      const start = cursor;
      cursor += (item.value / pieTotal) * 360;
      return `${item.color} ${start}deg ${cursor}deg`;
    })
    .join(", ");
  const maxTrend = Math.max(1, ...trend.map((point) => point.present));
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const eventsByDay = useMemo(() => {
    const map = new Map<string, BoardEvent[]>();
    for (const event of events) {
      const list = map.get(event.date) || [];
      list.push(event);
      map.set(event.date, list);
    }
    const todayKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    for (const row of employees) {
      const name = `${row.employeeFirstName || ""} ${row.employeeLastName || ""}`.trim();
      if (row.statusType === "LATE_MARK") {
        const list = map.get(todayKey) || [];
        list.push({ date: todayKey, kind: "latemark", label: `${name} latemark` });
        map.set(todayKey, list);
      }
      if (row.statusType === "SINGLE_PUNCH") {
        const list = map.get(todayKey) || [];
        list.push({ date: todayKey, kind: "missed", label: `${name} missed checkout` });
        map.set(todayKey, list);
      }
      if (String(row.statusType || "").includes("EARLY")) {
        const list = map.get(todayKey) || [];
        list.push({ date: todayKey, kind: "early", label: `${name} early checkout` });
        map.set(todayKey, list);
      }
    }
    return map;
  }, [events, employees, month, today, year]);
  const listed = openCard
    ? openCard === "missed"
      ? missedCheckout
      : employees.filter((row) => matchesCard(row, openCard, missedIds))
    : [];
  const dayEvents = selectedDay ? eventsByDay.get(selectedDay) || [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-medium">
          Branch
          <select
            className="ml-2 h-9 rounded-md border bg-white px-2"
            value={branchId}
            onChange={(event) => onBranchChange(event.target.value)}
          >
            <option value="">All Branches</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.branchName}</option>
            ))}
          </select>
        </label>
        <Link href="/attendance-reports" className="text-sm font-medium text-primary">Attendance reports</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {CARD_KEYS.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setOpenCard(card.key)}
            className="rounded-xl border bg-white p-4 text-left"
          >
            <div className="text-xs text-muted-foreground">{card.label}</div>
            <div className="mt-2 text-2xl font-bold">{counts[card.key]}</div>
          </button>
        ))}
      </div>

      {openCard ? (
        <div className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold">{CARD_KEYS.find((card) => card.key === openCard)?.label}</h3>
            <button type="button" className="text-sm" onClick={() => setOpenCard(null)}>Close</button>
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {listed.length === 0 ? <li className="text-muted-foreground">No employees.</li> : listed.map((row) => (
              <li key={row.id}>{`${row.employeeFirstName || ""} ${row.employeeLastName || ""}`.trim()} · {row.statusDisplay || row.statusType || ""}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">This month</h3>
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {["S", "M", "T", "W", "T", "F", "S"].map((label, index) => <div key={`${label}-${index}`} className="text-muted-foreground">{label}</div>)}
            {Array.from({ length: firstWeekday }).map((_, index) => <div key={`pad-${index}`} />)}
            {Array.from({ length: days }).map((_, index) => {
              const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`;
              const count = eventsByDay.get(date)?.length || 0;
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDay(date)}
                  className={`rounded-md py-2 ${selectedDay === date ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {index + 1}
                  {count > 0 ? <span className="block text-[10px]">{count}</span> : null}
                </button>
              );
            })}
          </div>
          {selectedDay ? (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-sm">
              {dayEvents.length === 0 ? <li className="text-muted-foreground">Nothing on this day.</li> : dayEvents.map((event, index) => (
                <li key={`${event.kind}-${index}`}>{event.label}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 font-semibold">Attendance</h3>
            <div className="flex items-center gap-4">
              <div className="size-28 rounded-full" style={{ background: `conic-gradient(${gradient})` }} />
              <ul className="space-y-1 text-sm">
                {pie.map((item) => (
                  <li key={item.label} className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: item.color }} />
                    {item.label}: {item.value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 font-semibold">Daily attendance</h3>
            <div className="flex h-28 items-end gap-1">
              {trend.map((point) => (
                <div
                  key={point.date}
                  title={`${point.date}: ${point.present}`}
                  className="flex-1 rounded-sm bg-primary/70"
                  style={{ height: `${Math.max(4, (point.present / maxTrend) * 100)}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
