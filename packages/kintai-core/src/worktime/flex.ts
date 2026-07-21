/**
 * フレックスタイム制の清算（就業規則第48条 / 労働基準法第32条の3）。
 *
 * 清算期間を 1 か月（起算日=毎月1日）、標準の 1 日の労働時間を 8h、
 * コアタイムを 11:00-16:00 とするフレックスタイム制において、清算期間の実労働合計 W
 * から時間外労働（法定外・法定内残業）を確定し、割増計算エンジン `calculateWagePremium`
 * にそのまま渡せる `ClassifiedWorkMinutes`（区分別・分）へ変換する。
 *
 * 判定の基礎となる 2 つの「枠」:
 *  - 所定総労働時間 S = (清算期間の暦日数 − 所定休日数) × 標準 1 日 8h。
 *    これを上回る所定外労働が、まず法定内残業の候補になる。
 *  - 法定総枠 F = 清算期間の暦日数 × 40h ÷ 7（週平均 40h を清算期間全体へ引き延ばした総枠）。
 *    これを上回る分が法定時間外労働（割増 0.25/0.50 の対象）。
 *
 * 区分の確定（W = 清算期間の実労働合計・分）:
 *  - statutoryOvertimeMinutes    = max(0, W − F)                （法定総枠超・法定外）
 *  - nonStatutoryOvertimeMinutes = max(0, min(W, F) − S)        （所定超かつ法定内の残業）
 *  - nightMinutes                = 日ごとの労働区間を `nightOverlapMinutes` で算定し合算
 *    （フレックスでも深夜割増 0.25 は実際の深夜勤務に対して別途発生する）。
 *  - legalHolidayMinutes / scheduledHolidayMinutes は清算の枠外として、日次判定の結果を
 *    そのまま持ち込む（休日労働はフレックスの総労働時間清算に含めず休日割増で計上する）。
 *
 * 法定総枠 F は暦日数が 7 の倍数でない限り分単位で割り切れない（例: 31 日なら
 * 31 × 40 ÷ 7 = 177.142…h）。本実装は F を「分未満切り捨て」で整数化する。切り捨ては
 * F を小さく見積もる＝時間外を過小計上しない方向であり、当パッケージ全体の
 * 「取りこぼし（未払い）を防ぐ安全側」方針（validate.ts / weekly.ts）と一致する。
 * 端数を避けるため BigInt で計算してから Number に戻す。
 *
 * コアタイム（11:00-16:00）の遵守は勤怠ポリシー上の制約であり賃金額の算定式には影響しない
 * ため、本関数では検証しない（上位の勤怠判定レイヤーの責務）。
 */

import type { ClassifiedWorkMinutes } from "../types.js";
import { nightOverlapMinutes } from "../attendance/night.js";
import type { LaborInterval } from "../attendance/classify.js";
import { assertNonNegativeInteger } from "../attendance/validate.js";
import { floorDiv } from "../money.js";

/** 標準の 1 日の労働時間（分）。就業規則第48条。8h = 480 分。 */
export const FLEX_STANDARD_DAILY_MINUTES = 480;

/** 週法定労働時間（分）。40h = 2400 分。法定総枠 F の基礎（暦日数 × 40 ÷ 7）。 */
export const WEEKLY_STATUTORY_MINUTES = 2400;

/** フレックスタイム清算の入力。 */
export interface FlexPeriodInput {
  /** 清算期間の暦日数（例: 31）。非負整数。 */
  readonly calendarDays: number;
  /** 清算期間の所定休日数（例: 8）。非負整数、calendarDays 以下。 */
  readonly scheduledHolidayCount: number;
  /**
   * 清算期間の実労働合計 W（分・非負整数）。
   * 休憩控除後・フレックス清算の対象となる労働時間の総和（休日労働を除く）。
   */
  readonly actualWorkedMinutes: number;
  /**
   * 深夜割増の算定に用いる、日ごとの労働区間（休憩控除後）。
   * 各要素が 1 日分の労働区間の配列で、時刻は「その日の 00:00 からの絶対分」。
   * 深夜(22:00-5:00)の重なりのみを純粋に切り出して合算する（実労働 W とは独立に算定）。
   * 深夜勤務がなければ空配列でよい。
   */
  readonly dailyIntervals?: readonly (readonly LaborInterval[])[];
  /**
   * 標準の 1 日の労働時間（分）。既定 480（8h）。所定総労働時間 S の算定に用いる。
   * 労使協定で標準時間を変える場合のフックとして上書き可能にしてある。
   */
  readonly standardDailyMinutes?: number;
  /**
   * 清算期間中の法定休日労働（分・非負整数）。フレックス清算の枠外として休日割増で計上する。
   * 日次判定（classifyDay 等）の結果をそのまま渡す。既定 0。
   */
  readonly legalHolidayMinutes?: number;
  /**
   * 清算期間中の所定休日労働（分・非負整数）。フレックス清算の枠外として休日割増で計上する。
   * 既定 0。
   */
  readonly scheduledHolidayMinutes?: number;
}

