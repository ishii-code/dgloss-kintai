/**
 * 勤務カレンダーに基づく日区分（DayType）の判定（純粋関数）。
 *
 * 個別の会社休日 → 所定休日、法定休日の曜日 → 法定休日、所定休日の曜日 → 所定休日、
 * それ以外 → workday。判定順で法定休日が所定休日より優先される。
 */

import { DEFAULT_WORK_CALENDAR } from "@dgloss-kintai/contracts";
import type { DayType, WorkCalendar } from "@dgloss-kintai/contracts";

/** 暦日（`YYYY-MM-DD`）の曜日（0=日〜6=土）を返す。タイムゾーン非依存。 */
export function weekdayOf(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (match === null) throw new RangeError(`invalid date: ${date}`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).getUTCDay();
}

/**
 * 勤務カレンダーから暦日の日区分を判定する。
 *
 * @param date     対象暦日（`YYYY-MM-DD`）
 * @param calendar 勤務カレンダー（省略時は既定＝日曜法定・土曜所定）
 */
export function resolveDayType(
  date: string,
  calendar: WorkCalendar = DEFAULT_WORK_CALENDAR,
): DayType {
  // 個別の会社休日（祝日等）は所定休日として扱う。
  if (calendar.customHolidays.includes(date)) {
    return "scheduled_holiday";
  }
  const weekday = weekdayOf(date);
  if (weekday === calendar.legalHolidayWeekday) {
    return "legal_holiday";
  }
  if (calendar.scheduledHolidayWeekdays.includes(weekday)) {
    return "scheduled_holiday";
  }
  return "workday";
}
