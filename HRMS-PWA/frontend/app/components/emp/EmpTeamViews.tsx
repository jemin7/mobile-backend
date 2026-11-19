"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarCheck2, LayoutGrid, List, MoreVertical, UserCircle, Users } from "lucide-react";
import { useEmpManagerScope } from "@/app/hooks/useEmpManagerScope";
import { reporteeDisplayName } from "@/app/utils/empManagerDisplay";
import { TeamAttendanceRegulariseModal } from "./desktop/TeamAttendanceRegulariseModal";
import { useEmpPortalDesktop } from "@/app/components/layout/EmpPortalShell";
import { EmpTeamApprovalsPanel } from "./EmpTeamApprovalsPanel";
import { EmpDesktopPage } from "./desktop/EmpDesktopPage";
import { FilterBar } from "@/app/components/app/filter-bar";
import { listCardClass, listIconButtonClass } from "@/app/components/app/list-ui-styles";
import { cn } from "@/app/utils/cn";
import { authHeaders } from "@/lib/auth";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

export type TeamMemberRow = {
  id: number;
  employeeID?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
  employeePhotoUrl?: string | null;
  email?: string | null;
  contact?: string | null;
  parentBranch?: string | null;
  department?: string | null;
  designation?: string | null;
  workShift?: string | null;
  attendancePolicy?: string | null;
  leavePolicy?: string | null;
  employmentType?: string | null;
  employmentStatus?: string | null;
  employeeType?: string | null;
  lifecycleStatus?: string | null;
  joiningDate?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  isCheckedIn?: boolean;
  isAbsentToday?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  statusLabel?: string;
};

type TeamScope = "reportees" | "team";
type ViewMode = "grid" | "list";

const TEAM_VIEW_MODE_KEY = "emp-team-view-mode";

function readTeamViewMode(): ViewMode {
  if (typeof window === "undefined") return "list";
  return localStorage.getItem(TEAM_VIEW_MODE_KEY) === "grid" ? "grid" : "list";
}

function memberName(m: TeamMemberRow) {
  return reporteeDisplayName(m);
}

