/**
 * 割増賃金の算定（賃金規程第20条）。
 *
 *   割増額 = 基本給 ÷ 月間平均所定労働時間 × 支給率 × 労働時間数
 *   月間平均所定労働時間 = 当該年度の所定労働時間数 ÷ 12
 *
 * 実装は月間平均所定を途中で丸めず、次の等価な整数式に展開して厳密に計算する:
 *
 *   割増額 = 基本給 × 12 × (Σ 支給率bp × 労働分) ÷ (年間所定分 × 100)
 *
 * 端数処理は賃金規程第4条の手当ライン単位で切り上げる（第20条3項5号）。
 */

import { annualScheduledMinutesOf, resolveWagePremiumConfig } from "./config.js";
import type { WagePremiumConfig } from "./config.js";
import { ceilDiv } from "./money.js";
import { LINE_RATE_BP } from "./rates.js";
import type {
  ClassifiedWorkMinutes,
  EmployeeWageProfile,
  WagePremiumBreakdown,
} from "./types.js";

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}

function validateInputs(
  profile: EmployeeWageProfile,
  minutes: ClassifiedWorkMinutes,
): void {
  assertNonNegativeInteger(profile.basicSalary, "basicSalary");
  assertNonNegativeInteger(
    minutes.nonStatutoryOvertimeMinutes,
    "nonStatutoryOvertimeMinutes",
  );
  assertNonNegativeInteger(
    minutes.statutoryOvertimeMinutes,
    "statutoryOvertimeMinutes",
  );
  assertNonNegativeInteger(minutes.legalHolidayMinutes, "legalHolidayMinutes");
  assertNonNegativeInteger(
    minutes.scheduledHolidayMinutes,
    "scheduledHolidayMinutes",
  );
  assertNonNegativeInteger(minutes.nightMinutes, "nightMinutes");
}

/**
 * 割増賃金を手当区分別に算定する（賃金規程第20条）。
 *
 * @param profile  従業員の基本給・管理監督者区分
 * @param minutes  区分別の月間労働時間（分）
 * @param config   年間所定労働時間などの設定
 */
export function calculateWagePremium(
  profile: EmployeeWageProfile,
  minutes: ClassifiedWorkMinutes,
  config: WagePremiumConfig,
): WagePremiumBreakdown {
  validateInputs(profile, minutes);
  const { annualScheduledWorkingHours, overtimeIncreasedRateThresholdHours } =
    resolveWagePremiumConfig(config);

  const annualScheduledMinutes = annualScheduledMinutesOf(
    annualScheduledWorkingHours,
  );

  // 割増額 = 基本給 × 12 × (Σ 支給率bp × 分) ÷ (年間所定分 × 100)
  const salaryTimesTwelve = BigInt(profile.basicSalary) * 12n;
  const denominator = BigInt(annualScheduledMinutes) * 100n;

  /** 手当ラインの合計（支給率bp × 分 の総和）を円に変換し、ライン単位で切り上げる。 */
  const yenForLine = (weightedBpMinutes: bigint): number =>
    Number(ceilDiv(salaryTimesTwelve * weightedBpMinutes, denominator));

  // 法定時間外を 60 時間しきい値で分割する（第20条3項2号(1)a,b）。
  const thresholdMinutes = overtimeIncreasedRateThresholdHours * 60;
  const overtimeWithinThresholdMinutes = Math.min(
    minutes.statutoryOvertimeMinutes,
    thresholdMinutes,
  );
  const overtimeOverThresholdMinutes =
    minutes.statutoryOvertimeMinutes - overtimeWithinThresholdMinutes;

  // 管理監督者には深夜勤務手当のみ支給する（第20条3項4号）。
  const managerial = profile.isManagerialEmployee;

  const overtimeAllowance = managerial
    ? 0
    : yenForLine(
        BigInt(LINE_RATE_BP.nonStatutoryOvertime) *
          BigInt(minutes.nonStatutoryOvertimeMinutes) +
          BigInt(LINE_RATE_BP.statutoryOvertimeWithin) *
            BigInt(overtimeWithinThresholdMinutes),
      );

  const overtimeOver60Allowance = managerial
    ? 0
    : yenForLine(
        BigInt(LINE_RATE_BP.statutoryOvertimeOver) *
          BigInt(overtimeOverThresholdMinutes),
      );

  const holidayAllowance = managerial
    ? 0
    : yenForLine(
        BigInt(LINE_RATE_BP.legalHoliday) *
          BigInt(minutes.legalHolidayMinutes) +
          BigInt(LINE_RATE_BP.scheduledHoliday) *
            BigInt(minutes.scheduledHolidayMinutes),
      );

  // 深夜勤務手当は管理監督者を含む全社員に支給する（第20条3項2号(3)a, 4号）。
  const nightAllowance = yenForLine(
    BigInt(LINE_RATE_BP.night) * BigInt(minutes.nightMinutes),
  );

  const total =
    overtimeAllowance +
    overtimeOver60Allowance +
    holidayAllowance +
    nightAllowance;

  return {
    overtimeAllowance,
    overtimeOver60Allowance,
    holidayAllowance,
    nightAllowance,
    total,
  };
}
