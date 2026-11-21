import { apiRequest } from "./client";

export type AttendancePunch = {
  id: number;

  checkType: "CHECK_IN" | "CHECK_OUT";

  time: string | null;

  location?: string | null;

  latitude?: number | null;
  longitude?: number | null;
};

export type TodayAttendance = {
  date: string;

  status: "CHECKED_IN" | "CHECKED_OUT" | "ABSENT" | "NOT_MARKED";

  isCheckedIn: boolean;
  isCheckedOut: boolean;
  isAbsentToday: boolean;

  checkIn: AttendancePunch | null;
  checkOut: AttendancePunch | null;
  breakIn: AttendancePunch | null;
  breakOut: AttendancePunch | null;

  workMinutes: number;
  breakMinutes: number;

  workHours: string;
  breakTime: string;

  checkInLocation: string | null;
  checkOutLocation: string | null;
};

export type AttendanceHistoryItem = {
  id: number;

  date: string;

  status: "PRESENT" | "ABSENT" | "HALF_DAY" | "HOLIDAY";

  checkIn: string | null;
  checkOut: string | null;

  breakIn: string | null;
  breakOut: string | null;

  workHours: string;
  breakTime: string;

  checkInLocation: string | null;
  checkOutLocation: string | null;
};

export type PunchAttendanceRequest = {
  checkType: "CHECK_IN" | "CHECK_OUT";

  latitude?: number;
  longitude?: number;
  accuracy?: number;
  address?: string | null;
  deviceType?: string;
  browser?: string;
  operatingSystem?: string;
  userAgent?: string;
  photoUrl?: string;
};

type BackendAttendancePunch = AttendancePunch & {
  checkinTime?: string | null;
  address?: string | null;
};

function normalizeAttendancePunch(
  punch: AttendancePunch | null | undefined,
): AttendancePunch | null {
  if (!punch) return null;

  const backendPunch = punch as BackendAttendancePunch;

  return {
    ...punch,
    time: punch.time ?? backendPunch.checkinTime ?? null,
    location: punch.location ?? backendPunch.address ?? null,
  };
}

export async function getTodayAttendance(
  token: string,
): Promise<TodayAttendance> {
  const response = await apiRequest<{
    isCheckedIn: boolean;
    isCheckedOut: boolean;
    isAbsentToday: boolean;
    checkIn: BackendAttendancePunch | null;
    checkOut: BackendAttendancePunch | null;
    workMinutes: number;
    breakMinutes: number;
  }>("/api/mobile/v1/attendance/today", { token });

  const workMinutes = response.workMinutes ?? 0;
  const breakMinutes = response.breakMinutes ?? 0;

  const now = new Date();
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    date,
    status: response.isAbsentToday
      ? "ABSENT"
      : response.isCheckedOut
        ? "CHECKED_OUT"
        : response.isCheckedIn
          ? "CHECKED_IN"
          : "NOT_MARKED",
    isCheckedIn: response.isCheckedIn,
    isCheckedOut: response.isCheckedOut,
    isAbsentToday: response.isAbsentToday,
    checkIn: normalizeAttendancePunch(response.checkIn),
    checkOut: normalizeAttendancePunch(response.checkOut),
    breakIn: null,
    breakOut: null,
    workMinutes,
    breakMinutes,
    workHours: formatAttendanceWorkHours(workMinutes * 60000),
    breakTime: formatAttendanceBreakTime(breakMinutes * 60000),
    checkInLocation: formatAttendanceLocation(response.checkIn),
    checkOutLocation: formatAttendanceLocation(response.checkOut),
  };
}

export type AttendancePunchRecord = {
  id: number;
  checkType: string;
  checkinTime: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
};

