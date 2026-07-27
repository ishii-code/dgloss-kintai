/**
 * 打刻（Stamp）→ 日次勤怠（WorkDay）への変換（勤怠判定レイヤーの入口）。
 *
 * 出退勤・休憩の打刻から労働区間を復元し、core の classifyDailyWork で区分別労働時間
 * （法定内残業・法定外残業・深夜）に落として WorkDay を組み立てる純粋関数。
 *
 * スコープ（v1）:
 *  - 対象打刻は clock_in / clock_out / break_start / break_end（キオスク打刻）。
 *    entry/exit/pc_login/pc_logout（jinjer 取込由来）は本変換では扱わない。
 *  - 打刻は JST の暦日でグルーピングする。日跨ぎ（深夜0時をまたぐ勤務）は未対応
 *    （退勤が翌日になるシフトは翌日側の打刻が孤立し労働区間を作らない）。将来対応。
 *  - 所定労働時間は既定 8h（480分）、日区分は workday 固定（勤務カレンダー未実装のため）。
 *    週40h の再判定（applyWeeklyOvertime）は行わない日次確定値。
 */

import { classifyDailyWork, type LaborInterval } from "@dgloss-kintai/core";
import type {
  Employee,
  IsoDate,
  Minutes,
  Stamp,
  WorkDay,
  WorkDayId,
} from "@dgloss-kintai/contracts";

/** 既定の所定労働時間（分・8h）。勤務カレンダー未実装のための暫定値。 */
const DEFAULT_SCHEDULED_WORK_MINUTES = 480;

/** IsoDateTime（JST/UTC いずれの表記でも可）を JST の暦日と分に落とす。 */
function toJstDateMinute(iso: string): { date: string; minute: number } {
  const instant = new Date(iso);
  const jst = new Date(instant.getTime() + 9 * 60 * 60 * 1000);
  const date = jst.toISOString().slice(0, 10);
  const minute = jst.getUTCHours() * 60 + jst.getUTCMinutes();
  return { date, minute };
}

/** 打刻種別を状態機械の入力に写す（対象外は null）。 */
type Kind = "in" | "out" | "break_start" | "break_end";
function toKind(type: Stamp["type"]): Kind | null {
  switch (type) {
    case "clock_in":
      return "in";
    case "clock_out":
      return "out";
    case "break_start":
      return "break_start";
    case "break_end":
      return "break_end";
    default:
      return null; // entry/exit/pc_* は本変換では扱わない
  }
}

interface DayStamp {
  readonly kind: Kind;
  readonly minute: number;
}

/** 1日分の打刻から労働区間と休憩時間を復元する（状態機械）。 */
function buildIntervals(stamps: readonly DayStamp[]): {
  intervals: LaborInterval[];
  breakMinutes: number;
} {
  const sorted = [...stamps].sort((a, b) => a.minute - b.minute);
  const intervals: LaborInterval[] = [];
  let present = false;
  let onBreak = false;
  let segStart: number | null = null;
  let breakStart: number | null = null;
  let breakMinutes = 0;

  const closeSegment = (end: number): void => {
    if (segStart !== null && end > segStart) {
      intervals.push({ startMinute: segStart, endMinute: end });
    }
    segStart = null;
  };

  for (const s of sorted) {
    switch (s.kind) {
      case "in":
        if (!present) {
          present = true;
          onBreak = false;
          segStart = s.minute;
        }
        break;
      case "out":
        if (present) {
          if (!onBreak) closeSegment(s.minute);
          present = false;
          onBreak = false;
          segStart = null;
        }
        break;
      case "break_start":
        if (present && !onBreak) {
          closeSegment(s.minute);
          onBreak = true;
          breakStart = s.minute;
        }
        break;
      case "break_end":
        if (present && onBreak) {
          onBreak = false;
          segStart = s.minute;
          if (breakStart !== null && s.minute > breakStart) {
            breakMinutes += s.minute - breakStart;
          }
          breakStart = null;
        }
        break;
    }
  }
  return { intervals, breakMinutes };
}

/**
 * 従業員1名の打刻列から日次勤怠（WorkDay）を組み立てる。純粋関数。
 * 労働区間が生成できた（労働時間 > 0 の）日のみ WorkDay を返す。
 *
 * @param employee 対象従業員
 * @param stamps   対象期間・対象従業員の打刻（順不同で可・内部で日付グルーピング）
 * @returns 日付昇順の WorkDay 配列
 */
export function buildWorkDaysFromStamps(
  employee: Employee,
  stamps: readonly Stamp[],
): WorkDay[] {
  // 対象打刻のみを JST 日付でグルーピングする。
  const byDate = new Map<string, DayStamp[]>();
  for (const s of stamps) {
    if (s.employeeId !== employee.id) continue;
    const kind = toKind(s.type);
    if (kind === null) continue;
    const { date, minute } = toJstDateMinute(s.stampedAt);
    const list = byDate.get(date) ?? [];
    list.push({ kind, minute });
    byDate.set(date, list);
  }

  const workDays: WorkDay[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const { intervals, breakMinutes } = buildIntervals(byDate.get(date) ?? []);
    if (intervals.length === 0) continue;
    const workedMinutes = intervals.reduce(
      (acc, iv) => acc + (iv.endMinute - iv.startMinute),
      0,
    );
    if (workedMinutes <= 0) continue;

    const classified = classifyDailyWork({
      dayType: "workday",
      intervals,
      scheduledWorkMinutes: DEFAULT_SCHEDULED_WORK_MINUTES,
    });

    workDays.push({
      id: `wd_${employee.id}_${date}` as WorkDayId,
      employeeId: employee.id,
      date: date as IsoDate,
      dayType: "workday",
      scheduledStart: "09:00",
      scheduledEnd: "18:00",
      actualWorkedMinutes: workedMinutes as Minutes,
      breakMinutes: breakMinutes as Minutes,
      absenceMinutes: 0 as Minutes,
      leave: null,
      classified,
    });
  }
  return workDays;
}
