/**
 * 特殊な労働時間制の清算・区分判定レイヤー。
 *
 * フレックスタイム制の清算期間集計（就業規則第48条）と事業場外みなし労働
 * （第50条・第72条）を、割増計算エンジン `calculateWagePremium` の入力
 * `ClassifiedWorkMinutes`（区分別・分）へ変換する。日 8h／週 40h の通常の
 * 日次判定（../attendance）とは前提が異なるため独立モジュールとして分離する。
 */

export {
  settleFlexPeriod,
  legalTotalFrameMinutes,
  scheduledTotalMinutes,
  FLEX_STANDARD_DAILY_MINUTES,
  WEEKLY_STATUTORY_MINUTES,
} from "./flex.js";
export type { FlexPeriodInput } from "./flex.js";
export {
  deemedWorkMinutes,
  DAILY_STATUTORY_MINUTES,
} from "./deemed.js";
export type {
  DeemedWorkOptions,
  ClassifiedTimeContribution,
} from "./deemed.js";
