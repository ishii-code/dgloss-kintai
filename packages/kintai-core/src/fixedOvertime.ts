/**
 * 固定時間外勤務手当（みなし残業）との差額調整（賃金規程第18条〜第20条4項）。
 *
 * 第20条4項:
 *   割増賃金は原則として固定時間外勤務手当として支給する。
 *   ただし固定時間外勤務手当の額が第2項・第3項で算出された金額に満たない場合は、
 *   その差額を支給する。
 *
 * 第18条2項:
 *   固定時間外勤務手当は、時間内・時間外・休日・深夜・60時間超の全部又は一部として、
 *   労働基準法第41条2号該当者（管理監督者）を除く社員に原則支給する（充当範囲は雇用契約による）。
 *
 * すなわち支給額 = max(固定額, 充当対象区分の算出合計) + 固定が充当しない区分の算出全額。
 */

import type { WagePremiumBreakdown } from "./types.js";

/** 固定時間外勤務手当が充当対象とする手当区分（雇用契約ごとに定める、第18条2項）。 */
export interface FixedOvertimeCoveredComponents {
  /** 時間外勤務手当 */
  overtime: boolean;
  /** 時間外勤務60時間超手当 */
  overtimeOver60: boolean;
  /** 休日勤務手当 */
  holiday: boolean;
  /** 深夜勤務手当 */
  night: boolean;
}

/** 雇用契約に定める固定時間外勤務手当の設定（config 外出し）。 */
export interface FixedOvertimeContract {
  /** 固定時間外勤務手当の月額（円・整数）。原則支給される（第18条1項）。 */
  fixedOvertimeAllowance: number;
  /** 固定額が充当する手当区分（第18条2項「全部又は一部」）。 */
  coveredComponents: FixedOvertimeCoveredComponents;
}

/** 固定時間外勤務手当との差額調整の結果。 */
export interface SettledWagePremium {
  /** 算出された割増賃金（手当区分別・実額）。 */
  calculated: WagePremiumBreakdown;
  /** 原則支給される固定時間外勤務手当の額。 */
  fixedOvertimeAllowance: number;
  /** 固定が充当する区分の算出合計。 */
  coveredCalculatedTotal: number;
  /** 差額支給額（充当対象の超過分）＝ max(0, coveredCalculatedTotal − 固定額)。 */
  additionalPayment: number;
  /** 固定が充当しない区分の算出全額。 */
  uncoveredPayment: number;
  /**
   * 当月に実際に支給される割増賃金の総額。
   * = 固定額 + 差額支給 + 固定が充当しない区分の全額
   * = max(固定額, coveredCalculatedTotal) + uncoveredPayment
   */
  totalPaid: number;
}

/**
 * 算出済みの割増賃金に固定時間外勤務手当を適用し、差額支給額を求める（第20条4項）。
 *
 * 管理監督者には固定時間外勤務手当を支給しないため（第18条2項）、この関数は
 * 非管理監督者に対して用いる。管理監督者の割増（深夜のみ）は差額調整の対象外。
 */
export function settleWithFixedOvertime(
  calculated: WagePremiumBreakdown,
  contract: FixedOvertimeContract,
): SettledWagePremium {
  const { fixedOvertimeAllowance, coveredComponents } = contract;
  if (
    !Number.isInteger(fixedOvertimeAllowance) ||
    fixedOvertimeAllowance < 0
  ) {
    throw new RangeError(
      "fixedOvertimeAllowance must be a non-negative integer",
    );
  }

  let coveredCalculatedTotal = 0;
  let uncoveredPayment = 0;

  const apply = (amount: number, covered: boolean): void => {
    if (covered) {
      coveredCalculatedTotal += amount;
    } else {
      uncoveredPayment += amount;
    }
  };

  apply(calculated.overtimeAllowance, coveredComponents.overtime);
  apply(calculated.overtimeOver60Allowance, coveredComponents.overtimeOver60);
  apply(calculated.holidayAllowance, coveredComponents.holiday);
  apply(calculated.nightAllowance, coveredComponents.night);

  const additionalPayment = Math.max(
    0,
    coveredCalculatedTotal - fixedOvertimeAllowance,
  );
  const totalPaid = fixedOvertimeAllowance + additionalPayment + uncoveredPayment;

  return {
    calculated,
    fixedOvertimeAllowance,
    coveredCalculatedTotal,
    additionalPayment,
    uncoveredPayment,
    totalPaid,
  };
}
