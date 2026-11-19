"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import GridLayout from "react-grid-layout";
import { Bell, Calendar, ChevronDown, Clock, LayoutDashboard, LayoutGrid, LogOut, MapPin, Table2, UserCheck, UserX, Users, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { EmpDesktopPage } from "@/app/components/emp/desktop/EmpDesktopPage";
import { authHeaders } from "@/lib/auth";
import { resolveScopedCompanyId } from "@/app/utils/scopeContext";
import { getActiveCompanyId } from "@/app/utils/sidebarContext";
import { useCurrentUser } from "@/app/hooks/useCurrentUser";
import type { TodayStatus } from "@/app/hooks/useEmpPunch";
import {
  WIDGET_CATALOG,
  mobileIconLayout,
  STATUS_WIDGET_KEYS,
  widgetTitle,
  type HomeLayout,
  type HomeLayoutResponse,
  type HomeWidget,
} from "@/lib/dashboard/home-layout";
import { HomeWidgetBody, HomeWidgetProvider, StatusPeopleList, type TodayOverview } from "./HomeWidgets";
import { EmpEmployeeHome } from "./EmpEmployeeHome";
import { EmpTeamDashboard } from "@/app/components/emp/desktop/EmpTeamDashboard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/app/components/ui/dropdown-menu";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "/backend";

const WIDGET_ICONS: Record<string, LucideIcon> = {
  greeting: LayoutDashboard,
  "my-attendance": Clock,
  notifications: Bell,
  "total-employees": Users,
  "present-today": UserCheck,
  "absent-today": UserX,
  "late-arrivals": Clock,
  "on-leave-today": Calendar,
  "missing-checkout": LogOut,
  "not-checked-in": MapPin,
  "attendance-table": Table2,
  "team-attendance": Users,
};

function surfaceDraft(saved: HomeLayout | null, mobile: boolean, fallback: HomeLayout | null): HomeLayout | null {
  if (mobile) {
    if (saved?.mobileWidgets?.length) return { version: 1, widgets: saved.mobileWidgets };
    return fallback ? mobileIconLayout(fallback) : null;
  }
  if (!saved) return null;
  return { version: 1, widgets: saved.widgets };
}

type GridItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
};

