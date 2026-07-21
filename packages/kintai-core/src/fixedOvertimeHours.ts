/**
 * 固定時間外勤務手当を「時間数」から算出するヘルパー（非正規社員就業規則 第71条⑥・第72条）。
 *
 * 非正規社員（アルバイトを除く）には、時間外勤務手当相当額を固定残業手当として
 * あらかじめ支給する。支給する「時間分」は職種で異なり、事務職は20時間分・
 * その他は40時間分を既定とする（第71条⑥）。割増賃金は原則この固定残業手当として
 * 支給し、実際の算出額が固定額を超えた分のみ差額を支給する（第72条、既存
 * `settleWithFixedOvertime` が担う）。時間外の支給率は正社員と同じ 1.25
 * （時給相当分 1.00 ＋ 割増分 0.25、賃金規程第20条3項2号(1)a）。
 *
 * 固定残業手当（円）
 *   = 基本給 ÷ 月間平均所定労働時間 × 1.25 × 固定残業時間（端数切り上げ）
 *   （賃金規程第20条の割増額算式を固定時間分に適用したもの）
 *
 * 月間平均所定を途中で丸めないよう、既存 `premium.ts` と同じく次の等価な整数式に
 * 展開し、最後に整数除算で切り上げる（賃金規程第20条3項5号と同じ丸め）:
 *
 *   固定残業手当 = 基本給 × 12 × 125 × (固定残業時間 × 60) ÷ (年間所定分 × 100)
 *
 * @module
 */

import { annualScheduledMinutesOf, resolveWagePremiumConfig } from "./config.js";
import type { WagePremiumConfig } from "./config.js";
import { ceilDiv } from "./money.js";
import { LINE_RATE_BP } from "./rates.js";
import type { EmployeeWageProfile } from "./types.js";

/**
 * 非正規社員（アルバイトを除く）に固定残業手当として支給する時間外勤務の「時間分」既定値
 * （非正規社員就業規則 第71条⑥）。
 *
 * 事務職は20時間分・その他の職種は40時間分を既定とする。これはあくまで既定値であり、
 * 個別の雇用契約でこれと異なる時間数を定めた場合は契約が優先する（契約による上書き可）。
 */
export const NON_REGULAR_FIXED_OVERTIME_HOURS = {
  /** 事務職: 20時間分（第71条⑥）。 */
  office: 20,
  /** その他の職種: 40時間分（第71条⑥）。 */
  other: 40,
} as const;

/**
 * 固定残業時間（時間）を「分」の整数に変換する。
 *
 * 打刻・割増計算はすべて分単位の整数で扱うため、0.5時間刻み等も分の整数に落とせる
 * 必要がある（例: 0.3h → 18分は可、0.01h → 0.6分は不可）。分の整数にならない値は
 * 未払い・過払いに直結するため `RangeError` で弾く。
 */
function fixedOvertimeMinutesOf(fixedOvertimeHours: number): number {
  if (!Number.isFinite(fixedOvertimeHours) || fixedOvertimeHours < 0) {
    throw new RangeError(
      "fixedOvertimeHours must be a non-negative finite number",
    );
  }
  const minutes = fixedOvertimeHours * 60;
  const rounded = Math.round(minutes);
  if (Math.abs(minutes - rounded) > 1e-6) {
    throw new RangeError(
      "fixedOvertimeHours must resolve to a whole number of minutes",
    );
  }
  return rounded;
}

/**
 * 固定残業時間（時間数）から固定時間外勤務手当（円・整数）を算出する
 * （非正規社員就業規則 第71条⑥、賃金規程第20条3項2号(1)a・5号）。
 *
 * 支給率は正社員の時間外と同じ 1.25（`LINE_RATE_BP.statutoryOvertimeWithin`）。
 * 端数は賃金規程第20条3項5号に従い 1 円単位で切り上げる。浮動小数点を用いず、
 * 分子・分母をすべて bigint 整数に落として `ceilDiv` で計算する。
 *
 * 算出した金額は、`FixedOvertimeContract.fixedOvertimeAllowance`（固定額）として
 * `settleWithFixedOvertime` に渡すことで、実際の割増賃金との差額調整に用いる。
 *
 * @example
 * // 事務職（既定20時間分）の固定残業手当を求め、差額調整に渡す。
 * const fixed = fixedOvertimeAllowanceFromHours(
 *   profile,
 *   NON_REGULAR_FIXED_OVERTIME_HOURS.office,
 *   config,
 * );
 * const settled = settleWithFixedOvertime(calculated, {
 *   fixedOvertimeAllowance: fixed,
 *   coveredComponents: { overtime: true, overtimeOver60: true, holiday: false, night: false },
 * });
 *
 * @param profile             従業員の賃金プロフィール（基本給を用いる）。
 * @param fixedOvertimeHours  固定残業時間（時間）。分の整数に落とせる非負値。
 * @param config              年間所定労働時間などの設定。
 * @returns 固定時間外勤務手当（円・整数、切り上げ済み）。
 */
export function fixedOvertimeAllowanceFromHours(
  profile: EmployeeWageProfile,
  fixedOvertimeHours: number,
  config: WagePremiumConfig,
): number {
  if (!Number.isInteger(profile.basicSalary) || profile.basicSalary < 0) {
    throw new RangeError("basicSalary must be a non-negative integer");
  }

  const fixedOvertimeMinutes = fixedOvertimeMinutesOf(fixedOvertimeHours);

  const { annualScheduledWorkingHours } = resolveWagePremiumConfig(config);
  const annualScheduledMinutes = annualScheduledMinutesOf(
    annualScheduledWorkingHours,
  );

  // 固定残業手当 = 基本給 × 12 × 125 × (固定残業時間 × 60) ÷ (年間所定分 × 100)
  const numerator =
    BigInt(profile.basicSalary) *
    12n *
    BigInt(LINE_RATE_BP.statutoryOvertimeWithin) *
    BigInt(fixedOvertimeMinutes);
  const denominator = BigInt(annualScheduledMinutes) * 100n;

  return Number(ceilDiv(numerator, denominator));
}
