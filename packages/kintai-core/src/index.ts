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
  fixedOvertimeAllowanceFromHours,
  NON_REGULAR_FIXED_OVERTIME_HOURS,
} from "./fixedOvertimeHours.js";
export {
  resolveWagePremiumConfig,
  annualScheduledMinutesOf,
  DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS,
} from "./config.js";
export type { WagePremiumConfig } from "./config.js";
export { RATE_BP, LINE_RATE_BP } from "./rates.js";
export { ceilDiv, floorDiv, roundDiv } from "./money.js";
export { calculateBonus } from "./bonus.js";
export type {
  BonusProfile,
  BonusParams,
  BonusBreakdown,
} from "./bonus.js";
export type {
  ClassifiedWorkMinutes,
  EmployeeWageProfile,
  WagePremiumBreakdown,
} from "./types.js";

// 勤怠判定レイヤー（打刻 → 区分別労働時間）。
export {
  classifyDailyWork,
  classifyDay,
  applyWeeklyOvertime,
  aggregateMonthly,
  nightOverlapMinutes,
  DAILY_STATUTORY_MINUTES,
  WEEKLY_STATUTORY_MINUTES,
  MINUTES_PER_DAY,
  NIGHT_LATE_START_MINUTE,
  NIGHT_EARLY_END_MINUTE,
} from "./attendance/index.js";
export type {
  LaborInterval,
  DailyWorkInput,
  DailyClassification,
  WeeklyOvertimeOptions,
} from "./attendance/index.js";

// 特殊な労働時間制の清算・区分判定（フレックス清算・事業場外みなし）。
export {
  settleFlexPeriod,
  legalTotalFrameMinutes,
  scheduledTotalMinutes,
  deemedWorkMinutes,
  FLEX_STANDARD_DAILY_MINUTES,
} from "./worktime/index.js";
export type {
  FlexPeriodInput,
  DeemedWorkOptions,
  ClassifiedTimeContribution,
} from "./worktime/index.js";
