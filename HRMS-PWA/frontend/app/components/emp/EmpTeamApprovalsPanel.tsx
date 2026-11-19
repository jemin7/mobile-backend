"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle, Plus } from "lucide-react";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId } from "@/app/utils/empManagerDisplay";
import { getDisplayLeaveStatus } from "@/app/utils/leaveDisplay";
import { displayStatusLabel, isPartiallyApprovedStatus } from "@/app/utils/statusDisplay";
import { getPageCache, setPageCache } from "@/app/utils/pageCache";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { EmpTeamApprovalDialog, type TeamApprovalType } from "./EmpTeamApprovalDialog";
import { EmpSelfApprovalRequestInline } from "./EmpSelfApprovalRequestDialog";
import type { LeaveAppRow } from "./EmpLeaveMobile";
import type { ReimbursementRow } from "./EmpReimbursementMobile";
import { totalAmount } from "./EmpReimbursementMobile";
import { Button } from "../ui/button";
import { FilterBar, FilterSelect } from "../app/filter-bar";
import { EntityListShell } from "../app/entity-list-shell";
import type { DataTableColumn } from "../app/data-table";
import { useClientTable, sortRows } from "@/app/hooks/use-client-table";
import { cn } from "@/app/utils/cn";
import { canViewProductModule, useProductAccess } from "@/lib/productAccess";
import { AttendanceRegularisationManagement } from "../../attendance-regularisation/AttendanceRegularisationManagement";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type FilterType = "all" | "leave" | "reimbursement" | "advance" | "regularisation";

type AdvanceRow = {
  id: string;
  manageEmployeeID?: number;
  manageEmployee?: LeaveAppRow["manageEmployee"];
  advanceAmount?: string;
  reason?: string;
  status?: string;
  createdAt?: string | null;
  branches?: { branchName?: string | null } | null;
};

type UnifiedRow =
  | {
      kind: "leave";
      id: string;
      employeeName: string;
      subtitle: string;
      statusLabel: string;
      needsAction: boolean;
      leave: LeaveAppRow;
      isOwn?: boolean;
    }
  | {
      kind: "reimbursement";
      id: string;
      employeeName: string;
      subtitle: string;
      statusLabel: string;
      needsAction: boolean;
      reimb: ReimbursementRow;
      isOwn?: boolean;
    }
  | {
      kind: "advance";
      id: string;
      employeeName: string;
      subtitle: string;
      statusLabel: string;
      needsAction: boolean;
      advance: AdvanceRow;
      isOwn?: boolean;
      /** Shown on the Loan advance tab when this person has no request yet. */
    };

function leaveNeedsAction(status?: string | null, dayStatuses?: unknown): boolean {
  const label = getDisplayLeaveStatus(status, dayStatuses);
  return label === "Approval Pending" || label === "Cancel Pending";
}

function reimbNeedsAction(row: { status?: string | null; items?: { status?: string | null }[] | null }): boolean {
  const hasPendingItems = (row.items || []).some((item) => (item.status || "Pending") === "Pending");
  return row.status === "Pending" || (isPartiallyApprovedStatus(row.status) && hasPendingItems);
}

function statusTone(label: string): string {
  const value = label.toLowerCase();
  if (value.includes("pending")) return "text-amber-600";
  if (value.includes("reject") || value.includes("cancel")) return "text-red-600";
  if (value.includes("partial")) return "text-amber-600";
  if (value.includes("approv")) return "text-emerald-600";
  return "text-muted-foreground";
}

function textOrDash(value?: string | null) {
  const text = (value || "").trim();
  return text || "—";
}

