"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { toast } from "sonner";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { isTeamMemberId, nameForEmployeeId, reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { formatPunchTime } from "@/app/utils/empAttendanceHistory";
import { getDisplayLeaveStatus, getDisplayLeaveType } from "@/app/utils/leaveDisplay";
import { displayStatusLabel, isPartiallyApprovedStatus } from "@/app/utils/statusDisplay";
import { canViewProductModule, useProductAccess } from "@/lib/productAccess";
import { isCompanyOwnerFlag } from "@/lib/companyAccess";
import type { LeaveAppRow } from "./EmpLeaveMobile";
import { totalAmount, type ReimbursementRow } from "./EmpReimbursementMobile";
import { EmpTeamApprovalDialog, type TeamApprovalType } from "./EmpTeamApprovalDialog";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

type TabId = "members" | "leave" | "reimbursement" | "advance" | "regularisation";
type MemberScope = "reportees" | "team";

type MemberRow = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeePhotoUrl?: string | null;
  designation?: string | null;
  checkInTime?: string | null;
  statusLabel?: string;
};

type AdvanceRow = {
  id: string;
  manageEmployeeID?: number;
  manageEmployee?: LeaveAppRow["manageEmployee"];
  advanceAmount?: string;
  reason?: string;
  status?: string;
  createdAt?: string | null;
};

type RegularisationRow = {
  id: string;
  manageEmployeeID?: number;
  employeeId?: string;
  employeeName: string;
  attendanceDate: string;
  actualStatus: string;
  requestedStatus: string;
  reason: string;
  status: string;
};

type PendingAssignment = {
  approvalRequest?: {
    id: number;
    subjectID?: number | string;
    subjectType?: string;
    status?: string;
  };
  approvalRequestStep?: { canRejectSnapshot?: boolean };
};

function authHeaders(json = false): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token") || localStorage.getItem("accessToken") || ""
      : "";
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function leaveTypeText(row: LeaveAppRow) {
  const display = getDisplayLeaveType(row);
  if (display !== "—") return display;
  const raw = (row.appliedLeaveType || "").replace(/_/g, " ").trim();
  if (!raw) return "—";
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return String(value).slice(0, 10);
}

