/**
 * 賞与計算エンジン（賃金規程・就業規則）。
 *
 * 賞与額の算定式は規程に定めがなく裁量的（会社業績・個人評価による）。本エンジンは
 * 「基本給 × 支給月数 × 評価係数 × 在籍按分 ＋ 調整額」を 1 円単位で厳密に算出する。
 * 端数は四捨五入（賞与は法令で端数処理が定められないため慣行に従う。割増・控除の
 * 切り上げ／切り捨てとは別扱い）。
 *
 * 支給対象: 非正規（non_regular）は賞与なし（就業規則第72条）→ 総支給 0。
 *
 * 係数はすべて整数で受け渡し、浮動小数点を持ち込まない:
 * - monthsMultiplier / evaluationRate / attendanceRate は「×100 の整数」（百分率・2桁小数相当）。
 *   例) 2.5 月 = 250、評価係数 110% = 110、在籍按分 100% = 100。
 * - basicSalary / adjustment / 各金額は円・整数。
 */

import { roundDiv } from "./money.js";

/** 支給率のスケール（×100 = 百分率・2桁小数相当）。 */
const RATE_SCALE = 100n;

/** 賞与計算の従業員プロフィール。 */
export interface BonusProfile {
  /** 基本給（月額・円・整数・非負）。 */
  basicSalary: number;
  /** 雇用区分。non_regular は賞与なし（就業規則第72条）。 */
  employmentType: "regular" | "non_regular";
}

/** 賞与計算のパラメータ（いずれも整数）。 */
export interface BonusParams {
  /** 支給月数（×100）。例) 2.5 月 = 250。非負。 */
  monthsMultiplier: number;
  /** 評価係数（×100・百分率）。例) 110% = 110。非負。 */
  evaluationRate: number;
  /** 在籍・出勤按分（×100・百分率）。例) 100% = 100。非負。 */
  attendanceRate: number;
  /** その他の加減額（円・整数・負値可）。 */
  adjustment: number;
}

/** 賞与の内訳（各金額は円・整数）。 */
export interface BonusBreakdown {
  /** 支給対象か（非正規は false＝就業規則第72条）。 */
  eligible: boolean;
  /** 基本賞与（基本給 × 支給月数）。 */
  baseAmount: number;
  /** 評価調整（評価反映後 − 基本賞与）。 */
  evaluationAdjustment: number;
  /** 在籍按分調整（按分後 − 評価反映後）。 */
  attendanceAdjustment: number;
  /** その他の調整額（パラメータの adjustment）。 */
  otherAdjustment: number;
  /** 総支給賞与（0 未満にはならない）。 */
  grossBonus: number;
}

/** 整数・非負を検証する（不正は RangeError）。 */
function requireNonNegativeInt(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

/**
 * 賞与を算定する（純粋関数・1 円単位厳密）。
 *
 * 段階ごとに四捨五入して円に落とし、差分を内訳として返す:
 *  1. 基本賞与 = round(基本給 × 支給月数 / 100)
 *  2. 評価反映後 = round(基本賞与 × 評価係数 / 100)
 *  3. 在籍按分後 = round(評価反映後 × 在籍按分 / 100)
 *  4. 総支給 = max(0, 在籍按分後 + 調整額)
 *
 * @param profile 従業員プロフィール（基本給・雇用区分）
 * @param params  支給月数・評価係数・在籍按分・調整額（係数は ×100 整数）
 */
export function calculateBonus(
  profile: BonusProfile,
  params: BonusParams,
): BonusBreakdown {
  requireNonNegativeInt(profile.basicSalary, "basicSalary");
  requireNonNegativeInt(params.monthsMultiplier, "monthsMultiplier");
  requireNonNegativeInt(params.evaluationRate, "evaluationRate");
  requireNonNegativeInt(params.attendanceRate, "attendanceRate");
  if (!Number.isInteger(params.adjustment)) {
    throw new RangeError("adjustment must be an integer");
  }

  // 非正規は賞与なし（就業規則第72条）。
  if (profile.employmentType === "non_regular") {
    return {
      eligible: false,
      baseAmount: 0,
      evaluationAdjustment: 0,
      attendanceAdjustment: 0,
      otherAdjustment: 0,
      grossBonus: 0,
    };
  }

  const basic = BigInt(profile.basicSalary);
  const months = BigInt(params.monthsMultiplier);
  const evaluation = BigInt(params.evaluationRate);
  const attendance = BigInt(params.attendanceRate);
  const adjustment = BigInt(params.adjustment);

  const base = roundDiv(basic * months, RATE_SCALE);
  const evaluated = roundDiv(base * evaluation, RATE_SCALE);
  const prorated = roundDiv(evaluated * attendance, RATE_SCALE);
  const grossSigned = prorated + adjustment;
  const gross = grossSigned < 0n ? 0n : grossSigned;

  return {
    eligible: true,
    baseAmount: Number(base),
    evaluationAdjustment: Number(evaluated - base),
    attendanceAdjustment: Number(prorated - evaluated),
    otherAdjustment: params.adjustment,
    grossBonus: Number(gross),
  };
}
