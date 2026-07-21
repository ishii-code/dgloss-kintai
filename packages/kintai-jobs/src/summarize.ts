/**
 * 月内の日次勤怠（WorkDay）を締めの入力に合算する純粋関数群。
 *
 * 賃金規程第6条: 賃金計算期間は「当月1日から末日まで」。本モジュールは当該期間の
 * WorkDay[] を受け取り、区分別労働時間（第20条の割増計算入力）・総労働時間・
 * 遅刻早退等の不就労時間（第21条控除入力）を月間合算する。
 *
 * 区分判定（22:00-5:00 の深夜・法定/所定・週40h/日8h 等）は勤怠判定レイヤーが済ませた前提で、
 * ここでは各 WorkDay.classified を単純加算するのみ。合算結果は非負整数であることを
 * contracts の zod スキーマ（classifiedWorkMinutesSchema）で検証する。
 */

import type { WorkDay, ClassifiedWorkMinutes, YearMonth } from "@dgloss-kintai/contracts";
import { classifiedWorkMinutesSchema } from "@dgloss-kintai/contracts";

/** 区分別労働時間のゼロ値（労働のない月・従業員の初期値）。 */
const ZERO_CLASSIFIED: ClassifiedWorkMinutes = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
};

/** 月次締めに必要な、月間合算済みの勤怠サマリ。 */
export interface MonthlyAttendanceSummary {
  /** 区分別の月内労働時間（分・非負整数、zod 検証済み）。 */
  readonly classified: ClassifiedWorkMinutes;
  /** 実労働時間の月内合計（分・非負整数）。 */
  readonly totalWorkedMinutes: number;
  /** 遅刻・早退・私用外出等の不就労時間の月内合計（分・非負整数、第21条控除対象）。 */
  readonly totalAbsenceMinutes: number;
  /** 合算対象となった WorkDay 件数（期間・従業員で絞り込んだ後）。 */
  readonly workDayCount: number;
}

/** period（年月）を IsoDate の接頭辞 `YYYY-MM` に変換する。 */
function periodPrefix(period: YearMonth): string {
  const mm = String(period.month).padStart(2, "0");
  return `${period.year}-${mm}`;
}

/**
 * 当該従業員・当該期間の WorkDay だけを抽出する（賃金規程第6条: 当月1日〜末日）。
 * バッチが期間外の日を混ぜて渡しても取りこぼさないよう、締めロジック側で防御的に絞り込む。
 */
export function selectWorkDaysForPeriod(
  workDays: readonly WorkDay[],
  employeeId: string,
  period: YearMonth,
): readonly WorkDay[] {
  const prefix = periodPrefix(period);
  return workDays.filter(
    (wd) => wd.employeeId === employeeId && wd.date.startsWith(prefix),
  );
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

/**
 * 抽出済み WorkDay[] を月間合算する。各 WorkDay.classified を区分ごとに加算し、
 * 実労働時間・不就労時間も合計する。合算後の区分別分は zod で非負整数検証する。
 */
export function summarizeMonthlyAttendance(
  workDays: readonly WorkDay[],
): MonthlyAttendanceSummary {
  let classified: ClassifiedWorkMinutes = ZERO_CLASSIFIED;
  let totalWorkedMinutes = 0;
  let totalAbsenceMinutes = 0;

  for (const wd of workDays) {
    assertNonNegativeInteger(wd.actualWorkedMinutes, "actualWorkedMinutes");
    assertNonNegativeInteger(wd.absenceMinutes, "absenceMinutes");

    // 区分別分は日次でも非負整数のはずだが、合算前に個々を zod 検証する。
    const c = classifiedWorkMinutesSchema.parse(wd.classified);

    classified = {
      nonStatutoryOvertimeMinutes:
        classified.nonStatutoryOvertimeMinutes + c.nonStatutoryOvertimeMinutes,
      statutoryOvertimeMinutes:
        classified.statutoryOvertimeMinutes + c.statutoryOvertimeMinutes,
      legalHolidayMinutes: classified.legalHolidayMinutes + c.legalHolidayMinutes,
      scheduledHolidayMinutes:
        classified.scheduledHolidayMinutes + c.scheduledHolidayMinutes,
      nightMinutes: classified.nightMinutes + c.nightMinutes,
    };
    totalWorkedMinutes += wd.actualWorkedMinutes;
    totalAbsenceMinutes += wd.absenceMinutes;
  }

  // 合算結果（月間合計）を最終的にもう一度 zod で非負整数検証する。
  const validatedClassified = classifiedWorkMinutesSchema.parse(classified);

  return {
    classified: validatedClassified,
    totalWorkedMinutes,
    totalAbsenceMinutes,
    workDayCount: workDays.length,
  };
}
