/**
 * 打刻（Stamp）→ 日次勤怠（WorkDay）への変換（勤怠判定レイヤーの入口）。
 *
 * 出退勤・休憩の打刻から労働区間を復元し、core の classifyDailyWork で区分別労働時間
 * （法定内残業・法定外残業・深夜）に落として WorkDay を組み立てる純粋関数。
 *
 * 日跨ぎ（深夜0時をまたぐ勤務）に対応する。1回の勤務（clock_in → clock_out）は
 * 出勤日を基準日とし、区間は基準日 00:00 からの絶対分で表す（翌 2:00 = 26:00 = 1560分）。
 * これにより深夜帯 22:00-翌5:00 の割増が翌日分も含めて正しく算定される。勤務全体は
 * 出勤日の WorkDay に計上する（夜勤を開始日に帰属させる一般的な運用）。
 *
 * スコープ（v1）:
 *  - 対象打刻は clock_in / clock_out / break_start / break_end（キオスク打刻）。
 *    entry/exit/pc_login/pc_logout（jinjer 取込由来）は本変換では扱わない。
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

/** IsoDateTime（JST/UTC いずれの表記でも可）を絶対時刻（ms）に落とす。 */
function toInstantMs(iso: string): number {
  return new Date(iso).getTime();
}

/** 絶対時刻（ms）の JST 暦日（`YYYY-MM-DD`）を返す。 */
function jstDateOf(instantMs: number): string {
  return new Date(instantMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** JST 暦日の 00:00 の絶対時刻（ms）を返す。 */
function jstMidnightMs(date: string): number {
  return Date.parse(`${date}T00:00:00+09:00`);
}

/** 基準日ごとに復元した労働区間・休憩時間。 */
interface DayAccum {
  intervals: LaborInterval[];
  breakMinutes: number;
}

/**
 * 従業員1名の打刻列から日次勤怠（WorkDay）を組み立てる。純粋関数。
 * 労働区間が生成できた（労働時間 > 0 の）日のみ WorkDay を返す。
 *
 * @param employee 対象従業員
 * @param stamps   対象期間・対象従業員の打刻（順不同で可・内部で時系列整列）
 * @returns 出勤日（基準日）昇順の WorkDay 配列
 */
export function buildWorkDaysFromStamps(
  employee: Employee,
  stamps: readonly Stamp[],
): WorkDay[] {
  // 対象打刻を時系列（絶対時刻）で整列する。
  const events = stamps
    .filter((s) => s.employeeId === employee.id)
    .map((s) => ({ kind: toKind(s.type), ms: toInstantMs(s.stampedAt) }))
    .filter((e): e is { kind: Kind; ms: number } => e.kind !== null)
    .sort((a, b) => a.ms - b.ms);

  const byDate = new Map<string, DayAccum>();
  const ensure = (date: string): DayAccum => {
    const found = byDate.get(date);
    if (found !== undefined) return found;
    const created: DayAccum = { intervals: [], breakMinutes: 0 };
    byDate.set(date, created);
    return created;
  };

  // 勤務（clock_in→clock_out）を1シフトとして状態機械で復元する。
  // シフトは出勤日を基準日とし、分はその日の 00:00 からの絶対分（日跨ぎは 1440 超）。
  let present = false;
  let onBreak = false;
  let baseMs: number | null = null;
  let baseDate: string | null = null;
  let segStart: number | null = null; // 現区間の開始（基準日からの分）
  let breakStart: number | null = null;

  const minuteOf = (ms: number): number => Math.round((ms - (baseMs ?? 0)) / 60000);
  const pushSeg = (end: number): void => {
    if (baseDate !== null && segStart !== null && end > segStart) {
      ensure(baseDate).intervals.push({ startMinute: segStart, endMinute: end });
    }
    segStart = null;
  };

  for (const e of events) {
    if (e.kind === "in") {
      if (!present) {
        present = true;
        onBreak = false;
        baseDate = jstDateOf(e.ms);
        baseMs = jstMidnightMs(baseDate);
        segStart = minuteOf(e.ms);
      }
      continue;
    }
    if (!present) {
      continue; // 出勤していない状態の out/break は無視（孤立打刻）
    }
    const min = minuteOf(e.ms);
    switch (e.kind) {
      case "out":
        if (!onBreak) pushSeg(min);
        present = false;
        onBreak = false;
        segStart = null;
        baseMs = null;
        baseDate = null;
        break;
      case "break_start":
        if (!onBreak) {
          pushSeg(min);
          onBreak = true;
          breakStart = min;
        }
        break;
      case "break_end":
        if (onBreak) {
          onBreak = false;
          segStart = min;
          if (breakStart !== null && min > breakStart) {
            ensure(baseDate as string).breakMinutes += min - breakStart;
          }
          breakStart = null;
        }
        break;
    }
  }

  const workDays: WorkDay[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const accum = byDate.get(date);
    if (accum === undefined || accum.intervals.length === 0) continue;
    const workedMinutes = accum.intervals.reduce(
      (acc, iv) => acc + (iv.endMinute - iv.startMinute),
      0,
    );
    if (workedMinutes <= 0) continue;

    const classified = classifyDailyWork({
      dayType: "workday",
      intervals: accum.intervals,
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
      breakMinutes: accum.breakMinutes as Minutes,
      absenceMinutes: 0 as Minutes,
      leave: null,
      classified,
    });
  }
  return workDays;
}