/**
 * 清算期間の法定総枠 F（分・整数、分未満切り捨て）を返す。
 * F = 暦日数 × 40h ÷ 7。BigInt で計算し端数誤差を排除する。
 */
export function legalTotalFrameMinutes(calendarDays: number): number {
  assertNonNegativeInteger(calendarDays, "calendarDays");
  return Number(
    floorDiv(BigInt(calendarDays) * BigInt(WEEKLY_STATUTORY_MINUTES), 7n),
  );
}

/**
 * 清算期間の所定総労働時間 S（分・整数）を返す。
 * S = (暦日数 − 所定休日数) × 標準 1 日労働時間。
 */
export function scheduledTotalMinutes(
  calendarDays: number,
  scheduledHolidayCount: number,
  standardDailyMinutes: number = FLEX_STANDARD_DAILY_MINUTES,
): number {
  assertNonNegativeInteger(calendarDays, "calendarDays");
  assertNonNegativeInteger(scheduledHolidayCount, "scheduledHolidayCount");
  assertNonNegativeInteger(standardDailyMinutes, "standardDailyMinutes");
  if (scheduledHolidayCount > calendarDays) {
    throw new RangeError(
      "scheduledHolidayCount must not exceed calendarDays",
    );
  }
  return (calendarDays - scheduledHolidayCount) * standardDailyMinutes;
}

/**
 * フレックスタイム制の清算期間を締め、区分別労働時間（分）を確定する。
 *
 * @param input 暦日数・所定休日数・実労働合計 W・深夜算定用の日次労働区間など
 * @returns 割増計算エンジン `calculateWagePremium` にそのまま渡せる `ClassifiedWorkMinutes`
 */
export function settleFlexPeriod(input: FlexPeriodInput): ClassifiedWorkMinutes {
  const standardDailyMinutes =
    input.standardDailyMinutes ?? FLEX_STANDARD_DAILY_MINUTES;
  const legalHolidayMinutes = input.legalHolidayMinutes ?? 0;
  const scheduledHolidayMinutes = input.scheduledHolidayMinutes ?? 0;

  assertNonNegativeInteger(input.actualWorkedMinutes, "actualWorkedMinutes");
  assertNonNegativeInteger(legalHolidayMinutes, "legalHolidayMinutes");
  assertNonNegativeInteger(scheduledHolidayMinutes, "scheduledHolidayMinutes");

  const scheduledTotal = scheduledTotalMinutes(
    input.calendarDays,
    input.scheduledHolidayCount,
    standardDailyMinutes,
  );
  const legalFrame = legalTotalFrameMinutes(input.calendarDays);

  const W = input.actualWorkedMinutes;

  // 法定総枠超 → 法定時間外労働。
  const statutoryOvertimeMinutes = Math.max(0, W - legalFrame);
  // 所定超かつ法定内 → 法定内残業（時給相当分 1.00）。
  const nonStatutoryOvertimeMinutes = Math.max(
    0,
    Math.min(W, legalFrame) - scheduledTotal,
  );

  // 深夜は日ごとの労働区間から実際の深夜帯の重なりを合算する。
  let nightMinutes = 0;
  for (const dayIntervals of input.dailyIntervals ?? []) {
    for (const interval of dayIntervals) {
      assertNonNegativeInteger(interval.startMinute, "interval.startMinute");
      assertNonNegativeInteger(interval.endMinute, "interval.endMinute");
      if (interval.endMinute <= interval.startMinute) {
        throw new RangeError(
          "labor interval must have endMinute greater than startMinute",
        );
      }
      nightMinutes += nightOverlapMinutes(
        interval.startMinute,
        interval.endMinute,
      );
    }
  }

  return {
    nonStatutoryOvertimeMinutes,
    statutoryOvertimeMinutes,
    legalHolidayMinutes,
    scheduledHolidayMinutes,
    nightMinutes,
  };
}
