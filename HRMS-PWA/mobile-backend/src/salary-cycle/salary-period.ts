const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function clampSalaryStartDay(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(28, Math.floor(value)));
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmt(d: Date): string {
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function addMonths(y: number, m: number, delta: number) {
  const n = m + delta;
  return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
}

export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Same twelve labels the run-payroll screen builds from a financial year and a start day. */
export function buildSalaryPeriodLabels(
  fyStart?: string | null,
  dayStr?: string | number | null,
  now: Date = new Date(),
): string[] {
  const currentYear = now.getFullYear();
  const day = clampSalaryStartDay(Number(dayStr ?? 1));
  const fyIsJan = (fyStart ?? '').trim().toLowerCase() === '1st jan';

  if (day === 1) {
    if (fyIsJan) {
      return MONTHS.map((name) => `${name} ${currentYear}`);
    }
    const out: string[] = [];
    for (let i = 3; i <= 11; i++) out.push(`${MONTHS[i]} ${currentYear}`);
    out.push(
      `January ${currentYear + 1}`,
      `February ${currentYear + 1}`,
      `March ${currentYear + 1}`,
    );
    return out;
  }

  const periods: string[] = [];
  const start0 = fyIsJan
    ? new Date(currentYear - 1, 11, day)
    : new Date(currentYear, 2, day);

  for (let i = 0; i < 12; i++) {
    const start = addMonths(start0.getFullYear(), start0.getMonth(), i);
    const startDate = new Date(start.y, start.m, day);
    const end = addMonths(startDate.getFullYear(), startDate.getMonth(), 1);
    const endDate = new Date(end.y, end.m, day - 1);
    periods.push(`${fmt(startDate)} to ${fmt(endDate)}`);
  }
  return periods;
}

function monthIndex(name: string): number {
  const idx = MONTHS.findIndex((m) => m.toLowerCase() === name.toLowerCase());
  if (idx === -1) throw new Error(`Unknown month name: ${name}`);
  return idx;
}

export function parseSalaryPeriodLabel(label: string): { start: Date; end: Date } {
  const text = (label || '').trim();
  if (!text) throw new Error('Invalid month label');

  if (!text.includes(' to ')) {
    const [monthName, yearStr] = text.split(' ');
    const year = Number(yearStr);
    if (!monthName || !year) throw new Error(`Invalid month label format: ${text}`);
    const month = monthIndex(monthName);
    const start = new Date(year, month, 1, 0, 0, 0);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    return { start, end };
  }

  const [left, right] = text.split(' to ').map((s) => s.trim());
  const [sDay, sMonth, sYear] = left.split(' ');
  const [eDay, eMonth, eYear] = right.split(' ');
  const start = new Date(Number(sYear), monthIndex(sMonth), Number(sDay), 0, 0, 0);
  const end = new Date(Number(eYear), monthIndex(eMonth), Number(eDay), 23, 59, 59);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error(`Invalid month label format: ${text}`);
  }
  return { start, end };
}

/** The period on this start day that ends in the given calendar month. */
export function periodForEndMonth(
  monthStartDay: number,
  endYear: number,
  endMonthIndex: number,
): { label: string; start: Date; end: Date } {
  const day = clampSalaryStartDay(monthStartDay);
  if (day === 1) {
    const start = new Date(endYear, endMonthIndex, 1, 0, 0, 0);
    const end = new Date(endYear, endMonthIndex + 1, 0, 23, 59, 59);
    return { label: `${MONTHS[endMonthIndex]} ${endYear}`, start, end };
  }
  const end = new Date(endYear, endMonthIndex, day - 1, 23, 59, 59);
  const start = new Date(endYear, endMonthIndex - 1, day, 0, 0, 0);
  return { label: `${fmt(start)} to ${fmt(end)}`, start, end };
}

export function resolveSalaryPeriod(input: {
  financialYearStart?: string | null;
  monthStartDay?: string | number | null;
  monthPeriod: string;
  now?: Date;
}): { label: string; start: string; end: string } {
  const monthPeriod = (input.monthPeriod || '').trim();
  const labels = buildSalaryPeriodLabels(
    input.financialYearStart,
    input.monthStartDay,
    input.now,
  );
  if (labels.includes(monthPeriod)) {
    const parsed = parseSalaryPeriodLabel(monthPeriod);
    return { label: monthPeriod, start: ymdLocal(parsed.start), end: ymdLocal(parsed.end) };
  }
  const foreign = parseSalaryPeriodLabel(monthPeriod);
  const rebuilt = periodForEndMonth(
    clampSalaryStartDay(Number(input.monthStartDay ?? 1)),
    foreign.end.getFullYear(),
    foreign.end.getMonth(),
  );
  return { label: rebuilt.label, start: ymdLocal(rebuilt.start), end: ymdLocal(rebuilt.end) };
}