function moneyLabel(value?: string | number | null) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toFixed(2)}`;
}

function personName(
  manageEmployeeID?: number,
  manageEmployee?: LeaveAppRow["manageEmployee"],
  scope?: Parameters<typeof nameForEmployeeId>[0],
) {
  if (manageEmployee) {
    const name = [manageEmployee.employeeFirstName, manageEmployee.employeeLastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return nameForEmployeeId(scope ?? null, manageEmployeeID) || "Team member";
}

function statusClass(label: string) {
  const value = label.toLowerCase();
  if (value.includes("pending") || value.includes("yet")) return "text-blue-700 bg-blue-50 border-blue-100";
  if (value.includes("reject") || value.includes("absent")) return "text-red-700 bg-red-50 border-red-100";
  if (value.includes("partial") || value.includes("checked out")) return "text-amber-700 bg-amber-50 border-amber-100";
  if (value.includes("approv") || value.includes("checked in")) return "text-emerald-700 bg-emerald-50 border-emerald-100";
  return "text-gray-600 bg-gray-50 border-gray-100";
}

function isAttendanceSubject(type?: string) {
  return ["ATTENDANCE_REGULARISATION", "ATTENDANCE_REGULARIZATION", "ATTENDANCE_REGULARISE"].includes(
    String(type || "").trim().toUpperCase(),
  );
}

export function EmpTeamMobile() {
  const router = useRouter();
  const user = useCurrentUser();
  const { scope, loading: scopeLoading, canUseTeamAttendance } = useEmpManagerScope();
  useProductAccess();
  const [tab, setTab] = useState<TabId>("members");
  const [memberScope, setMemberScope] = useState<MemberScope>("reportees");
  const [search, setSearch] = useState("");
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [leaves, setLeaves] = useState<LeaveAppRow[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementRow[]>([]);
  const [advances, setAdvances] = useState<AdvanceRow[]>([]);
  const [regularisations, setRegularisations] = useState<RegularisationRow[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<TeamApprovalType>("leave");
  const [selectedLeave, setSelectedLeave] = useState<LeaveAppRow | null>(null);
  const [selectedReimbId, setSelectedReimbId] = useState<string | null>(null);

  const leaveEnabled = canViewProductModule("LEAVE_MODULE");
  const reimbEnabled = canViewProductModule("REIMBURSEMENT_MODULE");
  const advanceEnabled = canViewProductModule("LOAN_ADVANCE_MODULE");
  const regularisationEnabled = canViewProductModule("REGULARISATION_MODULE");

  const tabs = useMemo(() => {
    const items: { id: TabId; label: string }[] = [{ id: "members", label: "Members" }];
    if (leaveEnabled) items.push({ id: "leave", label: "Leave" });
    if (reimbEnabled) items.push({ id: "reimbursement", label: "Reimbursement" });
    if (advanceEnabled) items.push({ id: "advance", label: "Loan" });
    if (regularisationEnabled) items.push({ id: "regularisation", label: "Regularization" });
    return items;
  }, [leaveEnabled, reimbEnabled, advanceEnabled, regularisationEnabled]);

  useEffect(() => {
    if (!tabs.some((item) => item.id === tab)) setTab("members");
  }, [tabs, tab]);

  useEffect(() => {
    if (!user?.username) return;
    fetch(`${BACKEND}/manage-emp/credentials/${encodeURIComponent(user.username)}`, {
      headers: authHeaders(),
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json().catch(() => null) : null))
      .then((creds) => {
        const id = creds?.employee?.id;
        setEmployeeId(id ? Number(id) : null);
      })
      .catch(() => setEmployeeId(null));
  }, [user?.username]);

  useEffect(() => {
    if (scopeLoading || !canUseTeamAttendance) {
      if (!scopeLoading) setMembersLoading(false);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    const url =
      memberScope === "reportees"
        ? `${BACKEND}/emp-manager-scope/reportees-today-status`
        : `${BACKEND}/emp-manager-scope/team-today-status?scope=team`;
    fetch(url, { headers: authHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = memberScope === "reportees" ? data?.reportees : data?.members;
        setMembers(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canUseTeamAttendance, memberScope, scopeLoading]);

  const loadRecords = useCallback(async (empId: number) => {
    setRecordsLoading(true);
    try {
      const [leaveRes, reimbRes, advanceRes, regularRes, pendingRes] = await Promise.all([
        fetch(`${BACKEND}/leave-application/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/reimbursement/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/salary-advance/employee/${empId}`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/emp-attendance-regularise`, { headers: authHeaders(), cache: "no-store" }),
        fetch(`${BACKEND}/approval-requests/my-pending`, { headers: authHeaders(), cache: "no-store" }),
      ]);
      const leaveData = leaveRes.ok ? await leaveRes.json() : [];
      const reimbData = reimbRes.ok ? await reimbRes.json() : [];
      const advanceData = advanceRes.ok ? await advanceRes.json() : [];
      const regularData = regularRes.ok ? await regularRes.json().catch(() => []) : [];
      const pendingData = pendingRes.ok ? await pendingRes.json().catch(() => []) : [];

      setLeaves(
        (Array.isArray(leaveData) ? leaveData : []).map((row: LeaveAppRow & { fromDate?: string; toDate?: string }) => ({
          ...row,
          id: String(row.id),
          fromDate: row.fromDate ? String(row.fromDate).slice(0, 10) : "",
          toDate: row.toDate ? String(row.toDate).slice(0, 10) : "",
          status: row.status || "Pending",
          createdAt: row.createdAt || "",
        })),
      );
      setReimbursements(
        (Array.isArray(reimbData) ? reimbData : []).map((row: ReimbursementRow & { items?: ReimbursementRow["items"] }) => ({
          ...row,
          id: String(row.id),
          date: row.date || "",
          status: row.status || "Pending",
          amount: totalAmount({ ...row, id: String(row.id), amount: row.amount || 0 }),
        })),
      );
      setAdvances(
        (Array.isArray(advanceData) ? advanceData : []).map((row: AdvanceRow) => ({
          ...row,
          id: String(row.id),
          status: row.status || "Pending",
        })),
      );
      setRegularisations(
        (Array.isArray(regularData) ? regularData : []).map((row: Record<string, unknown>) => {
          const employee = row.manageEmployee as LeaveAppRow["manageEmployee"] | undefined;
          return {
            id: String(row.id),
            manageEmployeeID: row.manageEmployeeID as number | undefined,
            employeeId: employee?.employeeID || "",
            employeeName: personName(row.manageEmployeeID as number | undefined, employee),
            attendanceDate: row.attendanceDate ? String(row.attendanceDate).slice(0, 10) : "",
            actualStatus: String(row.actualStatus || ""),
            requestedStatus: String(row.requestedStatus || ""),
            reason: String(row.reason || ""),
            status: String(row.status || "Pending"),
          };
        }),
      );
      const pendingRows = Array.isArray(pendingData)
        ? pendingData
        : Array.isArray(pendingData?.data)
          ? pendingData.data
          : [];
      setPendingAssignments(
        pendingRows.filter((row: PendingAssignment) => isAttendanceSubject(row.approvalRequest?.subjectType)),
      );
    } finally {
      setRecordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!employeeId || !canUseTeamAttendance) {
      if (!scopeLoading) setRecordsLoading(false);
      return;
    }
    void loadRecords(employeeId);
  }, [employeeId, canUseTeamAttendance, scopeLoading, loadRecords]);

  const query = search.trim().toLowerCase();
  const matches = (...parts: Array<string | number | null | undefined>) => {
    if (!query) return true;
    return parts.some((part) => String(part || "").toLowerCase().includes(query));
  };

  const visibleMembers = members.filter((member) =>
    matches(reporteeDisplayName(member), member.employeeID, member.designation, member.statusLabel),
  );
  const visibleLeaves = leaves.filter(
    (row) =>
      isTeamMemberId(scope, row.manageEmployeeID) &&
      matches(personName(row.manageEmployeeID, row.manageEmployee, scope), leaveTypeText(row), getDisplayLeaveStatus(row.status, row.dayStatuses), row.purpose, row.fromDate, row.toDate),
  );
  const visibleReimbursements = reimbursements.filter((row) => {
    const category = (row.items || []).map((item) => item.reimbursementType).filter(Boolean).join(", ");
    return (
      isTeamMemberId(scope, row.manageEmployeeID) &&
      matches(personName(row.manageEmployeeID, row.manageEmployee, scope), category, displayStatusLabel(row.status), row.date, moneyLabel(totalAmount(row)))
    );
  });
  const visibleAdvances = advances.filter(
    (row) =>
      isTeamMemberId(scope, row.manageEmployeeID) &&
      matches(personName(row.manageEmployeeID, row.manageEmployee, scope), row.reason, displayStatusLabel(row.status), moneyLabel(row.advanceAmount)),
  );
  const visibleRegularisations = regularisations.filter(
    (row) =>
      isTeamMemberId(scope, row.manageEmployeeID) &&
      matches(row.employeeName, row.employeeId, row.attendanceDate, row.actualStatus, row.requestedStatus, row.reason, row.status),
  );

  const assignmentFor = (id: string) =>
    pendingAssignments.find(
      (row) =>
        Number(row.approvalRequest?.subjectID) === Number(id) &&
        row.approvalRequest?.status === "PENDING" &&
        row.approvalRequest?.id,
    ) || null;

  const decideAdvance = async (id: string, status: "Approved" | "Rejected") => {
    const res = await fetch(`${BACKEND}/salary-advance/${id}`, {
      method: "PATCH",
      headers: authHeaders(true),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("Could not update this loan advance");
      return;
    }
    if (employeeId) void loadRecords(employeeId);
  };

  const decideRegularisation = async (id: string, action: "approve" | "reject") => {
    const assignment = assignmentFor(id);
    if (!assignment?.approvalRequest?.id || isCompanyOwnerFlag()) {
      toast.error("This regularisation is not currently assigned to you");
      return;
    }
    let remark = "Attendance regularisation approved";
    if (action === "reject") {
      if (assignment.approvalRequestStep?.canRejectSnapshot === false) {
        toast.error("You are not allowed to reject this regularisation");
        return;
      }
      const reason = window.prompt("Enter rejection reason:");
      if (reason == null) return;
      remark = reason.trim();
      if (!remark) {
        toast.error("Rejection reason is required");
        return;
      }
    }
    const res = await fetch(`${BACKEND}/approval-requests/${assignment.approvalRequest.id}/${action}`, {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify({ remark }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(result?.message || "Could not update this regularisation");
      return;
    }
    toast.success(action === "approve" ? "Approval recorded" : "Regularisation rejected");
    if (employeeId) void loadRecords(employeeId);
  };

  const openReview = (kind: TeamApprovalType, row: LeaveAppRow | ReimbursementRow) => {
    if (kind === "leave") {
      setDialogType("leave");
      setSelectedLeave(row as LeaveAppRow);
      setSelectedReimbId(null);
    } else {
      setDialogType("reimbursement");
      setSelectedReimbId(row.id);
      setSelectedLeave(null);
    }
    setDialogOpen(true);
    setMenuKey(null);
  };

  if (scopeLoading) {
    return <p className="px-4 py-8 text-center text-sm text-gray-500">Loading team…</p>;
  }

  if (!canUseTeamAttendance) {
    return (
      <div className="px-4 py-8">
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">
          You do not have team management access.
        </div>
      </div>
    );
  }

  const listLoading = tab === "members" ? membersLoading : recordsLoading;
  const emptyCopy =
    tab === "members"
      ? memberScope === "reportees"
        ? "No reportees linked yet."
        : "No team members yet."
      : "Nothing to review.";

  return (
    <div className="flex min-h-full flex-col pb-24">
      <div className="px-4 pb-3 pt-5">
        <h1 className="text-[22px] font-bold text-gray-900">Team</h1>
        <p className="mt-0.5 text-[12px] text-gray-500">
          Leaves, reimbursements, loans, and regularisation for your team
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              setMenuKey(null);
            }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              tab === item.id ? "bg-[#4f46e5] text-white" : "bg-white text-gray-500 border border-gray-100"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="px-4 pb-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={tab === "members" ? "Search team members…" : "Search requests…"}
          className="h-11 w-full rounded-2xl border border-gray-100 bg-white px-4 text-sm text-gray-900 outline-none"
        />
      </div>

      {tab === "members" ? (
        <div className="flex gap-2 px-4 pb-3">
          {(["reportees", "team"] as MemberScope[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMemberScope(value)}
              className={`rounded-xl px-3 py-1.5 text-[12px] font-semibold ${
                memberScope === value ? "bg-[#eef2ff] text-[#4f46e5]" : "text-gray-500"
              }`}
            >
              {value === "reportees" ? "My Reportees" : "My Team"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 px-4">
        {listLoading ? (
          <p className="py-8 text-center text-sm text-gray-500">Loading…</p>
        ) : tab === "members" && visibleMembers.length === 0 ? (
          <EmptyCard message={query ? "No employees match your search." : emptyCopy} />
        ) : tab === "leave" && visibleLeaves.length === 0 ? (
          <EmptyCard message={query ? "No leave requests match your search." : emptyCopy} />
        ) : tab === "reimbursement" && visibleReimbursements.length === 0 ? (
          <EmptyCard message={query ? "No reimbursements match your search." : emptyCopy} />
        ) : tab === "advance" && visibleAdvances.length === 0 ? (
          <EmptyCard message={query ? "No loan advances match your search." : emptyCopy} />
        ) : tab === "regularisation" && visibleRegularisations.length === 0 ? (
          <EmptyCard message={query ? "No regularisations match your search." : emptyCopy} />
        ) : null}

        {!listLoading && tab === "members"
          ? visibleMembers.map((member) => {
              const name = reporteeDisplayName(member);
              const status = member.statusLabel || "Yet to check-in";
              const checkIn =
                member.checkInTime && status !== "Yet to check-in" ? formatPunchTime(member.checkInTime) : "";
              const open = menuKey === `member-${member.id}`;
              return (
                <article key={member.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <div className="flex items-start justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-gray-400">{member.employeeID || `ID ${member.id}`}</p>
                      <p className="truncate text-sm font-semibold text-gray-900">{name}</p>
                      <p className="truncate text-[12px] text-gray-500">{member.designation || "—"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusClass(status)}`}>
                        {status}
                        {checkIn ? ` · ${checkIn}` : ""}
                      </span>
                      <button
                        type="button"
                        aria-label="Member actions"
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500"
                        onClick={() => setMenuKey(open ? null : `member-${member.id}`)}
                      >
                        <Icon icon="solar:menu-dots-bold" className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  {open ? (
                    <div className="flex border-t border-gray-100 px-2 py-1">
                      <button
                        type="button"
                        className="px-3 py-2 text-[12px] font-semibold text-[#2563eb]"
                        onClick={() => router.push(`/empTeam/member/${member.id}`)}
                      >
                        View profile
                      </button>
                      {regularisationEnabled ? (
                        <button
                          type="button"
                          className="px-3 py-2 text-[12px] font-semibold text-gray-700"
                          onClick={() => router.push("/empTeam/regularisation")}
                        >
                          Regularize
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}

        {!listLoading && tab === "leave"
          ? visibleLeaves.map((row) => {
              const status = getDisplayLeaveStatus(row.status, row.dayStatuses);
              const open = menuKey === `leave-${row.id}`;
              const canReview = status === "Approval Pending" || status === "Cancel Pending";
              return (
                <article key={row.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <CardHead
                    title={personName(row.manageEmployeeID, row.manageEmployee, scope)}
                    status={status}
                    open={open}
                    onMenu={() => setMenuKey(open ? null : `leave-${row.id}`)}
                    lines={[
                      ["Type", leaveTypeText(row)],
                      ["From", dateLabel(row.fromDate)],
                      ["To", dateLabel(row.toDate)],
                      ["Purpose", row.purpose || "—"],
                    ]}
                  />
                  {open && canReview ? (
                    <ActionRow>
                      <button type="button" className="px-3 py-2 text-[12px] font-semibold text-[#2563eb]" onClick={() => openReview("leave", row)}>
                        Review
                      </button>
                    </ActionRow>
                  ) : null}
                </article>
              );
            })
          : null}

        {!listLoading && tab === "reimbursement"
          ? visibleReimbursements.map((row) => {
              const status = displayStatusLabel(row.status);
              const category = (row.items || []).map((item) => item.reimbursementType).filter(Boolean).join(", ");
              const pendingItems = (row.items || []).some((item) => (item.status || "Pending") === "Pending");
              const canReview = row.status === "Pending" || (isPartiallyApprovedStatus(row.status) && pendingItems);
              const open = menuKey === `reimb-${row.id}`;
              return (
                <article key={row.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <CardHead
                    title={personName(row.manageEmployeeID, row.manageEmployee, scope)}
                    status={status}
                    open={open}
                    onMenu={() => setMenuKey(open ? null : `reimb-${row.id}`)}
                    lines={[
                      ["Date", dateLabel(row.date)],
                      ["Amount", moneyLabel(totalAmount(row))],
                      ["Category", category || row.reimbursementType || "—"],
                    ]}
                  />
                  {open && canReview ? (
                    <ActionRow>
                      <button type="button" className="px-3 py-2 text-[12px] font-semibold text-[#2563eb]" onClick={() => openReview("reimbursement", row)}>
                        Review
                      </button>
                    </ActionRow>
                  ) : null}
                </article>
              );
            })
          : null}

        {!listLoading && tab === "advance"
          ? visibleAdvances.map((row) => {
              const status = displayStatusLabel(row.status);
              const canDecide = (row.status || "Pending") === "Pending";
              const open = menuKey === `advance-${row.id}`;
              return (
                <article key={row.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <CardHead
                    title={personName(row.manageEmployeeID, row.manageEmployee, scope)}
                    status={status}
                    open={open}
                    onMenu={() => setMenuKey(open ? null : `advance-${row.id}`)}
                    lines={[
                      ["Amount", moneyLabel(row.advanceAmount)],
                      ["Reason", row.reason || "—"],
                      ["Created", dateLabel(row.createdAt)],
                    ]}
                  />
                  {open && canDecide ? (
                    <ActionRow>
                      <button type="button" className="px-3 py-2 text-[12px] font-semibold text-red-600" onClick={() => void decideAdvance(row.id, "Rejected")}>
                        Reject
                      </button>
                      <button type="button" className="px-3 py-2 text-[12px] font-semibold text-emerald-700" onClick={() => void decideAdvance(row.id, "Approved")}>
                        Approve
                      </button>
                    </ActionRow>
                  ) : null}
                </article>
              );
            })
          : null}

        {!listLoading && tab === "regularisation"
          ? visibleRegularisations.map((row) => {
              const assignment = assignmentFor(row.id);
              const canReview = !!assignment && !isCompanyOwnerFlag() && row.status === "Pending";
              const open = menuKey === `reg-${row.id}`;
              const change = [row.actualStatus, row.requestedStatus].filter(Boolean).join(" → ") || "—";
              return (
                <article key={row.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <CardHead
                    title={row.employeeName}
                    status={displayStatusLabel(row.status)}
                    open={open}
                    onMenu={() => setMenuKey(open ? null : `reg-${row.id}`)}
                    lines={[
                      ["Employee ID", row.employeeId || "—"],
                      ["Date", dateLabel(row.attendanceDate)],
                      ["Requested", change],
                      ["Reason", row.reason || "—"],
                    ]}
                  />
                  {open && canReview ? (
                    <ActionRow>
                      {assignment?.approvalRequestStep?.canRejectSnapshot !== false ? (
                        <button type="button" className="px-3 py-2 text-[12px] font-semibold text-red-600" onClick={() => void decideRegularisation(row.id, "reject")}>
                          Reject
                        </button>
                      ) : null}
                      <button type="button" className="px-3 py-2 text-[12px] font-semibold text-emerald-700" onClick={() => void decideRegularisation(row.id, "approve")}>
                        Approve
                      </button>
                    </ActionRow>
                  ) : null}
                </article>
              );
            })
          : null}
      </div>

      <EmpTeamApprovalDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        type={dialogType}
        onTypeChange={setDialogType}
        leaveApplication={selectedLeave}
        reimbursementId={selectedReimbId}
        onDone={() => {
          if (employeeId) void loadRecords(employeeId);
        }}
      />
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500">{message}</div>
  );
}

function ActionRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap border-t border-gray-100 px-2 py-1">{children}</div>;
}

function CardHead({
  title,
  status,
  lines,
  open,
  onMenu,
}: {
  title: string;
  status: string;
  lines: Array<[string, string]>;
  open: boolean;
  onMenu: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1 space-y-0.5 text-[11px] text-gray-600">
        <p className="truncate text-sm font-semibold text-gray-900">{title}</p>
        {lines.map(([label, value]) => (
          <p key={label}>
            <span className="text-gray-400">{label}:</span> {value}
          </p>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${statusClass(status)}`}>
          {status}
        </span>
        <button
          type="button"
          aria-label="Actions"
          aria-expanded={open}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500"
          onClick={onMenu}
        >
          <Icon icon="solar:menu-dots-bold" className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
