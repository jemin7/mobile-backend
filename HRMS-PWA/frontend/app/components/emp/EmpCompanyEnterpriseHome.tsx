"use client";

import { useEffect, useMemo, useState } from "react";
import { LayoutDashboard } from "lucide-react";
import { CompanyOwnerDashboard } from "@/app/components/emp/CompanyOwnerDashboard";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { authHeaders } from "@/lib/auth";
import { hasCompanyAccessFlag, isCompanyAdminLikeRole, readCompanyAccess } from "@/lib/companyAccess";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useOptionalEmpPortalPageContext } from "@/app/components/layout/emp-portal-page-context";
import { getActiveCompanyId } from "@/app/utils/sidebarContext";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";

const BACKEND = "/backend";

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Company admin enterprise dashboard embedded in the employee portal for owners/grantees. */
export function EmpCompanyEnterpriseHome({ firstName }: { firstName?: string }) {
  const access = readCompanyAccess();
  const user = useCurrentUser();
  const inPortal = Boolean(useOptionalEmpPortalPageContext());
  const canShowCompanyDashboard =
    hasCompanyAccessFlag() ||
    isCompanyAdminLikeRole(user?.role);
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [widgets, setWidgets] = useState<any>(null);
  const [deptRows, setDeptRows] = useState<{ name: string; count: number }[]>([]);
  const [branches, setBranches] = useState<{ id: number; branchName: string }[]>([]);
  const [branchId, setBranchId] = useState("");
  const [monthBoard, setMonthBoard] = useState<{ events: any[]; trend: any[] }>({ events: [], trend: [] });
  const [companyScopeTick, setCompanyScopeTick] = useState(0);

  useEffect(() => {
    const bump = () => setCompanyScopeTick((n) => n + 1);
    window.addEventListener("sidebar-context-changed", bump);
    window.addEventListener("app-data-refresh", bump);
    return () => {
      window.removeEventListener("sidebar-context-changed", bump);
      window.removeEventListener("app-data-refresh", bump);
    };
  }, []);

  useEffect(() => {
    if (!canShowCompanyDashboard) return;
    let cancelled = false;
    const headers = authHeaders();
    let companyID = resolveScopedCompanyId(user) ?? getActiveCompanyId() ?? 0;
    if (!companyID) {
      try {
        const stored = JSON.parse(localStorage.getItem("user") || "{}");
        companyID = Number(stored.activeCompanyID || stored.companyID || 0);
      } catch {
        companyID = 0;
      }
    }
    const q = `${companyID ? `companyID=${companyID}` : ""}${branchId ? `${companyID ? "&" : ""}branchId=${branchId}` : ""}`;
    const query = q ? `?${q}` : "";
    const load = async () => {
      try {
        const [ovRes, wRes, dRes, bRes, mRes] = await Promise.all([
          fetch(`${BACKEND}/dashboard-overview/today-overview${query}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/dashboard-overview/hr-widgets${query}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/departments/with-headcount${query}`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/branches`, { headers, cache: "no-store" }),
          fetch(`${BACKEND}/dashboard-overview/month-board${query}`, { headers, cache: "no-store" }),
        ]);
        if (cancelled) return;
        if (ovRes.ok) setOverview(await ovRes.json());
        if (wRes.ok) setWidgets(await wRes.json());
        if (bRes.ok) {
          const branchRows = await bRes.json();
          setBranches(
            (Array.isArray(branchRows) ? branchRows : [])
              .filter((row: any) => !companyID || Number(row.companyID) === Number(companyID))
              .map((row: any) => ({ id: Number(row.id), branchName: row.branchName || `Branch ${row.id}` })),
          );
        }
        if (mRes.ok) {
          const board = await mRes.json();
          setMonthBoard({
            events: Array.isArray(board?.events) ? board.events : [],
            trend: Array.isArray(board?.trend) ? board.trend : [],
          });
        }
        if (dRes.ok) {
          const rows = await dRes.json();
          setDeptRows(
            (Array.isArray(rows) ? rows : [])
              .filter(
                (r: any) =>
                  !companyID ||
                  Number(r.companyID) === Number(companyID) ||
                  r.companyID == null,
              )
              .map((r: any) => ({
                name: r.departmentName || r.name || "Department",
                count: Number(r.employeeCount ?? r.count ?? 0),
              })),
          );
        }
      } catch {
        /* keep empty dashboard shell */
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [canShowCompanyDashboard, user, companyScopeTick, branchId]);

  const activityItems = useMemo(() => {
    const fromApi = (widgets?.recentActivities ?? []).map((a: any) => {
      const headline =
        a.headline || a.title || a.message || "Activity";
      return {
        id: String(a.id ?? headline),
        headline,
        body: a.body || a.detail || a.description || "",
        time: a.time || "",
        avatarInitial:
          a.avatarInitial ||
          String(headline).trim().charAt(0).toUpperCase() ||
          "A",
        href: a.href,
        kind: a.kind || "system",
      };
    });
    return fromApi.slice(0, 12);
  }, [widgets]);

  const titleName =
    firstName ||
    (user as any)?.employee?.firstName ||
    user?.firstName ||
    access?.ownerTitle ||
    user?.username ||
    "Owner";

  if (!canShowCompanyDashboard) return null;

  const summary = overview?.summary ?? overview;
  const statusCounts = overview?.statusCounts ?? {};
  const statusBreakdown = Array.isArray(overview?.statusBreakdown)
    ? overview.statusBreakdown
    : Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count: Number(count) || 0,
      }));

  const dashboard = (
    <CompanyOwnerDashboard
      branches={branches}
      branchId={branchId}
      onBranchChange={setBranchId}
      summary={summary || {}}
      employees={Array.isArray(overview?.employees) ? overview.employees : []}
      missedCheckout={Array.isArray(overview?.yesterdayMissingCheckout) ? overview.yesterdayMissingCheckout : []}
      events={[
        ...monthBoard.events,
        ...(widgets?.upcomingEvents || []).map((event: any) => ({
          date: String(event.date || "").slice(0, 10),
          kind: event.kind || "event",
          label: event.label || event.title || "Event",
        })),
      ]}
      trend={monthBoard.trend}
    />
  );

  if (!inPortal) return dashboard;

  return (
    <EmpDesktopPage title="Dashboard" icon={LayoutDashboard} className="space-y-0">
      {dashboard}
    </EmpDesktopPage>
  );
}
