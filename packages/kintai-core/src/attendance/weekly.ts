/**
 * 週 40h ルールによる法定外労働への振替（賃金規程第18-19条・労働基準法第32条）。
 *
 * 1 週（起算日=日曜）の労働時間が法定 40h を超える分のうち、日次で既に法定外（日 8h 超）
 * として計上済みでない分を、追加で `statutoryOvertimeMinutes`（法定外）へ振り替える。
 * 二重計上を避けるため、週の算定に使う「straight（非・法定外）時間」は
 *   各日の実労働 W − その日で既に法定外計上済みの分
 * で求める（法定休日労働は週 40h の算定に含めない）。
 *
 * 振替元の優先順位（過払い・取りこぼしの双方を避ける）:
 *   1. nonStatutoryOvertimeMinutes（法定内残業・時給相当分 1.00）→ 法定外 1.25 へ。まさに週 OT。
 *   2. scheduledHolidayMinutes（所定休日・1.25）→ 法定外 1.25 へ。同率のため月 60h 超でのみ差が出る。
 *   3. （上記で足りない残余）所定内労働そのものが週 40h を超える異常データ。取りこぼし（未払い）を
 *      防ぐため安全側で法定外に上乗せする（1.00 は基本給と二重になり過払いになりうるが、
 *      これは所定 40h 超という非適正スケジュールでしか起きない。TODO: 0.25 のみの週 OT ラインを
 *      設けるか、上位で所定を是正すること）。
 *
 * NOTE: 本関数は「1 週分（日曜起算で最大 7 日）にグルーピング済み」の配列を受け取る。
 * 月の境界・週の切り出し（どの日を同じ週にまとめるか）は暦を扱う上位の責務とする。
 * weekStart は現状 "sunday" のみ対応（賃金規程第18条の週起算日）。
 */

import type { ClassifiedWorkMinutes } from "../types.js";
import { classifyDay } from "./classify.js";
import type { DailyWorkInput } from "./classify.js";

/** 1 週の法定労働時間（分）。40h。賃金規程第18条。 */
export const WEEKLY_STATUTORY_MINUTES = 40 * 60;

/** 週 40h 振替の設定。 */
export interface WeeklyOvertimeOptions {
  /** 週の起算日。現状 "sunday" のみ対応。 */
  readonly weekStart?: "sunday";
}

/**
 * 1 週分の日次入力に週 40h ルールを適用し、日ごとの区分別労働時間を返す。
 *
 * @param week    日曜起算でグルーピング済みの 1 週分（最大 7 日）
 * @param options 週起算日など
 * @returns week と同じ並び・同じ長さの、週 40h 適用後の区分別労働時間の配列
 */
export function applyWeeklyOvertime(
  week: readonly DailyWorkInput[],
  options: WeeklyOvertimeOptions = {},
): ClassifiedWorkMinutes[] {
  const weekStart = options.weekStart ?? "sunday";
  if (weekStart !== "sunday") {
    throw new RangeError(
      'weekStart must be "sunday" (賃金規程第18条の週起算日のみ対応)',
    );
  }

  const classifications = week.map(classifyDay);
  // 可変コピー（振替のために書き換える）。
  const results: ClassifiedWorkMinutes[] = classifications.map((c) => ({
    ...c.classified,
  }));

  // 週の straight 時間（法定外に未計上の労働）を合算する。
  let weeklyStraight = 0;
  classifications.forEach((c, index) => {
    if (!c.countsTowardWeekly) {
      return;
    }
    const result = results[index];
    if (result === undefined) {
      return;
    }
    weeklyStraight += c.workedMinutes - result.statutoryOvertimeMinutes;
  });

  let remaining = Math.max(0, weeklyStraight - WEEKLY_STATUTORY_MINUTES);
  if (remaining === 0) {
    return results;
  }

  // 優先順位 1→2 に従って各日から法定外へ振り替える。
  for (let index = 0; index < results.length && remaining > 0; index += 1) {
    if (!classifications[index]?.countsTowardWeekly) {
      continue;
    }
    const result = results[index];
    if (result === undefined) {
      continue;
    }
    const fromNonStatutory = Math.min(
      remaining,
      result.nonStatutoryOvertimeMinutes,
    );
    result.nonStatutoryOvertimeMinutes -= fromNonStatutory;
    result.statutoryOvertimeMinutes += fromNonStatutory;
    remaining -= fromNonStatutory;
    if (remaining === 0) {
      break;
    }
    const fromScheduledHoliday = Math.min(
      remaining,
      result.scheduledHolidayMinutes,
    );
    result.scheduledHolidayMinutes -= fromScheduledHoliday;
    result.statutoryOvertimeMinutes += fromScheduledHoliday;
    remaining -= fromScheduledHoliday;
  }

  // 残余（所定内労働自体が週 40h 超）は取りこぼし防止のため最後の対象日に法定外として上乗せ。
  if (remaining > 0) {
    for (let index = results.length - 1; index >= 0; index -= 1) {
      if (!classifications[index]?.countsTowardWeekly) {
        continue;
      }
      const result = results[index];
      if (result === undefined) {
        continue;
      }
      result.statutoryOvertimeMinutes += remaining;
      remaining = 0;
      break;
    }
  }

  return results;
}
