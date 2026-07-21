/**
 * 月次集計：複数日の区分別労働時間を合算し、月間の `ClassifiedWorkMinutes` を作る。
 *
 * 割増賃金は月次で締めて算定するため（賃金規程第20条3項1号の月間平均所定を基礎とする）、
 * 週 40h 適用後の日次結果を月単位で合算し、そのまま `calculateWagePremium` に渡せる形にする。
 * 深夜（nightMinutes）は他区分と重複してよく、ここでも単純加算する。
 */

import type { ClassifiedWorkMinutes } from "../types.js";
import { assertNonNegativeInteger } from "./validate.js";

/**
 * 日次（または週次適用後）の区分別労働時間を月間で合算する。
 *
 * @param dailyResults 合算対象（日次確定値の配列）
 * @returns 月間の区分別労働時間（割増計算エンジンの入力）
 */
export function aggregateMonthly(
  dailyResults: readonly ClassifiedWorkMinutes[],
): ClassifiedWorkMinutes {
  const total: ClassifiedWorkMinutes = {
    nonStatutoryOvertimeMinutes: 0,
    statutoryOvertimeMinutes: 0,
    legalHolidayMinutes: 0,
    scheduledHolidayMinutes: 0,
    nightMinutes: 0,
  };

  for (const day of dailyResults) {
    assertNonNegativeInteger(
      day.nonStatutoryOvertimeMinutes,
      "nonStatutoryOvertimeMinutes",
    );
    assertNonNegativeInteger(
      day.statutoryOvertimeMinutes,
      "statutoryOvertimeMinutes",
    );
    assertNonNegativeInteger(day.legalHolidayMinutes, "legalHolidayMinutes");
    assertNonNegativeInteger(
      day.scheduledHolidayMinutes,
      "scheduledHolidayMinutes",
    );
    assertNonNegativeInteger(day.nightMinutes, "nightMinutes");

    total.nonStatutoryOvertimeMinutes += day.nonStatutoryOvertimeMinutes;
    total.statutoryOvertimeMinutes += day.statutoryOvertimeMinutes;
    total.legalHolidayMinutes += day.legalHolidayMinutes;
    total.scheduledHolidayMinutes += day.scheduledHolidayMinutes;
    total.nightMinutes += day.nightMinutes;
  }

  return total;
}
