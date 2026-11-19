"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/auth";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type OvertimeRow = {
  date: string;
  shiftEnd?: string;
  punchOut?: string;
  otMinutes: number;
};

function readStoredEmployeeId() {
  if (typeof window === "undefined") return 0;
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "{}");
    return Number(stored.employee?.id || stored.employeeId || 0);
  } catch {
    return 0;
  }
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function EmpProfileOvertimeView() {
  const user = useCurrentUser();
  const employeeId = Number(user?.employee?.id || 0) || readStoredEmployeeId();
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`${BACKEND}/overtime/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        employeeIds: [employeeId],
        startDate: monthStart(),
        endDate: today(),
      }),
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data) => {
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading overtime…</p>;
  if (!rows.length) return <p className="text-sm text-muted-foreground">No overtime this month.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Shift end</th>
            <th className="px-4 py-3">Punch out</th>
            <th className="px-4 py-3">OT minutes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.date} className="border-b last:border-0">
              <td className="px-4 py-3">{row.date}</td>
              <td className="px-4 py-3">{row.shiftEnd || "—"}</td>
              <td className="px-4 py-3">{String(row.punchOut || "").slice(11, 19) || "—"}</td>
              <td className="px-4 py-3">{row.otMinutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