type BackendAttendanceRecord = AttendancePunchRecord;
function getAttendanceDateKey(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function getPreviousAttendanceDateKey(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return value;

  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatAttendancePunchTime(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `${displayHour}:${minutes} ${period}`;
}

function formatAttendanceLocation(
  record?: {
    address?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null,
): string | null {
  if (!record) return null;

  if (record.address?.trim()) {
    return record.address.trim();
  }

  if (record.latitude != null && record.longitude != null) {
    return `${record.latitude}, ${record.longitude}`;
  }

  return null;
}

function formatAttendanceWorkHours(milliseconds: number): string {
  return `${(Math.max(0, milliseconds) / 3_600_000).toFixed(2)}h`;
}

function formatAttendanceBreakTime(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  return `${minutes}m`;
}

export async function getAttendanceHistory(
  from: string,
  to: string,
  token: string,
): Promise<AttendanceHistoryItem[]> {
  const records = await apiRequest<BackendAttendanceRecord[]>(
    `/api/mobile/v1/attendance/my?from=${encodeURIComponent(getPreviousAttendanceDateKey(from))}&to=${encodeURIComponent(to)}`,
    { token },
  );

  const sortedRecords = [...records].sort(
    (a, b) =>
      new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );

  const grouped = new Map<string, BackendAttendanceRecord[]>();
  let openCheckInDate: string | null = null;

  for (const record of sortedRecords) {
    const punchDate = getAttendanceDateKey(record.checkinTime);

    if (!punchDate) continue;

    let groupDate = punchDate;

    if (record.checkType === "CHECK_IN") {
      openCheckInDate = punchDate;
    } else if (record.checkType === "CHECK_OUT" && openCheckInDate) {
      groupDate = openCheckInDate;
      openCheckInDate = null;
    } else if (
      (record.checkType === "BREAK_IN" || record.checkType === "BREAK_OUT") &&
      openCheckInDate
    ) {
      groupDate = openCheckInDate;
    }

    const dayRecords = grouped.get(groupDate) ?? [];
    dayRecords.push(record);
    grouped.set(groupDate, dayRecords);
  }

  const activeCheckInDate = openCheckInDate;

  const now = new Date();

  const todayKey = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return [...grouped.entries()]
    .filter(([dateKey, dayRecords]) => {
      const hasPunchWithinRange = dayRecords.some((record) => {
        const punchDate = getAttendanceDateKey(record.checkinTime);
        return punchDate >= from && punchDate <= to;
      });

      const openShiftOverlapsRange =
        dateKey === activeCheckInDate && todayKey >= from && todayKey <= to;

      return hasPunchWithinRange || openShiftOverlapsRange;
    })
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([dateKey, dayRecords]) => {
      const sorted = [...dayRecords].sort(
        (a, b) =>
          new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
      );

      const checkIns = sorted.filter(
        (record) => record.checkType === "CHECK_IN",
      );

      const checkOuts = sorted.filter(
        (record) => record.checkType === "CHECK_OUT",
      );

      const lastPunch = sorted[sorted.length - 1];

      const checkIn = checkIns[0] ?? null;

      const checkOut =
        lastPunch?.checkType === "CHECK_OUT"
          ? (checkOuts[checkOuts.length - 1] ?? null)
          : null;

      const breakIn =
        sorted.find((record) => record.checkType === "BREAK_IN") ?? null;

      const breakOut =
        [...sorted]
          .reverse()
          .find((record) => record.checkType === "BREAK_OUT") ?? null;

      const [year, month, day] = dateKey.split("-").map(Number);

      const isOpenSession = checkIn !== null && checkOut === null;

      const endTime =
        dateKey === todayKey || isOpenSession
          ? Date.UTC(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
            )
          : Date.UTC(year, month - 1, day, 23, 59, 59, 999);

      let breakMilliseconds = 0;
      let activeBreakStart: number | null = null;

      for (const record of sorted) {
        const time = new Date(record.checkinTime).getTime();

        if (record.checkType === "BREAK_IN") {
          activeBreakStart = time;
        } else if (
          record.checkType === "BREAK_OUT" &&
          activeBreakStart !== null
        ) {
          breakMilliseconds += Math.max(0, time - activeBreakStart);
          activeBreakStart = null;
        }
      }

      if (activeBreakStart !== null) {
        breakMilliseconds += Math.max(0, endTime - activeBreakStart);
      }

      const startTime = checkIn
        ? new Date(checkIn.checkinTime).getTime()
        : null;

      const finishTime = checkOut
        ? new Date(checkOut.checkinTime).getTime()
        : endTime;

      const workMilliseconds =
        startTime === null
          ? 0
          : Math.max(0, finishTime - startTime - breakMilliseconds);

      return {
        id: checkIn?.id ?? sorted[0].id,
        date: dateKey,
        status: "PRESENT",
        checkIn: formatAttendancePunchTime(checkIn?.checkinTime),
        checkOut: formatAttendancePunchTime(checkOut?.checkinTime),
        breakIn: formatAttendancePunchTime(breakIn?.checkinTime),
        breakOut: formatAttendancePunchTime(breakOut?.checkinTime),
        workHours: formatAttendanceWorkHours(workMilliseconds),
        breakTime: formatAttendanceBreakTime(breakMilliseconds),
        checkInLocation: formatAttendanceLocation(checkIn),
        checkOutLocation: formatAttendanceLocation(checkOut),
      };
    });
}

export async function getAttendancePunches(
  date: string,
  token: string,
): Promise<AttendancePunchRecord[]> {
  if (!token) {
    throw new Error("You must be signed in to load attendance punches.");
  }

  const records = await apiRequest<AttendancePunchRecord[]>(
    `/api/mobile/v1/attendance/my?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`,
    {
      method: "GET",
      token,
    },
  );

  return [...records].sort(
    (a, b) =>
      new Date(a.checkinTime).getTime() - new Date(b.checkinTime).getTime(),
  );
}

export async function punchAttendance(
  data: PunchAttendanceRequest,
  token: string,
): Promise<AttendancePunch> {
  if (data.latitude == null || data.longitude == null) {
    throw new Error("Location is required for attendance.");
  }

  const response = await apiRequest<BackendAttendancePunch>(
    "/api/mobile/v1/attendance/punch",
    {
      method: "POST",
      body: JSON.stringify({
        ...data,
        latitude: data.latitude,
        longitude: data.longitude,
      }),
      token,
    },
  );

  const normalized = normalizeAttendancePunch(response);

  if (!normalized) {
    throw new Error("The server did not return a valid attendance record.");
  }

  return normalized;
}

export type QueuedAttendancePunchRequest = {
  clientEventId: string;
  referenceEventId?: string | null;
  checkType: "CHECK_IN" | "CHECK_OUT";
  punchTime: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  address?: string | null;
  timeProof: string;
};

export async function syncQueuedAttendancePunch(
  data: QueuedAttendancePunchRequest,
  token: string,
): Promise<AttendancePunch> {
  if (!token.trim()) {
    throw new Error("Authentication is required to sync attendance.");
  }

  if (!data.clientEventId.trim()) {
    throw new Error("A client event ID is required.");
  }

  if (!data.punchTime.trim()) {
    throw new Error("The original punch time is required.");
  }

  if (!data.timeProof.trim()) {
    throw new Error("A signed server time proof is required.");
  }

  if (data.checkType === "CHECK_OUT" && !data.referenceEventId?.trim()) {
    throw new Error("Checkout must reference its original check-in event.");
  }

  const response = await apiRequest<BackendAttendancePunch>(
    "/api/mobile/v1/attendance/punch",
    {
      method: "POST",
      body: JSON.stringify(data),
      token,
    },
  );

  const normalized = normalizeAttendancePunch(response);

  if (
    !normalized ||
    !Number.isSafeInteger(normalized.id) ||
    normalized.id <= 0
  ) {
    throw new Error("The server did not return a valid attendance record ID.");
  }

  return normalized;
}