function showValue(value?: string | null) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function MemberActions({
  id,
  onRegularize,
}: {
  id: number;
  onRegularize?: () => void;
}) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label="Member actions"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => router.push(`/empTeam/member/${id}`)}>
          <UserCircle className="size-4" />
          View profile
        </DropdownMenuItem>
        {onRegularize ? (
          <DropdownMenuItem onClick={onRegularize}>
            <CalendarCheck2 className="size-4" />
            Regularize
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MemberAvatar({ member, className }: { member: TeamMemberRow; className?: string }) {
  const name = memberName(member);
  const initials =
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";

  if (member.employeePhotoUrl) {
    return (
      <img
        src={member.employeePhotoUrl}
        alt={name}
        className={cn("rounded-full object-cover bg-muted", className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0",
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function EmpTeamMyTeam() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDesktop = useEmpPortalDesktop();
  const { loading, isManagerView } = useEmpManagerScope();
  const initialScope: TeamScope =
    searchParams.get("scope") === "team" ? "team" : "reportees";
  const [scope, setScope] = useState<TeamScope>(initialScope);
  const [viewMode, setViewMode] = useState<ViewMode>(() => readTeamViewMode());
  const [searchQuery, setSearchQuery] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [designationFilter, setDesignationFilter] = useState("");
  const [members, setMembers] = useState<TeamMemberRow[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [regulariseTarget, setRegulariseTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    const nextScope: TeamScope = searchParams.get("scope") === "team" ? "team" : "reportees";
    setScope(nextScope);
  }, [searchParams]);

  const selectViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem(TEAM_VIEW_MODE_KEY, mode);
    }
  };

  useEffect(() => {
    if (loading) return;
    setStatusLoading(true);
    const url = !isManagerView
      ? `${BACKEND}/emp-manager-scope/department-peers`
      : scope === "reportees"
        ? `${BACKEND}/emp-manager-scope/reportees-today-status`
        : `${BACKEND}/emp-manager-scope/team-today-status?scope=team`;

    fetch(url, { headers: authHeaders(), cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const list =
          isManagerView && scope === "reportees"
            ? Array.isArray(data?.reportees)
              ? data.reportees
              : []
            : Array.isArray(data?.members)
              ? data.members
              : [];
        setMembers(list);
      })
      .finally(() => setStatusLoading(false));
  }, [isManagerView, scope, loading]);

  const directCount = useMemo(
    () => (scope === "reportees" ? members.length : null),
    [scope, members.length],
  );

  const branchOptions = useMemo(
    () => [...new Set(members.map((m) => m.parentBranch).filter((value): value is string => !!value))].sort(),
    [members],
  );
  const departmentOptions = useMemo(
    () => [...new Set(members.map((m) => m.department).filter((value): value is string => !!value))].sort(),
    [members],
  );
  const designationOptions = useMemo(
    () => [...new Set(members.map((m) => m.designation).filter((value): value is string => !!value))].sort(),
    [members],
  );

  const filteredMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (branchFilter && m.parentBranch !== branchFilter) return false;
      if (departmentFilter && m.department !== departmentFilter) return false;
      if (designationFilter && m.designation !== designationFilter) return false;
      if (!q) return true;
      const name = memberName(m).toLowerCase();
      const id = (m.employeeID || String(m.id)).toLowerCase();
      const email = (m.email || "").toLowerCase();
      const designation = (m.designation || "").toLowerCase();
      return name.includes(q) || id.includes(q) || email.includes(q) || designation.includes(q);
    });
  }, [members, searchQuery, branchFilter, departmentFilter, designationFilter]);

  const setScopeAndUrl = (next: TeamScope) => {
    setScope(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "team") params.set("scope", "team");
    else params.delete("scope");
    const qs = params.toString();
    router.replace(qs ? `/empTeam/my-team?${qs}` : "/empTeam/my-team");
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Loading team…</p>;
  }

  const wide = isManagerView;
  const columns: { label: string; value: (m: TeamMemberRow) => string }[] = [
    { label: "Employee ID", value: (m) => showValue(m.employeeID || String(m.id)) },
    { label: "Parent Branch", value: (m) => showValue(m.parentBranch) },
    { label: "Department", value: (m) => showValue(m.department) },
    { label: "Designation", value: (m) => showValue(m.designation) },
    { label: "Work shift", value: (m) => showValue(m.workShift) },
  ];

  const body = (
    <div className="space-y-4 page-content-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {wide ? (
        <div
          role="tablist"
          aria-label="Team scope"
          className="inline-flex rounded-lg border border-border bg-muted/40 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={scope === "reportees"}
            onClick={() => setScopeAndUrl("reportees")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              scope === "reportees"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            My Reportees
            {directCount != null ? ` (${directCount})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "team"}
            onClick={() => setScopeAndUrl("team")}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              scope === "team"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            My Team{scope === "team" ? ` (${members.length})` : ""}
          </button>
        </div>
        ) : null}
      </div>

      <FilterBar
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: "Search by name, ID, email…",
        }}
        filters={
          <>
            <select data-hrms-list-control className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Branch">
              <option value="">All branches</option>
              {branchOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select data-hrms-list-control className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} aria-label="Department">
              <option value="">All departments</option>
              {departmentOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <select data-hrms-list-control className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={designationFilter} onChange={(e) => setDesignationFilter(e.target.value)} aria-label="Designation">
              <option value="">All designations</option>
              {designationOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </>
        }
        trailing={
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              aria-label="Grid view"
              title="Grid view"
              onClick={() => selectViewMode("grid")}
              className={cn(listIconButtonClass, viewMode === "grid" && "bg-muted text-foreground")}
            >
              <LayoutGrid className="size-4" strokeWidth={1.75} />
            </button>
            <button
              type="button"
              aria-label="List view"
              title="List view"
              onClick={() => selectViewMode("list")}
              className={cn(listIconButtonClass, viewMode === "list" && "bg-muted text-foreground")}
            >
              <List className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        }
      />

      {statusLoading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading team members…</p>
      ) : members.length === 0 ? (
        <div className={cn(listCardClass, "p-8 text-center text-muted-foreground")}>
          {!wide
            ? "No other employees in your department."
            : scope === "reportees"
              ? "No reportees linked yet. Assign team members from the employee form in admin."
              : "No team members who report to your reportees yet."}
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className={cn(listCardClass, "p-8 text-center text-muted-foreground")}>
          No employees match &ldquo;{searchQuery.trim()}&rdquo;.
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredMembers.map((m) => {
            const name = memberName(m);
            return (
              <div key={m.id} className={cn(listCardClass, "relative p-4")}>
                <div className="absolute right-2 top-2">
                  <MemberActions
                    id={m.id}
                    onRegularize={wide ? () => setRegulariseTarget({ id: m.id, name }) : undefined}
                  />
                </div>
                <div className="flex items-start gap-3 pr-8">
                  <MemberAvatar member={m} className="size-12 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">{name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{showValue(m.employeeID)}</p>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {columns.filter((col) => col.label !== "Employee ID").map((col) => (
                    <div key={col.label} className="min-w-0">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{col.label}</dt>
                      <dd className="truncate text-xs text-foreground">{col.value(m)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={cn(listCardClass, "min-w-0 max-w-full")}>
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-max min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left" data-hrms-table-header>
                  <th className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Employee ID
                  </th>
                  {columns.filter((col) => col.label !== "Employee ID").map((col) => (
                    <th key={col.label} className="whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((m) => {
                  const name = memberName(m);
                  return (
                    <tr key={m.id} className="border-b border-border transition-colors last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex min-w-[180px] items-center gap-3">
                          <MemberAvatar member={m} className="size-10 text-xs" />
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-muted-foreground">{showValue(m.employeeID)}</p>
                            <p className="truncate font-medium text-foreground">{name}</p>
                          </div>
                        </div>
                      </td>
                      {columns.filter((col) => col.label !== "Employee ID").map((col) => (
                        <td key={col.label} className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {col.value(m)}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <MemberActions
                          id={m.id}
                          onRegularize={wide ? () => setRegulariseTarget({ id: m.id, name }) : undefined}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-border px-6 py-3 text-[13px] text-muted-foreground">
            Showing {filteredMembers.length} of {members.length}{" "}
            {members.length === 1 ? "record" : "records"}
          </div>
        </div>
      )}
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

  if (isDesktop) {
    return (
      <EmpDesktopPage title="My Team" description="View and manage your team members" icon={Users} className="min-w-0 max-w-full overflow-x-hidden">
        {body}
      </EmpDesktopPage>
    );
  }

  return body;
}

export function EmpTeamApprovalsHub() {
  return <EmpTeamApprovalsPanel />;
}
