/**
 * 勤怠判定レイヤー（打刻 → 区分別労働時間）。
 *
 * 上位が確定した労働区間と日の文脈から、割増計算エンジン `calculateWagePremium` の入力
 * `ClassifiedWorkMinutes` を算出する。深夜(22:00-5:00)・法定/所定休日ルーティング・
 * 日 8h／週 40h の時間外分割を就業規則・賃金規程に従って行う。
 */

export {
  classifyDailyWork,
  classifyDay,
  DAILY_STATUTORY_MINUTES,
} from "./classify.js";
export type {
  LaborInterval,
  DailyWorkInput,
  DailyClassification,
} from "./classify.js";
export {
  applyWeeklyOvertime,
  WEEKLY_STATUTORY_MINUTES,
} from "./weekly.js";
export type { WeeklyOvertimeOptions } from "./weekly.js";
export { aggregateMonthly } from "./monthly.js";
export {
  nightOverlapMinutes,
  MINUTES_PER_DAY,
  NIGHT_LATE_START_MINUTE,
  NIGHT_EARLY_END_MINUTE,
} from "./night.js";
