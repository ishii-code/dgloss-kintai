/**
 * 遅刻・早退・私用外出等の不就労控除（賃金規程第21条）。
 *
 *   控除額 = 基本給 ÷ 月間平均所定労働時間数 × 遅刻・早退・私用外出の合計時間数
 *
 * 端数は切り捨てる（第21条2項）。割増（切り上げ）とは丸め方向が逆である点に注意。
 * 整数式に展開: 控除額 = 基本給 × 12 × 控除分 ÷ 年間所定分
 */

import { annualScheduledMinutesOf, resolveWagePremiumConfig } from "./config.js";
import type { WagePremiumConfig } from "./config.js";
import { floorDiv } from "./money.js";

/** 遅刻早退控除の入力に必要な最小限のプロフィール。 */
export interface DeductionProfile {
  /** 基本給（月額・円・整数）。 */
  basicSalary: number;
}

/**
 * 遅刻・早退・私用外出等の控除額を算定する（賃金規程第21条）。
 *
 * @param profile              基本給
 * @param totalAbsenceMinutes  遅刻・早退・私用外出の合計時間（分）
 * @param config               年間所定労働時間などの設定
 * @returns 控除額（円・整数、切り捨て済み）
 */
export function calculateLatenessDeduction(
  profile: DeductionProfile,
  totalAbsenceMinutes: number,
  config: WagePremiumConfig,
): number {
  if (!Number.isInteger(profile.basicSalary) || profile.basicSalary < 0) {
    throw new RangeError("basicSalary must be a non-negative integer");
  }
  if (!Number.isInteger(totalAbsenceMinutes) || totalAbsenceMinutes < 0) {
    throw new RangeError("totalAbsenceMinutes must be a non-negative integer");
  }

  const { annualScheduledWorkingHours } = resolveWagePremiumConfig(config);
  const annualScheduledMinutes = annualScheduledMinutesOf(
    annualScheduledWorkingHours,
  );

  const numerator =
    BigInt(profile.basicSalary) * 12n * BigInt(totalAbsenceMinutes);
  const denominator = BigInt(annualScheduledMinutes);

  return Number(floorDiv(numerator, denominator));
}
