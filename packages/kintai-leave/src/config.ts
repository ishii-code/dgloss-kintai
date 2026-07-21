/**
 * 年次有給休暇エンジンの設定（就業規則第61条・労基法第39条）。
 *
 * 付与日数テーブルは法定既定（{@link LEGAL_GRANT_TABLE}）を持ちつつ、
 * 会社独自の前倒し付与等を config で上書きできるようにする。
 */

import { z } from "zod";

/** 付与日数テーブルの1行（勤続月数の下限→付与日数）。 */
export interface GrantTableRow {
  /** この付与日数が適用される「継続勤務月数」の下限（以上）。 */
  readonly minMonths: number;
  /** 付与日数。 */
  readonly days: number;
}

/** 年次有給休暇エンジンの設定一式。 */
export interface LeaveConfig {
  /**
   * 勤続月数→付与日数テーブル。`minMonths` 昇順を想定するが、
   * 順不同でも「`minMonths <= 勤続月数` を満たす最大の行」を採用する。
   */
  readonly grantTable: readonly GrantTableRow[];
  /** 付与要件となる出勤率のしきい値（労基法第39条＝0.8＝8割）。 */
  readonly attendanceThreshold: number;
  /**
   * 繰越可能な年数。1＝翌年度のみ繰越（2年で時効消滅・労基法第115条）。
   * 各付与の時効消滅日は `付与日 + (carryoverYears + 1) 年`。
   */
  readonly carryoverYears: number;
  /** 半日取得1回あたりの消化日数（半日=4時間＝0.5日）。 */
  readonly halfDayFraction: number;
  /** 5日の時季指定義務が発生する付与日数のしきい値（年10日以上）。 */
  readonly fiveDayObligationThreshold: number;
  /** 時季指定義務で年間に取得させるべき日数（5日）。 */
  readonly fiveDayObligationDays: number;
}

/**
 * 法定の付与日数テーブル（労基法第39条・就業規則第61条）。
 * 出勤率8割以上が前提。8割未満の期間は付与0（{@link grantDaysFor} が判定）。
 *
 * | 継続勤務 | 付与 |
 * | -------- | ---- |
 * | 6か月     | 10   |
 * | 1年6か月  | 11   |
 * | 2年6か月  | 12   |
 * | 3年6か月  | 14   |
 * | 4年6か月  | 16   |
 * | 5年6か月  | 18   |
 * | 6年6か月〜| 20   |
 */
export const LEGAL_GRANT_TABLE: readonly GrantTableRow[] = [
  { minMonths: 6, days: 10 },
  { minMonths: 18, days: 11 },
  { minMonths: 30, days: 12 },
  { minMonths: 42, days: 14 },
  { minMonths: 54, days: 16 },
  { minMonths: 66, days: 18 },
  { minMonths: 78, days: 20 },
];

/** 法定既定の設定。会社独自ルールは {@link resolveLeaveConfig} で部分上書きする。 */
export const DEFAULT_LEAVE_CONFIG: LeaveConfig = {
  grantTable: LEGAL_GRANT_TABLE,
  attendanceThreshold: 0.8,
  carryoverYears: 1,
  halfDayFraction: 0.5,
  fiveDayObligationThreshold: 10,
  fiveDayObligationDays: 5,
};

/** 付与テーブル1行の検証スキーマ。 */
export const grantTableRowSchema = z.object({
  minMonths: z.number().int().nonnegative(),
  days: z.number().nonnegative(),
});

/** 設定一式の検証スキーマ（外部入力の上書きを検証する）。 */
export const leaveConfigSchema = z.object({
  grantTable: z.array(grantTableRowSchema).min(1),
  attendanceThreshold: z.number().min(0).max(1),
  carryoverYears: z.number().int().nonnegative(),
  halfDayFraction: z.number().positive().max(1),
  fiveDayObligationThreshold: z.number().nonnegative(),
  fiveDayObligationDays: z.number().nonnegative(),
});

/**
 * 既定設定に部分上書きをマージし、zod で検証して確定した設定を返す。
 * `undefined`/未指定のフィールドは既定値を採用する（`carryoverYears: 0` 等の
 * 明示的な 0/false は尊重される）。
 */
export function resolveLeaveConfig(override?: Partial<LeaveConfig>): LeaveConfig {
  if (override === undefined) return DEFAULT_LEAVE_CONFIG;
  const merged = {
    grantTable: override.grantTable ?? DEFAULT_LEAVE_CONFIG.grantTable,
    attendanceThreshold:
      override.attendanceThreshold ?? DEFAULT_LEAVE_CONFIG.attendanceThreshold,
    carryoverYears: override.carryoverYears ?? DEFAULT_LEAVE_CONFIG.carryoverYears,
    halfDayFraction: override.halfDayFraction ?? DEFAULT_LEAVE_CONFIG.halfDayFraction,
    fiveDayObligationThreshold:
      override.fiveDayObligationThreshold ??
      DEFAULT_LEAVE_CONFIG.fiveDayObligationThreshold,
    fiveDayObligationDays:
      override.fiveDayObligationDays ?? DEFAULT_LEAVE_CONFIG.fiveDayObligationDays,
  };
  return leaveConfigSchema.parse(merged);
}
