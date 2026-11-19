export const PERSONAL_WIDGET_KEYS = [
  'greeting',
  'my-attendance',
  'notifications',
  'team-attendance',
] as const;

export const COMPANY_WIDGET_KEYS = [
  'total-employees',
  'present-today',
  'absent-today',
  'late-arrivals',
  'on-leave-today',
  'missing-checkout',
  'not-checked-in',
  'attendance-table',
] as const;

const ALL_KEYS = new Set<string>([...PERSONAL_WIDGET_KEYS, ...COMPANY_WIDGET_KEYS]);

export function isKnownWidgetKey(key: string): boolean {
  return ALL_KEYS.has(key);
}

export function isCompanyWidgetKey(key: string): boolean {
  return (COMPANY_WIDGET_KEYS as readonly string[]).includes(key);
}

export type DashboardWidget = {
  instanceId: string;
  widgetKey: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: Record<string, unknown>;
};

export type DashboardLayout = {
  version: 1;
  widgets: DashboardWidget[];
  mobileWidgets?: DashboardWidget[];
};

function widget(
  widgetKey: string,
  x: number,
  y: number,
  w: number,
  h: number,
): DashboardWidget {
  return { instanceId: widgetKey, widgetKey, x, y, w, h };
}

/** Right-hand card that swaps between Team Attendance and Notifications. */
function teamSlot(showTeam: boolean, x: number, y: number, w: number, h: number): DashboardWidget {
  return {
    instanceId: 'team-slot',
    widgetKey: showTeam ? 'team-attendance' : 'notifications',
    x,
    y,
    w,
    h,
    settings: { teamSlot: true },
  };
}

/** Employee home: greeting, my attendance, and the team/notification card. */
export function personalHomeLayout(showTeam = false): DashboardLayout {
  return {
    version: 1,
    widgets: [
      widget('greeting', 0, 0, 8, 5),
      teamSlot(showTeam, 8, 0, 4, 12),
      widget('my-attendance', 0, 5, 8, 7),
    ],
  };
}

/** Owner and director home, matching the arranged company dashboard. */
export function companyHomeLayout(showTeam = true): DashboardLayout {
  return {
    version: 1,
    widgets: [
      widget('greeting', 0, 0, 8, 5),
      teamSlot(showTeam, 8, 0, 4, 9),
      widget('total-employees', 0, 5, 2, 4),
      widget('present-today', 2, 5, 2, 4),
      widget('absent-today', 4, 5, 2, 4),
      widget('not-checked-in', 6, 5, 2, 4),
      widget('my-attendance', 0, 9, 5, 7),
      widget('attendance-table', 5, 9, 7, 7),
    ],
  };
}

export function isTeamSlotWidget(widget: DashboardWidget): boolean {
  if (widget.settings?.teamSlot === true) return true;
  if (widget.instanceId === 'team-slot') return true;
  return widget.instanceId === 'team-attendance';
}

/** Keep the team card in place and only change whether it shows attendance or notifications. */
export function applyTeamSlot(
  layout: DashboardLayout,
  showTeam: boolean,
): { layout: DashboardLayout; changed: boolean } {
  const desired = showTeam ? 'team-attendance' : 'notifications';
  let changed = false;
  const mapWidgets = (widgets: DashboardWidget[]) => {
    const hasExplicit = widgets.some(
      (item) => item.instanceId === 'team-slot' || item.settings?.teamSlot === true,
    );
    return widgets.map((item) => {
      const legacySlot = !hasExplicit && item.instanceId === 'team-attendance';
      const slot = item.instanceId === 'team-slot' || item.settings?.teamSlot === true || legacySlot;
      if (!slot) return item;
      if (item.widgetKey === desired && item.settings?.teamSlot === true) return item;
      changed = true;
      return {
        ...item,
        widgetKey: desired,
        settings: { ...(item.settings || {}), teamSlot: true },
      };
    });
  };
  return {
    changed,
    layout: {
      version: 1,
      widgets: mapWidgets(layout.widgets),
      ...(layout.mobileWidgets?.length ? { mobileWidgets: mapWidgets(layout.mobileWidgets) } : {}),
    },
  };
}

/** Drop Team Attendance and close a full-width gap it left at the top of the grid. */
export function stripTeamAttendanceWidget(layout: DashboardLayout): DashboardLayout {
  const strip = (widgets: DashboardWidget[] | undefined) => {
    if (!widgets?.length) return widgets;
    const team = widgets.find((item) => item.widgetKey === 'team-attendance');
    if (!team) return widgets;
    const rest = widgets.filter((item) => item.widgetKey !== 'team-attendance');
    const fullRow = team.x === 0 && team.w >= 12;
    if (!fullRow) return rest;
    return rest.map((item) =>
      item.y >= team.y + team.h ? { ...item, y: item.y - team.h } : item,
    );
  };
  const widgets = strip(layout.widgets) || [];
  const mobileWidgets = strip(layout.mobileWidgets);
  return {
    version: 1,
    widgets,
    ...(mobileWidgets?.length ? { mobileWidgets } : {}),
  };
}

/** Place Team Attendance on a layout that was saved before it was a widget. */
export function ensureTeamAttendanceWidget(layout: DashboardLayout): DashboardLayout {
  if (layout.widgets.some((item) => item.widgetKey === 'team-attendance')) return layout;
  const height = 12;
  return {
    ...layout,
    widgets: [
      widget('team-attendance', 0, 0, 12, height),
      ...layout.widgets.map((item) => ({ ...item, y: item.y + height })),
    ],
  };
}
