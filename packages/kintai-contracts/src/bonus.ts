/**
 * 賞与明細（総支給まで）。賞与計算エンジン（@dgloss-kintai/core）の内訳から組み立てる。
 *
 * スコープ方針: 給与明細と同じく、所得税・社会保険料（賞与分）は毎年の法改正が入る重量級のため
 * 当面自作せず、jinjer/給与ソフトへ連携する。本明細は「総支給賞与」までを確定し、
 * 法定控除は外部連携（未計上）として明示する。
 *
 * 賞与は裁量的（規程に算定式の定めなし）。非正規は賞与なし（就業規則第72条）。
 */

import { z } from "zod";
import type { EmployeeId, Yen } from "./common.js";

/** 賞与明細の1行。調整はマイナスもありうるため符号付き整数で持つ。 */
export interface BonusStatementLine {
  /** 表示名（例「基本賞与」「評価調整」「在籍按分調整」）。 */
  readonly label: string;
  /** 金額（円・整数・負値可）。 */
  readonly amount: number;
  /** 補足（例「評価係数 110%」「外部連携・未計上」）。 */
  readonly note?: string;
}

/** 賞与明細（1従業員・1支給期）。 */
export interface BonusStatement {
  readonly employeeId: EmployeeId;
  /** 支給期の表示名（例「2026年 夏季賞与」）。 */
  readonly label: string;
  /** 支給対象か（非正規は false＝就業規則第72条）。 */
  readonly eligible: boolean;
  /** 内訳（基本賞与・評価調整・在籍按分調整・その他調整）。 */
  readonly lines: readonly BonusStatementLine[];
  /** 総支給賞与（0 未満にはならない）。 */
  readonly grossBonus: Yen;
  /**
   * 所得税・社会保険料（賞与分）など、外部連携で確定する法定控除のプレースホルダ（金額0・未計上）。
   */
  readonly statutoryPlaceholders: readonly BonusStatementLine[];
}

/**
 * 賞与計算の入力パラメータ（係数は「×100 の整数」）。
 * 例) 支給月数 2.5 = 250、評価係数 110% = 110、在籍按分 100% = 100。
 */
export const bonusParamsSchema = z.object({
  /** 支給月数（×100）。0〜1200（＝0〜12.00 月）。 */
  monthsMultiplier: z.number().int().min(0).max(1200),
  /** 評価係数（×100・百分率）。0〜300（＝0〜300%）。 */
  evaluationRate: z.number().int().min(0).max(300),
  /** 在籍・出勤按分（×100・百分率）。0〜100（＝0〜100%）。 */
  attendanceRate: z.number().int().min(0).max(100),
  /** その他の加減額（円・整数・負値可）。 */
  adjustment: z.number().int().min(-100_000_000).max(100_000_000),
});

export type BonusParamsParsed = z.infer<typeof bonusParamsSchema>;
