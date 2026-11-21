import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

import type { TeamAttendanceMember } from "./api/team";

export type TeamOptionTone = "primary" | "success" | "danger" | "warning";

export type TeamOptionField = "department" | "punchTimes" | "status";

export type TeamOption = {
  id: string;
  title: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  tone: TeamOptionTone;
  fields: TeamOptionField[];
  matches: (member: TeamAttendanceMember) => boolean;
  emptyMessage: string;
};

const isPresent = (member: TeamAttendanceMember) =>
  member.isCheckedIn === true || member.statusLabel === "Checked out";

const isAbsent = (member: TeamAttendanceMember) =>
  member.isAbsentToday === true;

const isOnLeave = (member: TeamAttendanceMember) =>
  member.isOnLeaveToday === true;

const isLateArrival = (member: TeamAttendanceMember) =>
  member.isLateArrival === true;

const isCheckedOut = (member: TeamAttendanceMember) =>
  Boolean(member.checkOutTime) || member.statusLabel === "Checked out";

/**
 * Shared My Team options.
 *
 * Add future categories here instead of rebuilding
 * the dashboard or employee detail screen.
 */
export const TEAM_OPTIONS: TeamOption[] = [
  {
    id: "total",
    title: "Employees",
    subtitle: "All employees in your team",
    icon: "people-outline",
    tone: "primary",
    fields: ["department", "punchTimes", "status"],
    matches: () => true,
    emptyMessage: "No team members found.",
  },
  {
    id: "present",
    title: "Present",
    subtitle: "Employees present today",
    icon: "calendar-outline",
    tone: "success",
    fields: ["department", "punchTimes", "status"],
    matches: isPresent,
    emptyMessage: "No employees present today.",
  },
  {
    id: "absent",
    title: "Absent",
    subtitle: "Employees absent today",
    icon: "person-outline",
    tone: "danger",
    fields: ["department", "status"],
    matches: isAbsent,
    emptyMessage: "No employees marked absent.",
  },
  {
    id: "on-leave",
    title: "On Leave",
    subtitle: "Employees on approved leave today",
    icon: "calendar-outline",
    tone: "warning",
    fields: ["department", "status"],
    matches: isOnLeave,
    emptyMessage: "No employees are on approved leave today.",
  },
  {
    id: "checked-out",
    title: "Checked Out",
    subtitle: "Employees checked out today",
    icon: "log-out-outline",
    tone: "success",
    fields: ["department", "punchTimes", "status"],
    matches: isCheckedOut,
    emptyMessage: "No employees have checked out today.",
  },
];

export function getTeamOption(category?: string | string[]) {
  const selectedCategory = Array.isArray(category) ? category[0] : category;

  return (
    TEAM_OPTIONS.find((option) => option.id === selectedCategory) ??
    TEAM_OPTIONS[0]
  );
}
