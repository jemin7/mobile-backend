"use client";

import { LayoutDashboard } from "lucide-react";
import { gridGap } from "../../../dashboard/components/dashboard-ui";
import { cn } from "../../../utils/cn";
import { EmpDesktopHomeProfileHero } from "./EmpDesktopHomeProfileHero";
import { EmpDesktopAttendancePanel } from "./EmpDesktopAttendancePanel";
import { EmpDesktopTeamReportees } from "./EmpDesktopTeamReportees";
import { EmpDesktopNotifications } from "./EmpDesktopNotifications";
import { EmpDesktopPage } from "./EmpDesktopPage";
import type { TodayStatus } from "../../../hooks/useEmpPunch";
import { useEmpManagerScope } from "../../../hooks/useEmpManagerScope";

export function EmpDesktopHomeOverview({
  empFullName,
  empPhoto,
  empInitials,
  designation,
  department,
  todayStatus,
  loadingStatus,
  onStatusUpdate,
}: {
  empFullName: string;
  empPhoto: string | null;
  empInitials: string;
  designation?: string | null;
  department?: string | null;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
  taskBadge: number;
  noticeBadge: number;
  reimbBadge: number;
  leaveBadge: number;
  onNoticeClick?: () => void;
}) {
  const { canUseTeamAttendance } = useEmpManagerScope();

  return (
    <EmpDesktopPage
      title="Home"
      description="Your workspace overview"
      icon={LayoutDashboard}
      className="flex h-full min-h-0 flex-1 flex-col !space-y-0 overflow-hidden"
    >
      <div
        className={cn(
          "grid h-full min-h-0 flex-1 lg:grid-cols-3",
          gridGap,
          "items-stretch",
        )}
      >
        {/* auto / auto / 1fr so attendance always fills remaining height */}
        <div className="lg:col-span-2 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
          <div className="min-h-0 shrink-0">
            <EmpDesktopHomeProfileHero
              empFullName={empFullName}
              empPhoto={empPhoto}
              empInitials={empInitials}
              designation={designation}
              department={department}
              todayStatus={todayStatus}
              loadingStatus={loadingStatus}
              onStatusUpdate={onStatusUpdate}
            />
          </div>

          <div className="min-h-0 h-full">
            <EmpDesktopAttendancePanel
              todayStatus={todayStatus}
              loading={loadingStatus}
              onStatusUpdate={onStatusUpdate}
              compact
              showActions
            />
          </div>
        </div>

        <div className="flex h-full min-h-0 min-w-0 lg:col-span-1">
          {canUseTeamAttendance ? <EmpDesktopTeamReportees /> : <EmpDesktopNotifications />}
        </div>
      </div>
    </EmpDesktopPage>
  );
}
