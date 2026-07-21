/**
 * 36協定・労働時間上限監視のドメイン型。
 *
 * 労働時間はすべて「分」の整数で扱う（打刻は分単位で確定するため）。
 * 上限比較・超過量算定はすべて整数演算で行い、浮動小数点による取りこぼしを排除する。
 * 未払い・違法検知が目的のため、上限を 1 分でも超えたら必ず `exceeded` とする。
 */

import type { YearMonth } from "@dgloss-kintai/contracts";

/**
 * アラートの深刻度。
 * - `ok`       範囲内（接近もしていない）。
 * - `warning`  上限に接近している（既定は上限の 90% 以上／回数上限ちょうど）。
 * - `exceeded` 上限を超過している（違法の疑い）。
 */
export type ComplianceLevel = "ok" | "warning" | "exceeded";

/**
 * 監視対象の上限種別（労働基準法第36条・上限規制）。
 * - `monthly_overtime`        原則: 単月の時間外労働 月45時間。
 * - `annual_overtime`         原則: 年間の時間外労働 360時間。
 * - `annual_special_overtime` 特別条項: 年間の時間外労働 720時間。
 * - `monthly_with_holiday`    特別条項: 単月の時間外＋休日労働 100時間未満。
 * - `multi_month_average`     特別条項: 2〜6か月平均の時間外＋休日労働 80時間以下。
 * - `over45_count`            特別条項: 月45時間超は年6回まで。
 */
export type ComplianceCheckKind =
  | "monthly_overtime"
  | "annual_overtime"
  | "annual_special_overtime"
  | "monthly_with_holiday"
  | "multi_month_average"
  | "over45_count";

/** アラートが指す対象期間。 */
export type AlertPeriod =
  | { readonly kind: "month"; readonly period: YearMonth }
  | {
      readonly kind: "range";
      readonly start: YearMonth;
      readonly end: YearMonth;
      readonly monthCount: number;
    };

/** 測定値・上限・超過量の単位。 */
export type ComplianceUnit = "minutes" | "count";

/** 個々の上限チェック結果。 */
export interface ComplianceAlert {
  /** どの上限に対する結果か。 */
  readonly check: ComplianceCheckKind;
  /** 深刻度。 */
  readonly level: ComplianceLevel;
  /** 対象期間。 */
  readonly period: AlertPeriod;
  /**
   * 測定値。`minutes` 単位のチェックでは合計分（複数月平均は窓内合計分）、
   * `count` 単位のチェックでは回数。
   */
  readonly actual: number;
  /**
   * 上限値。`minutes` の複数月平均では「1か月上限 × 窓の月数」の合計上限。
   */
  readonly limit: number;
  /**
   * 超過量。許容される最大値を超えた分だけ正の値になる。範囲内なら 0。
   * `未満` 上限（100時間）では「上限 − 1」を許容最大値とするため、
   * ちょうど上限に達した時点で超過量 1（分）となる。
   */
  readonly excess: number;
  /** `actual`/`limit`/`excess` の単位。 */
  readonly unit: ComplianceUnit;
  /** 人間可読の日本語メッセージ。 */
  readonly message: string;
}

/** 監視全体の結果。 */
export interface ComplianceReport {
  /** 全チェックのアラート（`ok` を含む全レベル）。 */
  readonly alerts: readonly ComplianceAlert[];
  /** 最も深刻なレベル。アラートが無ければ `ok`。 */
  readonly worstLevel: ComplianceLevel;
  /** `exceeded` が 1 件でもあれば true（違法の疑い）。 */
  readonly hasViolation: boolean;
}