export function CustomizableHome({
  isMobile,
  todayStatus,
  loadingStatus,
  onStatusUpdate,
  taskBadge,
  noticeBadge,
  reimbBadge,
  leaveBadge,
  onNoticeClick,
  onUnavailable,
  empFullName,
  empPhoto,
  empInitials,
  designation,
  department,
  onMobileChrome,
  onHomeKind,
}: {
  isMobile: boolean;
  todayStatus: TodayStatus | null;
  loadingStatus: boolean;
  onStatusUpdate: (status: TodayStatus) => void;
  taskBadge: number;
  noticeBadge: number;
  reimbBadge: number;
  leaveBadge: number;
  onNoticeClick?: () => void;
  onUnavailable: () => void;
  empFullName?: string;
  empPhoto?: string | null;
  empInitials?: string;
  designation?: string | null;
  department?: string | null;
  onMobileChrome?: (node: ReactNode | null) => void;
  onHomeKind?: (kind: "company" | "employee") => void;
}) {
  const user = useCurrentUser();
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [canUseCompanyWidgets, setCanUseCompanyWidgets] = useState(false);
  const [canUseTeamAttendance, setCanUseTeamAttendance] = useState(false);
  const [homeView, setHomeView] = useState<"self" | "team">("self");
  const chooseHomeView = (view: "self" | "team") => {
    setHomeView(view);
  };
  useEffect(() => {
    setHomeView("self");
    try {
      sessionStorage.removeItem("entimehr-home-view");
    } catch {
      /* keep the default Self view */
    }
  }, []);
  const [layout, setLayout] = useState<HomeLayout | null>(null);
  const [draft, setDraft] = useState<HomeLayout | null>(null);
  const [defaultLayout, setDefaultLayout] = useState<HomeLayout | null>(null);
  const [overview, setOverview] = useState<TodayOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const widthRef = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(960);
  const failed = useRef(false);
  const unavailableRef = useRef(onUnavailable);
  unavailableRef.current = onUnavailable;

  const loadLayout = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/dashboard-layout`, { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error("layout");
      const data = (await res.json()) as HomeLayoutResponse;
      const teamAllowed = !!data.canUseTeamAttendance;
      const nextLayout = omitTeamAttendance(data.layout, teamAllowed);
      const defaults = omitTeamAttendance(data.defaultLayout || data.layout, teamAllowed);
      if (!nextLayout?.widgets?.length) throw new Error("layout");
      setLayout(nextLayout);
      setDefaultLayout(defaults);
      setDraft(surfaceDraft(nextLayout, isMobile, defaults));
      setCanUseCompanyWidgets(!!data.canUseCompanyWidgets);
      setCanUseTeamAttendance(teamAllowed);
      const kind = data.homeKind === "employee" ? "employee" : "company";
      onHomeKind?.(kind);
      setReady(true);
    } catch {
      if (!failed.current) {
        failed.current = true;
        unavailableRef.current();
      }
    }
  }, [isMobile]);

  useEffect(() => {
    void loadLayout();
  }, [loadLayout]);

  const phoneLayout = layout?.mobileWidgets?.length
    ? { version: 1 as const, widgets: layout.mobileWidgets }
    : defaultLayout
      ? mobileIconLayout(defaultLayout)
      : null;
  const shown = isMobile
    ? (editing ? draft : phoneLayout)
    : (editing ? draft : layout);
  const needsOverview = !!shown?.widgets.some((item) =>
    WIDGET_CATALOG.some((entry) => entry.key === item.widgetKey && entry.category === "Company"),
  );

  const refreshOverview = useCallback(async () => {
    if (!needsOverview) return;
    setOverviewLoading(true);
    try {
      let companyID = resolveScopedCompanyId(user) ?? getActiveCompanyId() ?? 0;
      if (!companyID && typeof window !== "undefined") {
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          companyID = Number(stored.activeCompanyID || stored.companyID || 0);
        } catch {
          companyID = 0;
        }
      }
      const query = companyID ? `?companyID=${companyID}` : "";
      const res = await fetch(`${BACKEND}/dashboard-overview/today-overview${query}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (res.ok) setOverview((await res.json()) as TodayOverview);
    } finally {
      setOverviewLoading(false);
    }
  }, [needsOverview, user]);

  useEffect(() => {
    if (!needsOverview) return;
    void refreshOverview();
    const timer = window.setInterval(() => void refreshOverview(), 45_000);
    return () => window.clearInterval(timer);
  }, [needsOverview, refreshOverview]);

  useEffect(() => {
    const node = widthRef.current;
    if (!node) return;
    const measure = () => setGridWidth(Math.max(320, node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ready, isMobile]);

  const ordered = useMemo(() => {
    const widgets = shown?.widgets || [];
    return [...widgets].sort((a, b) => a.y - b.y || a.x - b.x);
  }, [shown]);

  const gridLayout: GridItem[] = ordered.map((item) => ({
    i: item.instanceId,
    x: item.x,
    y: item.y,
    w: isMobile ? Math.min(4, Math.max(1, item.w)) : item.w,
    h: isMobile ? Math.min(20, Math.max(1, item.h)) : item.h,
    ...(isMobile ? { minW: 1, minH: 1, maxW: 4, maxH: 20 } : {}),
  }));

  const applyGrid = (next: GridItem[]) => {
    setDraft((current) => {
      if (!current) return current;
      const byId = new Map(next.map((item) => [item.i, item]));
      return {
        ...current,
        widgets: current.widgets.map((widget) => {
          const item = byId.get(widget.instanceId);
          if (!item) return widget;
          return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
        }),
      };
    });
  };

  const removeWidget = (instanceId: string) => {
    setDraft((current) =>
      current
        ? { ...current, widgets: current.widgets.filter((item) => item.instanceId !== instanceId) }
        : current,
    );
  };

  const addWidget = (key: string) => {
    if (key === "team-attendance" && !canUseTeamAttendance) return;
    const spec = WIDGET_CATALOG.find((item) => item.key === key);
    setDraft((current) => {
      if (!current || !spec) return current;
      if (current.widgets.some((item) => item.widgetKey === key)) return current;
      const y = current.widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0);
      const widget: HomeWidget = isMobile
        ? { instanceId: key, widgetKey: key, x: 0, y, w: 1, h: 1 }
        : { instanceId: key, widgetKey: key, x: 0, y, w: spec.w, h: spec.h };
      return { ...current, widgets: [...current.widgets, widget] };
    });
    setCatalogOpen(false);
  };

  const save = async () => {
    if (!draft || draft.widgets.length === 0) {
      setError("Add at least one widget.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND}/dashboard-layout`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          surface: isMobile ? "mobile" : "desktop",
          layout: { version: 1, widgets: draft.widgets },
        }),
      });
      if (!res.ok) throw new Error("save");
      const data = (await res.json()) as { layout: HomeLayout; canUseTeamAttendance?: boolean };
      const teamAllowed = data.canUseTeamAttendance === undefined ? canUseTeamAttendance : !!data.canUseTeamAttendance;
      const returned = omitTeamAttendance(data.layout, teamAllowed);
      setCanUseTeamAttendance(teamAllowed);
      const merged: HomeLayout = isMobile
        ? {
            version: 1,
            widgets: layout?.widgets?.length ? layout.widgets : returned?.widgets || [],
            mobileWidgets: returned?.mobileWidgets?.length ? returned.mobileWidgets : draft.widgets,
          }
        : {
            version: 1,
            widgets: returned?.widgets?.length ? returned.widgets : draft.widgets,
            ...(layout?.mobileWidgets?.length
              ? { mobileWidgets: layout.mobileWidgets }
              : returned?.mobileWidgets?.length
                ? { mobileWidgets: returned.mobileWidgets }
                : {}),
          };
      setLayout(merged);
      setDraft(surfaceDraft(merged, isMobile, defaultLayout));
      setEditing(false);
    } catch {
      setError("Could not save this dashboard.");
    } finally {
      setSaving(false);
    }
  };

  const openCustomize = () => {
    if (editing) return;
    setDraft(surfaceDraft(layout, isMobile, defaultLayout));
    setEditing(true);
  };
  const restoreDefault = () => {
    if (!defaultLayout) return;
    setDraft(isMobile ? mobileIconLayout(defaultLayout) : { version: 1, widgets: defaultLayout.widgets });
    setEditing(true);
  };
  const cancelEdit = () => {
    setDraft(surfaceDraft(layout, isMobile, defaultLayout));
    setEditing(false);
    setError("");
  };

  if (!ready) {
    return <div className="p-6 text-sm text-gray-500">Loading home…</div>;
  }

  const showTeamSwitch = canUseTeamAttendance;
  const showingTeam = showTeamSwitch && homeView === "team";
  const homeBody = showingTeam ? (
    <EmpTeamDashboard />
  ) : (
    <EmpEmployeeHome
      empFullName={empFullName}
      todayStatus={todayStatus}
      loadingStatus={loadingStatus}
      onStatusUpdate={onStatusUpdate}
    />
  );
  const teamSwitch = showTeamSwitch ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-[#1a1a1a] dark:text-slate-100">
          {showingTeam ? "My Team" : "Self"}
          <ChevronDown className="size-4 text-slate-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem onClick={() => chooseHomeView("self")}>Self</DropdownMenuItem>
        <DropdownMenuItem onClick={() => chooseHomeView("team")}>My Team</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (isMobile) {
    return (
      <div className="space-y-3">
        {teamSwitch ? <div className="flex justify-end">{teamSwitch}</div> : null}
        {homeBody}
      </div>
    );
  }
  return (
    <EmpDesktopPage
      title="Home"
      description="Your workspace overview"
      icon={LayoutDashboard}
      actions={teamSwitch}
      className="emp-home-dashboard flex h-full min-h-0 flex-1 flex-col !space-y-0 overflow-hidden bg-[#f4f7fb] -mx-8 -my-5 min-h-[calc(100%+2.5rem)] w-[calc(100%+4rem)] max-w-[calc(100%+4rem)] px-8 py-5"
    >
      {homeBody}
    </EmpDesktopPage>
  );

  const widgetData = {
    isMobile,
    todayStatus,
    loadingStatus,
    onStatusUpdate,
    taskBadge,
    noticeBadge,
    reimbBadge,
    leaveBadge,
    onNoticeClick,
    empFullName,
    empPhoto,
    empInitials,
    designation,
    department,
    overview,
    overviewLoading,
    onRefreshOverview: () => void refreshOverview(),
  };

  const body = (
    <HomeWidgetProvider value={widgetData}>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div ref={widthRef}>
        {isMobile ? (
          <>
          <GridLayout
            className="layout"
            cols={4}
            rowHeight={76}
            width={gridWidth}
            margin={[10, 10]}
            layout={gridLayout}
            isDraggable={false}
            isResizable={false}
            draggableHandle=".widget-drag"
            draggableCancel=".widget-action"
            compactType="vertical"
            onDragStop={(next) => applyGrid(next as GridItem[])}
            onResizeStop={(next) => applyGrid(next as GridItem[])}
          >
            {ordered.map((widget) => {
              const icon = widget.w <= 1 && widget.h <= 1;
              const Icon = WIDGET_ICONS[widget.widgetKey] || LayoutGrid;
              const title = widgetTitle(widget.widgetKey);
              if (icon) {
                return (
                  <div key={widget.instanceId}>
                    <div className="relative h-full">
                      <button
                        type="button"
                        className={`widget-drag flex h-full w-full flex-col items-center justify-center gap-1 rounded-2xl border border-gray-200 bg-white px-1 text-center shadow-sm ${editing ? "cursor-move" : ""}`}
                        onClick={() => { if (!editing) setDetailKey(widget.widgetKey); }}
                      >
                        <Icon className="size-6 text-blue-600" />
                        <span className="line-clamp-2 text-[11px] font-medium leading-tight text-gray-700">{title}</span>
                      </button>
                      {editing ? (
                        <button
                          type="button"
                          className="widget-action absolute right-1 top-1 rounded bg-white px-1 text-[10px] font-medium text-red-600"
                          onClick={() => removeWidget(widget.instanceId)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              }
              return (
                <div key={widget.instanceId}>
                  <WidgetShell
                    title={title}
                    editing={editing}
                    onRemove={() => removeWidget(widget.instanceId)}
                  >
                    <HomeWidgetBody widgetKey={widget.widgetKey} />
                  </WidgetShell>
                </div>
              );
            })}
          </GridLayout>
          <Dialog open={!!detailKey} onOpenChange={(open) => { if (!open) setDetailKey(null); }}>
            <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{detailKey ? widgetTitle(detailKey || "") : ""}</DialogTitle>
              </DialogHeader>
              {detailKey ? (
                STATUS_WIDGET_KEYS.has(detailKey || "")
                  ? <StatusPeopleList widgetKey={detailKey || ""} />
                  : <HomeWidgetBody widgetKey={detailKey || ""} />
              ) : null}
            </DialogContent>
          </Dialog>
          </>
        ) : (
          <GridLayout
            className="layout"
            cols={12}
            rowHeight={36}
            width={gridWidth}
            margin={[12, 12]}
            layout={gridLayout}
            isDraggable={false}
            isResizable={false}
            draggableHandle=".widget-drag"
            draggableCancel=".widget-action"
            compactType="vertical"
            onDragStop={(next) => applyGrid(next as GridItem[])}
            onResizeStop={(next) => applyGrid(next as GridItem[])}
          >
            {ordered.map((widget) => (
              <div key={widget.instanceId}>
                <WidgetShell
                  title={widgetTitle(widget.widgetKey)}
                  editing={editing}
                  onRemove={() => removeWidget(widget.instanceId)}
                >
                  <HomeWidgetBody widgetKey={widget.widgetKey} />
                </WidgetShell>
              </div>
            ))}
          </GridLayout>
        )}
      </div>
      {catalogOpen && typeof document !== "undefined"
        ? createPortal(
            <Catalog
              canUseCompanyWidgets={canUseCompanyWidgets}
              canUseTeamAttendance={canUseTeamAttendance}
              used={new Set((draft || shown)?.widgets.map((item) => item.widgetKey) || [])}
              onAdd={addWidget}
              onClose={() => setCatalogOpen(false)}
            />,
            document.body,
          )
        : null}
    </HomeWidgetProvider>
  );

  if (isMobile) {
    return <div className="space-y-3">{body}</div>;
  }

  return (
    <EmpDesktopPage
      title="Home"
      description="Your workspace overview"
      icon={LayoutDashboard}
      className="flex h-full min-h-0 flex-1 flex-col !space-y-3 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {body}
    </EmpDesktopPage>
  );
}

function WidgetShell({
  title,
  editing,
  onRemove,
  onUp,
  onDown,
  extra,
  children,
}: {
  title: string;
  editing: boolean;
  onRemove: () => void;
  onUp?: () => void;
  onDown?: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {editing ? (
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2">
          <p className="widget-drag min-w-0 flex-1 cursor-move truncate text-xs font-semibold text-gray-700">{title}</p>
          <div
            className="widget-action flex items-center gap-2"
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {extra}
            {onUp ? (
              <button type="button" className="widget-action text-xs text-gray-600" onClick={onUp}>Up</button>
            ) : null}
            {onDown ? (
              <button type="button" className="widget-action text-xs text-gray-600" onClick={onDown}>Down</button>
            ) : null}
            <button type="button" className="widget-action text-xs font-medium text-red-600" onClick={onRemove}>Remove</button>
          </div>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{children}</div>
    </section>
  );
}

function omitTeamAttendance(layout: HomeLayout | null | undefined, allowed: boolean): HomeLayout {
  const source = layout || { version: 1, widgets: [] };
  if (allowed) return source;
  return {
    ...source,
    widgets: source.widgets.filter((item) => item.widgetKey !== "team-attendance"),
    ...(source.mobileWidgets
      ? { mobileWidgets: source.mobileWidgets.filter((item) => item.widgetKey !== "team-attendance") }
      : {}),
  };
}

function Catalog({
  canUseCompanyWidgets,
  canUseTeamAttendance,
  used,
  onAdd,
  onClose,
}: {
  canUseCompanyWidgets: boolean;
  canUseTeamAttendance: boolean;
  used: Set<string>;
  onAdd: (key: string) => void;
  onClose: () => void;
}) {
  const groups = ["Personal", "Company"] as const;
  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-card p-4 text-card-foreground shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Add widget</h2>
          <button type="button" className="text-sm text-muted-foreground" onClick={onClose}>Close</button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-auto">
          {groups.map((category) => {
            if (category === "Company" && !canUseCompanyWidgets) return null;
            const items = WIDGET_CATALOG.filter((item) => {
              if (item.key === "team-attendance" && !canUseTeamAttendance) return false;
              return item.category === category;
            });
            return (
              <div key={category}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{category}</p>
                <div className="space-y-2">
                  {items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      disabled={used.has(item.key)}
                      onClick={() => onAdd(item.key)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-left text-sm text-foreground disabled:opacity-40"
                    >
                      <span>{item.title}</span>
                      <span className="text-xs text-primary">{used.has(item.key) ? "Added" : "Add"}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
