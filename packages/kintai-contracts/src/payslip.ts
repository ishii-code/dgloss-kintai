/**
 * 給与明細（総支給まで）。月次締めの割増・控除と雇用契約の基本給・手当から組み立てる。
 *
 * スコープ方針: 所得税・社会保険料は毎年の法改正が入る重量級のため当面自作せず、
 * jinjer/給与ソフトへ連携する。本明細は「総支給額」と「自社計上の控除（遅刻早退等）」まで
 * を確定し、所得税・社保は外部連携（未計上）として明示する。
 */

import type { EmployeeId, IsoDateTime, YearMonth, Yen } from "./common.js";

/** 明細の1行（支給または控除）。金額は円・整数。 */
export interface PayslipLine {
  /** 表示名（例「基本給」「時間外勤務手当」「遅刻早退控除」）。 */
  readonly label: string;
  /** 金額（円）。支給・控除いずれも正の額で持ち、区分は配列で分ける。 */
  readonly amount: Yen;
  /** 補足（例「差額支給」「外部連携・未計上」）。 */
  readonly note?: string;
}

/** 給与明細（1従業員・1か月）。 */
export interface Payslip {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
  /** 支給項目（基本給・各種手当・割増）。 */
  readonly earnings: readonly PayslipLine[];
  /** 総支給額（支給の合計）。 */
  readonly grossPay: Yen;
  /** 自社で計上する控除（遅刻早退控除等）。 */
  readonly deductions: readonly PayslipLine[];
  /** 控除合計（自社計上分のみ）。 */
  readonly totalDeductions: Yen;
  /**
   * 差引支給額（所得税・社会保険料の控除前）。
   * = 総支給額 − 自社計上の控除。所得税・社保は {@link statutoryPlaceholders} 参照。
   */
  readonly netBeforeStatutory: Yen;
  /**
   * 所得税・社会保険料など、外部連携で確定する法定控除のプレースホルダ（金額0・未計上）。
   * jinjer/給与ソフト側で計算する前提。
   */
  readonly statutoryPlaceholders: readonly PayslipLine[];
}
