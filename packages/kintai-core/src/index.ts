/**
 * @dgloss-kintai/core
 *
 * 勤怠計算エンジン。就業規則・賃金規程（株式会社ディグロス 2025.07.01版）を仕様とする。
 * 本モジュールは割増賃金（第20条）・遅刻早退控除（第21条）・固定時間外勤務手当の
 * 差額調整（第20条4項）を扱う。
 */

export { calculateWagePremium } from "./premium.js";
export { calculateLatenessDeduction } from "./deduction.js";
export type { DeductionProfile } from "./deduction.js";
export { settleWithFixedOvertime } from "./fixedOvertime.js";
export type {
  FixedOvertimeContract,
  FixedOvertimeCoveredComponents,
  SettledWagePremium,
} from "./fixedOvertime.js";
export {
  resolveWagePremiumConfig,
  annualScheduledMinutesOf,
  DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS,
} from "./config.js";
export type { WagePremiumConfig } from "./config.js";
export { RATE_BP, LINE_RATE_BP } from "./rates.js";
export { ceilDiv, floorDiv } from "./money.js";
export type {
  ClassifiedWorkMinutes,
  EmployeeWageProfile,
  WagePremiumBreakdown,
} from "./types.js";