function moneyLabel(value?: string | number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toFixed(2)}`;
}

function leaveTypeLabel(value?: string | null) {
  const text = (value || "").replace(/_/g, " ").trim();
  if (!text) return "—";
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function orgOf(record: any) {
  const employee = record?.manageEmployee;
  return {
    branchName: textOrDash(record?.branches?.branchName || employee?.branches?.branchName),
    departmentName: textOrDash(record?.departments?.departmentName || employee?.departments?.departmentName),
    employeeCode: textOrDash(employee?.employeeID),
    designationName: textOrDash(record?.designations?.designation || employee?.designations?.designation),
  };
}

function approvalCells(row: UnifiedRow) {
  const source = row.kind === "leave" ? row.leave : row.kind === "reimbursement" ? row.reimb : row.advance;
  const org = orgOf(source);
  if (row.kind === "leave") {
    return {
      ...org,
      typeLabel: "Leave",
      leaveType: leaveTypeLabel(row.leave.appliedLeaveType),
      fromLabel: dateLabel(row.leave.fromDate),
      toLabel: dateLabel(row.leave.toDate),
      dateLabel: dateLabel(row.leave.fromDate),
      amountLabel: "—",
      detail: textOrDash(row.leave.purpose),
      createdLabel: dateLabel(row.leave.createdAt),
    };
  }
  if (row.kind === "reimbursement") {
    const categories = (row.reimb.items || []).map((item) => item.reimbursementType).filter(Boolean);
    return {
      ...org,
      typeLabel: "Reimbursement",
      leaveType: "—",
      fromLabel: dateLabel(row.reimb.date),
      toLabel: "—",
      dateLabel: dateLabel(row.reimb.date),
      amountLabel: moneyLabel(totalAmount(row.reimb)),
      detail: textOrDash(categories.join(", ") || row.reimb.reimbursementType),
      createdLabel: dateLabel(row.reimb.createdAt),
    };
  }
  return {
    ...org,
    typeLabel: "Loan & Advances",
    leaveType: "—",
    fromLabel: "—",
    toLabel: "—",
    dateLabel: dateLabel(row.advance.createdAt),
    amountLabel: moneyLabel(row.advance.advanceAmount),
    detail: textOrDash(row.advance.reason),
    createdLabel: dateLabel(row.advance.createdAt),
  };
}

export type EmpApprovalsPanelProps = {
  title?: string;
  description?: string;
  emptyMessage?: string;
  noAccessMessage?: string;
  includeOwnSubmissions?: boolean;
  /** Show "New request" form modal for self leave / reimbursement / promotion requests */
  allowNewRequest?: boolean;
  /** When true, omit nested page header (e.g. inside My Profile workspace). */
  embedded?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function EmpTeamApprovalsPanel({
  title = "Team Approvals",
  description = "Approve leave and reimbursement for your reportees",
  emptyMessage = "No team approvals.",
  noAccessMessage = "You do not have team approval access.",
  includeOwnSubmissions = false,
  allowNewRequest = false,
  embedded = false,
}: EmpApprovalsPanelProps = {}) {
  const isDesktop = useEmpPortalDesktop();
  const user = useCurrentUser();
  const { scope, isManagerView, loading: scopeLoading } = useEmpManagerScope();
  const [filter, setFilter] = useState<FilterType>("all");
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get("type");
    if (type === "leave" || type === "reimbursement" || type === "advance" || type === "regularisation") {
      setFilter(type);
    }
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [designationFilter, setDesignationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const tableSort = useClientTable("employeeName");
  const [leaveApps, setLeaveApps] = useState<LeaveAppRow[]>([]);
  const [reimbRows, setReimbRows] = useState<ReimbursementRow[]>([]);
  const [advanceRows, setAdvanceRows] = useState<AdvanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TeamApprovalType>("leave");
  const [selectedLeave, setSelectedLeave] = useState<LeaveAppRow | null>(null);
  const [selectedReimbId, setSelectedReimbId] = useState<string | null>(null);
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  useProductAccess();
  const leaveEnabled = canViewProductModule("LEAVE_MODULE");
  const reimbEnabled = canViewProductModule("REIMBURSEMENT_MODULE");
  const advanceEnabled = canViewProductModule("LOAN_ADVANCE_MODULE");

  const loadData = useCallback(async (empId: number) => {
    setLoading(true);
    try {
      const [leaveRes, reimbRes, advanceRes] = await Promise.all([
        fetch(`${BACKEND}/leave-application/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/reimbursement/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/salary-advance/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
      ]);
      const leaveData = leaveRes.ok ? await leaveRes.json() : [];
      const reimbData = reimbRes.ok ? await reimbRes.json() : [];
      const advanceData = advanceRes.ok ? await advanceRes.json() : [];

      const mappedLeave = (Array.isArray(leaveData) ? leaveData : []).map((a: any) => ({
        id: String(a.id),
        manageEmployeeID: a.manageEmployeeID,
        manageEmployee: a.manageEmployee,
        fromDate: a.fromDate ? new Date(a.fromDate).toISOString().slice(0, 10) : "",
        toDate: a.toDate ? new Date(a.toDate).toISOString().slice(0, 10) : "",
        purpose: a.purpose,
        status: a.status || "Pending",
        appliedLeaveType: a.appliedLeaveType,
        dayStatuses: a.dayStatuses,
        createdAt: a.createdAt || "",
        branches: a.branches,
        departments: a.departments,
      }));
      if (canViewProductModule("LEAVE_MODULE")) {
        setPageCache("empLeaveApps", mappedLeave);
        setLeaveApps(mappedLeave);
      } else {
        setLeaveApps([]);
      }

      const mappedReimb = (Array.isArray(reimbData) ? reimbData : []).map((r: any) => {
        const items =
          Array.isArray(r.items) && r.items.length > 0
            ? r.items.map((i: any) => ({
                id: i.id,
                reimbursementType: i.reimbursementType,
                amount: i.amount,
                description: i.description,
                status: i.status || "Pending",
              }))
            : [];
        return {
          id: String(r.id),
          date: r.date || "",
          taskProjectID: r.taskProjectID ?? null,
          amount: items.reduce((s: number, i: any) => s + parseFloat(i.amount || "0"), 0),
          status: r.status || "Pending",
          items,
          reimbursementType: r.reimbursementType,
          branches: r.branches,
          departments: r.departments,
          createdAt: r.createdAt,
          manageEmployeeID: r.manageEmployeeID,
          manageEmployee: r.manageEmployee,
        };
      });
      if (canViewProductModule("REIMBURSEMENT_MODULE")) {
        setPageCache("empReimbursements", mappedReimb);
        setReimbRows(mappedReimb);
      } else {
        setReimbRows([]);
      }

      const mappedAdvance = (Array.isArray(advanceData) ? advanceData : []).map((row: any) => ({
        id: String(row.id),
        manageEmployeeID: row.manageEmployeeID,
        manageEmployee: row.manageEmployee,
        advanceAmount: row.advanceAmount,
        reason: row.reason,
        status: row.status || "Pending",
        branches: row.branches,
        createdAt: row.createdAt,
      }));
      if (canViewProductModule("LOAN_ADVANCE_MODULE")) {
        setAdvanceRows(mappedAdvance);
      } else {
        setAdvanceRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`)
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((creds) => {
        const id = creds?.employee?.id;
        if (id) {
          setEmployeeId(id);
          void loadData(id);
        } else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user, loadData]);

  const employeeName = (manageEmployeeID?: number, manageEmployee?: LeaveAppRow["manageEmployee"]) => {
    if (manageEmployee) {
      const n = [manageEmployee.employeeFirstName, manageEmployee.employeeLastName].filter(Boolean).join(" ").trim();
      if (n) return n;
    }
    return nameForEmployeeId(scope, manageEmployeeID) || "Team member";
  };

  const teamLeave = useMemo(
    () => leaveApps.filter((a) => isTeamMemberId(scope, a.manageEmployeeID)),
    [leaveApps, scope],
  );

  const pendingOwnLeave = useMemo(
    () =>
      leaveApps.filter(
        (a) =>
          employeeId != null &&
          a.manageEmployeeID === employeeId &&
          getDisplayLeaveStatus(a.status, a.dayStatuses) === "Approval Pending",
      ),
    [leaveApps, employeeId],
  );

  const teamReimb = useMemo(
    () => reimbRows.filter((r) => isTeamMemberId(scope, r.manageEmployeeID)),
    [reimbRows, scope],
  );

  const teamAdvance = useMemo(
    () => advanceRows.filter((row) => isTeamMemberId(scope, row.manageEmployeeID)),
    [advanceRows, scope],
  );

  const pendingOwnAdvance = useMemo(
    () =>
      advanceRows.filter(
        (row) =>
          employeeId != null &&
          row.manageEmployeeID === employeeId &&
          (row.status || "Pending") === "Pending",
      ),
    [advanceRows, employeeId],
  );

  const pendingOwnReimb = useMemo(
    () =>
      reimbRows.filter((r) => {
        if (employeeId == null || r.manageEmployeeID !== employeeId) return false;
        const hasPendingItems = (r.items || []).some((i) => (i.status || "Pending") === "Pending");
        return r.status === "Pending" || (isPartiallyApprovedStatus(r.status) && hasPendingItems);
      }),
    [reimbRows, employeeId],
  );

  const canReviewTeam = isManagerView;
  const showOwnSubmissions = includeOwnSubmissions || !canReviewTeam;

  const unified: UnifiedRow[] = useMemo(() => {
    const leaveRows: UnifiedRow[] = (canReviewTeam ? teamLeave : []).map((l) => ({
      kind: "leave",
      id: `leave-${l.id}`,
      employeeName: employeeName(l.manageEmployeeID, l.manageEmployee),
      subtitle: `${l.fromDate} → ${l.toDate}${l.purpose ? ` · ${l.purpose}` : ""}`,
      statusLabel: getDisplayLeaveStatus(l.status, l.dayStatuses),
      needsAction: leaveNeedsAction(l.status, l.dayStatuses),
      leave: l,
      isOwn: false,
    }));
    const reimbUnified: UnifiedRow[] = (canReviewTeam ? teamReimb : []).map((r) => ({
      kind: "reimbursement",
      id: `reimb-${r.id}`,
      employeeName: employeeName(r.manageEmployeeID, r.manageEmployee),
      subtitle: `${r.date || "—"} · ₹${totalAmount(r).toFixed(2)}`,
      statusLabel: displayStatusLabel(r.status),
      needsAction: reimbNeedsAction(r),
      reimb: r,
      isOwn: false,
    }));
    const directIds = new Set((scope?.directReporteeIds || []).map(Number));
    const advanceGroup = (employeeId?: number | null) =>
      employeeId != null && directIds.has(Number(employeeId)) ? "Reportee" : "Team member";
    const advanceUnified: UnifiedRow[] = (canReviewTeam ? teamAdvance : []).map((row) => ({
      kind: "advance",
      id: `advance-${row.id}`,
      employeeName: employeeName(row.manageEmployeeID, row.manageEmployee),
      subtitle: `${advanceGroup(row.manageEmployeeID)} · ₹${row.advanceAmount || "0"}${row.reason ? ` · ${row.reason}` : ""}`,
      statusLabel: displayStatusLabel(row.status),
      needsAction: (row.status || "Pending") === "Pending",
      advance: row,
      isOwn: false,
    }));
    const ownLeaveRows: UnifiedRow[] = (showOwnSubmissions ? pendingOwnLeave : []).map((l) => ({
      kind: "leave",
      id: `own-leave-${l.id}`,
      employeeName: "You",
      subtitle: `${l.fromDate} → ${l.toDate}${l.purpose ? ` · ${l.purpose}` : ""}`,
      statusLabel: getDisplayLeaveStatus(l.status, l.dayStatuses),
      needsAction: true,
      leave: l,
      isOwn: true,
    }));
    const ownReimbRows: UnifiedRow[] = (showOwnSubmissions ? pendingOwnReimb : []).map((r) => ({
      kind: "reimbursement",
      id: `own-reimb-${r.id}`,
      employeeName: "You",
      subtitle: `${r.date || "—"} · ₹${totalAmount(r).toFixed(2)}`,
      statusLabel: displayStatusLabel(r.status),
      needsAction: true,
      reimb: r,
      isOwn: true,
    }));
    const ownAdvanceRows: UnifiedRow[] = (showOwnSubmissions ? pendingOwnAdvance : []).map((row) => ({
      kind: "advance",
      id: `own-advance-${row.id}`,
      employeeName: "You",
      subtitle: `₹${row.advanceAmount || "0"}${row.reason ? ` · ${row.reason}` : ""}`,
      statusLabel: displayStatusLabel(row.status),
      needsAction: true,
      advance: row,
      isOwn: true,
    }));
    return [...leaveRows, ...reimbUnified, ...advanceUnified, ...ownLeaveRows, ...ownReimbRows, ...ownAdvanceRows].sort(
      (a, b) => {
        if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
        return a.employeeName.localeCompare(b.employeeName);
      },
    );
  }, [
    canReviewTeam,
    teamLeave,
    teamReimb,
    teamAdvance,
    showOwnSubmissions,
    pendingOwnLeave,
    pendingOwnReimb,
    pendingOwnAdvance,
    scope,
  ]);

  const filtered = unified.filter((row) => {
    if (row.kind === "leave" && !leaveEnabled) return false;
    if (row.kind === "reimbursement" && !reimbEnabled) return false;
    if (row.kind === "advance" && !advanceEnabled) return false;
    return filter === "all" || row.kind === filter;
  });
  const visible = filtered.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      const cells = approvalCells(row);
      const haystack = `${row.employeeName} ${cells.employeeCode} ${cells.branchName} ${cells.departmentName} ${cells.typeLabel} ${cells.leaveType} ${cells.detail} ${cells.amountLabel} ${row.statusLabel}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (statusFilter === "pending" && !row.needsAction) return false;
    if (statusFilter === "done" && row.needsAction) return false;
    const cells = approvalCells(row);
    if (branchFilter !== "all" && cells.branchName !== branchFilter) return false;
    if (departmentFilter !== "all" && cells.departmentName !== departmentFilter) return false;
    if (designationFilter !== "all" && cells.designationName !== designationFilter) return false;
    return true;
  });

  const openReview = (row: UnifiedRow) => {
    if (row.isOwn || row.kind === "advance") return;
    if (row.kind === "leave") {
      setDialogType("leave");
      setSelectedLeave(row.leave);
      setSelectedReimbId(null);
    } else {
      setDialogType("reimbursement");
      setSelectedReimbId(row.reimb.id);
      setSelectedLeave(null);
    }
    setDialogOpen(true);
  };

  const decideAdvance = async (id: string, status: "Approved" | "Rejected") => {
    if (!id) return;
    const res = await fetch(`${BACKEND}/salary-advance/${id}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    if (employeeId) void loadData(employeeId);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
    }
  };

  const sortedRows = sortRows(visible, tableSort.sortBy, tableSort.sortDir, (row, key) => {
    const cells = approvalCells(row);
    if (key === "employeeName") return row.employeeName;
    if (key === "statusLabel") return row.statusLabel;
    return String((cells as Record<string, string>)[key] ?? "");
  });

  const approvalColumns = useMemo((): DataTableColumn<UnifiedRow>[] => {
    const col = (
      key: string,
      header: string,
      value: (row: UnifiedRow) => string,
    ): DataTableColumn<UnifiedRow> => ({
      key,
      header,
      sortable: true,
      cell: (row) => <span className="truncate">{value(row)}</span>,
    });
    const cells = (row: UnifiedRow) => approvalCells(row);
    const shared = [
      col("branchName", "Branch", (row) => cells(row).branchName),
      col("departmentName", "Department", (row) => cells(row).departmentName),
      col("employeeCode", "Employee ID", (row) => cells(row).employeeCode),
      col("employeeName", "Employee", (row) => row.employeeName),
    ];
    const statusCol: DataTableColumn<UnifiedRow> = {
      key: "statusLabel",
      header: "Status",
      sortable: true,
      cell: (row) => <span className={statusTone(row.statusLabel)}>{row.statusLabel}</span>,
    };
    const actionCol: DataTableColumn<UnifiedRow> = {
      key: "action",
      header: "Action",
      align: "right",
      cell: (row) =>
        row.isOwn ? (
          <span className="text-xs font-medium text-amber-600">Awaiting approval</span>
        ) : !row.needsAction ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : row.kind === "advance" ? (
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => void decideAdvance(row.advance.id, "Rejected")}>
              Reject
            </Button>
            <Button type="button" size="sm" onClick={() => void decideAdvance(row.advance.id, "Approved")}>
              Approve
            </Button>
          </div>
        ) : (
          <Button type="button" size="sm" onClick={() => openReview(row)}>
            Review
          </Button>
        ),
    };
    if (filter === "leave") {
      return [
        ...shared,
        col("leaveType", "Leave type", (row) => cells(row).leaveType),
        col("fromLabel", "From", (row) => cells(row).fromLabel),
        col("toLabel", "To", (row) => cells(row).toLabel),
        col("detail", "Purpose", (row) => cells(row).detail),
        statusCol,
        actionCol,
      ];
    }
    if (filter === "reimbursement") {
      return [
        ...shared,
        col("dateLabel", "Date", (row) => cells(row).dateLabel),
        col("amountLabel", "Amount", (row) => cells(row).amountLabel),
        col("detail", "Category", (row) => cells(row).detail),
        statusCol,
        actionCol,
      ];
    }
    if (filter === "advance") {
      return [
        ...shared,
        col("amountLabel", "Amount", (row) => cells(row).amountLabel),
        col("detail", "Reason", (row) => cells(row).detail),
        col("createdLabel", "Created", (row) => cells(row).createdLabel),
        statusCol,
        actionCol,
      ];
    }
    return [
      ...shared,
      col("typeLabel", "Type", (row) => cells(row).typeLabel),
      col("fromLabel", "From / Date", (row) => cells(row).fromLabel),
      col("toLabel", "To", (row) => cells(row).toLabel),
      col("amountLabel", "Amount", (row) => cells(row).amountLabel),
      col("detail", "Details", (row) => cells(row).detail),
      statusCol,
      actionCol,
    ];
  }, [filter, employeeId]);

  const content = newRequestOpen ? (
    <EmpSelfApprovalRequestInline
      open={newRequestOpen}
      onOpenChange={setNewRequestOpen}
      onSubmitted={() => {
        if (employeeId) void loadData(employeeId);
      }}
    />
  ) : (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div className="flex flex-wrap items-center gap-2">
  {(["all", "leave", "reimbursement", "advance"] as FilterType[])
    .filter(
      (f) =>
        f === "all" ||
        (f === "leave" && leaveEnabled) ||
        (f === "reimbursement" && reimbEnabled) ||
        (f === "advance" && advanceEnabled),
    )
    .map((f) => (
    <Button
      key={f}
      type="button"
      size="sm"
      variant={filter === f ? "default" : "outline"}
      onClick={() => setFilter(f)}
    >
      {f === "all" ? "All" : f === "leave" ? "Leave" : f === "reimbursement" ? "Reimbursement" : "Loan & Advances"}
    </Button>
  ))}

  <Button
  type="button"
  size="sm"
  variant={filter === "regularisation" ? "default" : "outline"}
  onClick={() => setFilter("regularisation")}
>
  Regularization
</Button>
</div>
        {allowNewRequest ? (
          <Button type="button" onClick={() => setNewRequestOpen(true)}>
            <Plus className="size-4" />
            New request
          </Button>
        ) : null}
      </div>

      {filter === "regularisation" ? (
        <AttendanceRegularisationManagement embedded />
      ) : loading || scopeLoading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading approvals…</p>
      ) : !canReviewTeam && !showOwnSubmissions ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          {noAccessMessage}
        </div>
      ) : (
        <div className="page-content-enter space-y-4">
          <FilterBar
            search={{
              value: searchQuery,
              onChange: setSearchQuery,
              placeholder: "Search approvals…",
            }}
            filters={
              <>
              <FilterSelect
                id="team-approval-status"
                value={statusFilter}
                onChange={setStatusFilter}
                ariaLabel="Filter by status"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "pending", label: "Needs action" },
                  { value: "done", label: "Completed" },
                ]}
              />
              <FilterSelect
                id="team-approval-branch"
                value={branchFilter}
                onChange={setBranchFilter}
                ariaLabel="Filter by branch"
                options={[{ value: "all", label: "All branches" }, ...[...new Set(filtered.map((row) => approvalCells(row).branchName).filter((name) => name && name !== "—"))].map((name) => ({ value: name, label: name }))]}
              />
              <FilterSelect
                id="team-approval-department"
                value={departmentFilter}
                onChange={setDepartmentFilter}
                ariaLabel="Filter by department"
                options={[{ value: "all", label: "All departments" }, ...[...new Set(filtered.map((row) => approvalCells(row).departmentName).filter((name) => name && name !== "—"))].map((name) => ({ value: name, label: name }))]}
              />
              <FilterSelect
                id="team-approval-designation"
                value={designationFilter}
                onChange={setDesignationFilter}
                ariaLabel="Filter by designation"
                options={[{ value: "all", label: "All designations" }, ...[...new Set(filtered.map((row) => approvalCells(row).designationName).filter((name) => name && name !== "—"))].map((name) => ({ value: name, label: name }))]}
              />
              </>
            }
          />
          <EntityListShell
            title="Team approvals"
            columns={approvalColumns}
            rows={sortedRows}
            rowKey={(row) => row.id}
            isLoading={false}
            sortBy={tableSort.sortBy}
            sortDir={tableSort.sortDir}
            onSort={tableSort.setSort}
            emptyIcon={CheckCircle}
            emptyTitle={
              filter === "leave"
                ? "No leave requests found"
                : filter === "reimbursement"
                  ? "No reimbursements found"
                  : filter === "advance"
                    ? "No loan & advances found"
                    : emptyMessage
            }
            emptyDescription="Try adjusting your search or filters."
          />
        </div>
      )}

      <EmpTeamApprovalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        type={dialogType}
        onTypeChange={setDialogType}
        leaveApplication={selectedLeave}
        reimbursementId={selectedReimbId}
        onDone={() => {
          if (employeeId) void loadData(employeeId);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
          }
        }}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  if (isDesktop) {
    return (
      <EmpDesktopPage title={title} description={description} icon={CheckCircle}>
        {content}
      </EmpDesktopPage>
    );
  }

  return (
    <div className="space-y-4 px-4 py-2">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      {content}
    </div>
  );
}
