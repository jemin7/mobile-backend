/** Personal calendar ToDos stored per employee (browser-local). */

import { todayPunchDateKey } from "./attendanceDuration";

export type EmpCalendarTodoItem = {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
};

type TodoStore = Record<string, EmpCalendarTodoItem[]>;

function storageKey(employeeId: number) {
  return `empCalendarTodos:v1:${employeeId}`;
}

function readStore(employeeId: number): TodoStore {
  if (typeof window === "undefined" || !employeeId) return {};
  try {
    const raw = localStorage.getItem(storageKey(employeeId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(employeeId: number, store: TodoStore) {
  if (typeof window === "undefined" || !employeeId) return;
  try {
    localStorage.setItem(storageKey(employeeId), JSON.stringify(store));
    window.dispatchEvent(new CustomEvent("emp-calendar-todos-changed", { detail: { employeeId } }));
    window.dispatchEvent(new Event("emp-notifications-changed"));
    window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
  } catch {
    /* ignore quota */
  }
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export type CalendarTodoReminder = {
  id: string;
  text: string;
  dueDate: string;
  createdAt: string;
};

/** Open todos whose due date is today or either of the next two days. */
export function openTodoReminders(employeeId: number, today = todayPunchDateKey()): CalendarTodoReminder[] {
  const until = shiftDateKey(today, 2);
  const store = readStore(employeeId);
  const out: CalendarTodoReminder[] = [];
  for (const [dateKey, items] of Object.entries(store)) {
    if (dateKey < today || dateKey > until || !Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || item.done || !item.text) continue;
      out.push({ id: item.id, text: item.text, dueDate: dateKey, createdAt: item.createdAt });
    }
  }
  return out;
}

const CALENDAR_BADGE_SEEN_AT = "_calendar_badge_seen_at";

export function markCalendarBadgeSeen() {
  if (typeof window === "undefined") return;
  localStorage.setItem(CALENDAR_BADGE_SEEN_AT, String(Date.now()));
  window.dispatchEvent(new Event("emp-sidebar-badges-changed"));
}

/** Sidebar count: every open reminder until My Calendar is opened today, then only todos created after that. */
export function calendarSidebarBadgeCount(employeeId: number): number {
  if (typeof window === "undefined" || !employeeId) return 0;
  const reminders = openTodoReminders(employeeId);
  const seenAt = Number(localStorage.getItem(CALENDAR_BADGE_SEEN_AT) || 0);
  const todayStart = new Date(`${todayPunchDateKey()}T00:00:00`).getTime();
  if (!Number.isFinite(seenAt) || seenAt < todayStart) return reminders.length;
  return reminders.filter((item) => new Date(item.createdAt).getTime() > seenAt).length;
}

export type CalendarTodoBellItem = {
  id: string;
  kind: "calendar-todo";
  title: string;
  body: string;
  emoji: string;
  at: string;
  href: string;
};

function dueLabel(dateKey: string, today: string): string {
  if (dateKey === today) return "Due today";
  if (dateKey === shiftDateKey(today, 1)) return "Due tomorrow";
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "Due soon";
  return `Due ${new Date(y, m - 1, d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
}

/** One bell row per open reminder. `at` is the start of today, or the create time if that is later. */
export function calendarTodoBellItems(employeeId: number): CalendarTodoBellItem[] {
  const today = todayPunchDateKey();
  const start = new Date(`${today}T00:00:00`).getTime();
  return openTodoReminders(employeeId, today).map((item) => {
    const created = new Date(item.createdAt).getTime();
    const at = new Date(Math.max(start, Number.isFinite(created) ? created : start)).toISOString();
    return {
      id: `calendar-todo-${today}-${item.id}`,
      kind: "calendar-todo",
      title: item.text,
      body: dueLabel(item.dueDate, today),
      emoji: "📝",
      at,
      href: "/empdashboard?tab=calendar",
    };
  });
}

export function listTodosForDate(employeeId: number, dateKey: string): EmpCalendarTodoItem[] {
  const store = readStore(employeeId);
  return Array.isArray(store[dateKey]) ? store[dateKey] : [];
}

export function countTodosByDate(employeeId: number): Map<string, number> {
  const store = readStore(employeeId);
  const map = new Map<string, number>();
  for (const [dateKey, items] of Object.entries(store)) {
    const n = Array.isArray(items) ? items.filter((t) => !t.done).length : 0;
    if (n > 0) map.set(dateKey, n);
  }
  return map;
}

/** Open (incomplete) todo texts keyed by date — for calendar tooltips. */
export function todoTextsByDate(employeeId: number): Map<string, string[]> {
  const store = readStore(employeeId);
  const map = new Map<string, string[]>();
  for (const [dateKey, items] of Object.entries(store)) {
    const texts = Array.isArray(items)
      ? items.filter((t) => !t.done).map((t) => t.text)
      : [];
    if (texts.length > 0) map.set(dateKey, texts);
  }
  return map;
}

export function addTodoForDate(employeeId: number, dateKey: string, text: string): EmpCalendarTodoItem {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("ToDo text is required");
  const store = readStore(employeeId);
  const item: EmpCalendarTodoItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: trimmed,
    done: false,
    createdAt: new Date().toISOString(),
  };
  store[dateKey] = [...(store[dateKey] || []), item];
  writeStore(employeeId, store);
  return item;
}

export function toggleTodoForDate(employeeId: number, dateKey: string, todoId: string) {
  const store = readStore(employeeId);
  const list = store[dateKey] || [];
  store[dateKey] = list.map((t) => (t.id === todoId ? { ...t, done: !t.done } : t));
  writeStore(employeeId, store);
}

export function updateTodoForDate(employeeId: number, dateKey: string, todoId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("ToDo text is required");
  const store = readStore(employeeId);
  const list = store[dateKey] || [];
  store[dateKey] = list.map((t) => (t.id === todoId ? { ...t, text: trimmed } : t));
  writeStore(employeeId, store);
}

export function removeTodoForDate(employeeId: number, dateKey: string, todoId: string) {
  const store = readStore(employeeId);
  store[dateKey] = (store[dateKey] || []).filter((t) => t.id !== todoId);
  if (store[dateKey].length === 0) delete store[dateKey];
  writeStore(employeeId, store);
}
