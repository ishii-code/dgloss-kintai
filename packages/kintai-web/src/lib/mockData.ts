/**
 * モックデータ / 打刻生成ヘルパー。
 *
 * 実 API（@dgloss-kintai/api）未接続のため、当面はクライアント state ＋モックで成立させる。
 * 型は @dgloss-kintai/contracts に準拠させ、後で API 応答へ差し替えやすくしておく。
 */

import type {
  EmployeeId,
  IsoDate,
  IsoDateTime,
  Minutes,
  Stamp,
  StampId,
  StampType,
  WorkDay,
} from "@dgloss-kintai/contracts";

/** ログイン中の従業員（モック）。 */
export const MOCK_EMPLOYEE_ID = "emp-0001" as EmployeeId;

/** 打刻ボタンに出す主要な打刻種別のラベル。 */
export const STAMP_LABELS: Readonly<Record<StampType, string>> = {
  clock_in: "出勤",
  clock_out: "退勤",
  break_start: "休憩開始",
  break_end: "休憩終了",
  entry: "入館",
  exit: "退館",
  pc_login: "PC ログオン",
  pc_logout: "PC ログオフ",
};

/** 打刻画面に並べる主要アクション（この順に大型ボタン表示）。 */
export const PRIMARY_STAMP_TYPES: readonly StampType[] = [
  "clock_in",
  "break_start",
  "break_end",
  "clock_out",
];

/** Date を JST の RFC3339（+09:00）文字列にする。 */
export function toIsoDateTime(date: Date): IsoDateTime {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string): string =>
    parts.find((p) => p.type === t)?.value ?? "00";
  const iso = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`;
  return iso as IsoDateTime;
}

/** JST の暦日 `YYYY-MM-DD`。 */
export function toIsoDate(date: Date): IsoDate {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date) as IsoDate;
}

/** 打刻時刻を JST の `HH:mm` で表示する。 */
export function formatClockTime(iso: IsoDateTime): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function newStampId(): StampId {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `stamp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return rnd as StampId;
}

/** 手動打刻を1件生成する。 */
export function createStamp(type: StampType, at: Date = new Date()): Stamp {
  return {
    id: newStampId(),
    employeeId: MOCK_EMPLOYEE_ID,
    type,
    stampedAt: toIsoDateTime(at),
    source: "manual",
    note: null,
  };
}

/**
 * 当日のサンプル打刻を生成する（デモ表示用）。
 * 現在時刻を基準に「約3時間前に出勤・途中で15分休憩」を作る。
 */
export function seedTodayStamps(now: Date = new Date()): Stamp[] {
  const minute = 60_000;
  const at = (offsetMin: number): Date => new Date(now.getTime() + offsetMin * minute);
  return [
    createStamp("clock_in", at(-180)),
    createStamp("break_start", at(-90)),
    createStamp("break_end", at(-75)),
  ];
}

const min = (n: number): Minutes => n as Minutes;

/** 勤怠一覧スタブ用のモック日次勤怠。 */
export const MOCK_WORK_DAYS: readonly WorkDay[] = [
  {
    id: "wd-1" as WorkDay["id"],
    employeeId: MOCK_EMPLOYEE_ID,
    date: "2026-07-17" as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: min(495),
    breakMinutes: min(60),
    absenceMinutes: min(0),
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 15,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  },
  {
    id: "wd-2" as WorkDay["id"],
    employeeId: MOCK_EMPLOYEE_ID,
    date: "2026-07-18" as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: min(600),
    breakMinutes: min(60),
    absenceMinutes: min(0),
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 120,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  },
  {
    id: "wd-3" as WorkDay["id"],
    employeeId: MOCK_EMPLOYEE_ID,
    date: "2026-07-19" as IsoDate,
    dayType: "scheduled_holiday",
    scheduledStart: null,
    scheduledEnd: null,
    actualWorkedMinutes: min(0),
    breakMinutes: min(0),
    absenceMinutes: min(0),
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  },
  {
    id: "wd-4" as WorkDay["id"],
    employeeId: MOCK_EMPLOYEE_ID,
    date: "2026-07-20" as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: min(240),
    breakMinutes: min(0),
    absenceMinutes: min(0),
    leave: "paid_half",
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  },
];
