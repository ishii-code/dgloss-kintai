/**
 * `ClassifiedWorkMinutes`（区分別労働時間）から、36協定の判定に必要な
 * 月次の時間外労働・休日労働を集計する純粋関数群。
 *
 * 集計方針:
 * - 時間外労働（overtimeMinutes）＝ `statutoryOvertimeMinutes`。
 *   これは法定時間外労働の総量で、60時間超の割増分（over60）も含む
 *   （エンジンは 60時間しきい値で割増率を分けるだけで、総量はこの1フィールドに集約される）。
 *   法定内残業（`nonStatutoryOvertimeMinutes`）は 36協定の対象外なので含めない。
 * - 休日労働（holidayMinutes）＝ `legalHolidayMinutes`（法定休日労働）。
 *   単月100時間未満・複数月平均80時間以下の「時間外＋休日」に用いる。
 *   所定休日労働（`scheduledHolidayMinutes`）は週40時間超過分として
 *   既に `statutoryOvertimeMinutes` に反映済みという勤怠判定レイヤーの前提により、
 *   二重計上を避けるためここには含めない。
 */

import { z } from "zod";
import type { ClassifiedWorkMinutes, YearMonth } from "@dgloss-kintai/contracts";
import {
  classifiedWorkMinutesSchema,
  yearMonthSchema,
} from "@dgloss-kintai/contracts";

/** 36協定判定用の月次時間外・休日労働（分・整数）。 */
export interface MonthlyOvertime {
  /** 対象年月。 */
  readonly period: YearMonth;
  /** 時間外労働の月合計（分）。休日労働は含まない。 */
  readonly overtimeMinutes: number;
  /** 法定休日労働の月合計（分）。 */
  readonly holidayMinutes: number;
}

/** `MonthlyOvertime` の zod スキーマ（外部入力検証用）。 */
export const monthlyOvertimeSchema = z.object({
  period: yearMonthSchema,
  overtimeMinutes: z.number().int().nonnegative(),
  holidayMinutes: z.number().int().nonnegative(),
});

/**
 * ある月の区分別労働時間（日次または月次合計の配列）を合算し、
 * 36協定判定用の {@link MonthlyOvertime} を作る純粋関数。
 *
 * 外部入力を扱うため、各要素と年月を zod で検証する。
 *
 * @param period 対象年月。
 * @param classified 当月の区分別労働時間の配列（日次でも、単月合計1件でもよい）。
 * @returns 月次の時間外・休日労働。
 */
export function aggregateMonthlyOvertime(
  period: YearMonth,
  classified: readonly ClassifiedWorkMinutes[],
): MonthlyOvertime {
  const parsedPeriod = yearMonthSchema.parse(period);
  let overtimeMinutes = 0;
  let holidayMinutes = 0;
  for (const raw of classified) {
    const c = classifiedWorkMinutesSchema.parse(raw);
    overtimeMinutes += c.statutoryOvertimeMinutes;
    holidayMinutes += c.legalHolidayMinutes;
  }
  return {
    period: { year: parsedPeriod.year, month: parsedPeriod.month },
    overtimeMinutes,
    holidayMinutes,
  };
}

/** 時間外＋休日労働の合計（分）。単月100時間・複数月平均80時間の判定に用いる。 */
export function overtimePlusHoliday(m: MonthlyOvertime): number {
  return m.overtimeMinutes + m.holidayMinutes;
}
