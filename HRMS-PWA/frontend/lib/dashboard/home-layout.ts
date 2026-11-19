export type HomeWidget = {
  instanceId: string;
  widgetKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HomeLayout = {
  version: 1;
  widgets: HomeWidget[];
  mobileWidgets?: HomeWidget[];
};

export function mobileIconLayout(desktop: HomeLayout): HomeLayout {
  return {
    version: 1,
    widgets: desktop.widgets.map((item, index) => ({
      instanceId: item.widgetKey,
      widgetKey: item.widgetKey,
      x: index % 4,
      y: Math.floor(index / 4),
      w: 1,
      h: 1,
    })),
  };
}

export function packMobileWidgets(widgets: HomeWidget[]): HomeWidget[] {
  let x = 0;
  let y = 0;
  return widgets.map((widget) => {
    const card = widget.w >= 4;
    if (card) {
      if (x !== 0) {
        y += 1;
        x = 0;
      }
      const next = { ...widget, x: 0, y, w: 4, h: Math.max(2, Math.min(widget.h, 20)) };
      y += next.h;
      return next;
    }
    const next = { ...widget, x, y, w: 1, h: 1 };
    x += 1;
    if (x >= 4) {
      x = 0;
      y += 1;
    }
    return next;
  });
}

export type HomeLayoutResponse = {
  source: "saved" | "default";
  layout: HomeLayout;
  defaultLayout: HomeLayout;
  canUseCompanyWidgets: boolean;
  canCustomize?: boolean;
  /** Owners, directors, and employees who manage at least one person. */
  canUseTeamAttendance?: boolean;
  /** Company home stays locked. A normal employee gets the fixed card home. */
  homeKind?: "company" | "employee";
};

export const PERSONAL_WIDGETS = [
  { key: "greeting", title: "Greeting", category: "Personal", w: 12, h: 6 },
  { key: "my-attendance", title: "My attendance", category: "Personal", w: 8, h: 10 },
  { key: "notifications", title: "Notifications", category: "Personal", w: 4, h: 14 },
  { key: "team-attendance", title: "Team Attendance", category: "Personal", w: 12, h: 12 },
] as const;

export const COMPANY_WIDGETS = [
  { key: "total-employees", title: "Total employees", category: "Company", w: 3, h: 3 },
  { key: "present-today", title: "Present today", category: "Company", w: 3, h: 3 },
  { key: "absent-today", title: "Absent today", category: "Company", w: 3, h: 3 },
  { key: "late-arrivals", title: "Late arrivals", category: "Company", w: 3, h: 3 },
  { key: "on-leave-today", title: "On leave today", category: "Company", w: 3, h: 3 },
  { key: "missing-checkout", title: "Yesterday's missed checkout", category: "Company", w: 3, h: 3 },
  { key: "not-checked-in", title: "Not checked in", category: "Company", w: 3, h: 3 },
  { key: "attendance-table", title: "Employee attendance", category: "Company", w: 12, h: 8 },
] as const;

export const WIDGET_CATALOG = [...PERSONAL_WIDGETS, ...COMPANY_WIDGETS];

export function widgetTitle(key: string): string {
  return WIDGET_CATALOG.find((item) => item.key === key)?.title || "Widget";
}

const PRESENT_TYPES = new Set(["PRESENT", "LATE_MARK", "OT", "SINGLE_PUNCH"]);
const EXCLUDED_FROM_NOT_CHECKED_IN = new Set(["LEAVE", "WEEK_OFF", "HOLIDAY"]);

export function isNotCheckedIn(row: { statusType?: string; hasPunches?: boolean }): boolean {
  const status = String(row.statusType || "");
  if (EXCLUDED_FROM_NOT_CHECKED_IN.has(status)) return false;
  if (PRESENT_TYPES.has(status)) return false;
  if (row.hasPunches) return false;
  return true;
}

export const STATUS_WIDGET_KEYS = new Set([
  "total-employees",
  "present-today",
  "absent-today",
  "late-arrivals",
  "on-leave-today",
  "missing-checkout",
  "not-checked-in",
]);

const KNOWN_STATUS = new Set([
  "PRESENT",
  "OT",
  "LATE_MARK",
  "SINGLE_PUNCH",
  "ABSENT",
  "LEAVE",
  "WEEK_OFF",
  "HOLIDAY",
  "HALF_DAY",
  "REGULARIZATION",
]);

export function employeesForStatus<T extends { statusType?: string; hasPunches?: boolean }>(
  key: string,
  rows: T[],
): T[] | null {
  if (!STATUS_WIDGET_KEYS.has(key)) return null;
  if (key === "total-employees") return rows;
  if (key === "present-today") {
    return rows.filter((row) => {
      const status = String(row.statusType || "");
      if (PRESENT_TYPES.has(status)) return true;
      if (status === "REGULARIZATION") return !!row.hasPunches;
      if (KNOWN_STATUS.has(status)) return false;
      return !!row.hasPunches;
    });
  }
  if (key === "absent-today") {
    return rows.filter((row) => {
      const status = String(row.statusType || "");
      if (status === "ABSENT") return true;
      if (status === "HALF_DAY") return !row.hasPunches;
      if (status === "REGULARIZATION") return false;
      if (KNOWN_STATUS.has(status)) return false;
      return !row.hasPunches;
    });
  }
  if (key === "late-arrivals") return rows.filter((row) => row.statusType === "LATE_MARK");
  if (key === "on-leave-today") return rows.filter((row) => row.statusType === "LEAVE");
  if (key === "missing-checkout") return rows.filter((row) => row.statusType === "SINGLE_PUNCH");
  return rows.filter((row) => isNotCheckedIn(row));
}
