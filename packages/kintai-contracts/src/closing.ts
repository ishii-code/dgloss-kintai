/**
 * 月次締め。当月1日〜末日を集計し、割増・控除・総労働時間を確定する（賃金規程第6条）。
 * Shadow Mode では jinjer の締め結果と 1 円単位で突合する対象になる。
 */

import type {
  ClassifiedWorkMinutes,
} from "./attendance.js";
import type {
  EmployeeId,
  Minutes,
  MonthlyClosingId,
  Yen,
  YearMonth,
} from "./common.js";

/** 手当区分別の割増賃金（円）。@dgloss-kintai/core の WagePremiumBreakdown と構造一致。 */
export interface WagePremiumBreakdown {
  readonly overtimeAllowance: Yen;
  readonly overtimeOver60Allowance: Yen;
  readonly holidayAllowance: Yen;
  readonly nightAllowance: Yen;
  readonly total: Yen;
}

/** 締めステータス。 */
export type ClosingStatus = "open" | "closed";

/** 月次締めレコード。 */
export interface MonthlyClosing {
  readonly id: MonthlyClosingId;
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
  readonly status: ClosingStatus;
  /** 月内の総労働時間（分）。 */
  readonly totalWorkedMinutes: Minutes;
  /** 区分別の月内労働時間（分）。 */
  readonly classified: ClassifiedWorkMinutes;
  /** 割増賃金（区分別）。 */
  readonly premium: WagePremiumBreakdown;
  /** 固定時間外勤務手当との差額支給（第20条4項）。 */
  readonly fixedOvertimeAdditionalPayment: Yen;
  /** 遅刻早退等の控除額（第21条）。 */
  readonly latenessDeduction: Yen;
  /** 締め確定時刻（open のとき null）。 */
  readonly closedAt: string | null;
}

/**
 * Shadow Mode の突合結果。自作エンジンと jinjer の締めを 1 円単位で比較する（Ph2）。
 */
export interface ShadowComparison {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
  /** 自作エンジンの割増合計。 */
  readonly ownPremiumTotal: Yen;
  /** jinjer 側の割増合計。 */
  readonly jinjerPremiumTotal: Yen;
  /** 差額（own − jinjer・円）。0 なら一致。 */
  readonly premiumDiff: number;
  /** 総労働時間の差（分）。 */
  readonly workedMinutesDiff: number;
  readonly matched: boolean;
}
