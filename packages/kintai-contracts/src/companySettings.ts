/**
 * 企業設定（会社プロフィール・年度運用の基本設定）。
 *
 * 会社全体で 1 レコードのシングルトン。会社名・代表者・所在地などのプロフィールに加え、
 * 年度開始月（36協定・年次集計の起点）を持つ。年度開始月は実際に 36協定監視の
 * 既定起点として用いる（設定が計算に反映される）。
 *
 * 給与計算ルール・割増率・付与テーブル等の重い設定は、それぞれ専用の設定に段階的に
 * 切り出す。ここでは全体に効く最小限の基本設定のみを持つ。
 */

import { z } from "zod";
import type { IsoDateTime } from "./common.js";

/** 企業設定（シングルトン）。 */
export interface CompanySettings {
  /** 会社名。 */
  readonly companyName: string;
  /** 代表者名（任意・空可）。 */
  readonly representativeName: string;
  /** 所在地（任意・空可）。 */
  readonly address: string;
  /**
   * 年度開始月（1-12）。36協定・年次集計の起点。既定は 4（4月起算）。
   */
  readonly fiscalYearStartMonth: number;
  /** 最終更新時刻。 */
  readonly updatedAt: IsoDateTime;
}

/** 企業設定の更新入力（updatedAt 確定前）。 */
export interface CompanySettingsInput {
  readonly companyName: string;
  readonly representativeName: string;
  readonly address: string;
  readonly fiscalYearStartMonth: number;
}

/** 更新入力の zod スキーマ。 */
export const companySettingsInputSchema = z.object({
  companyName: z.string().min(1).max(200),
  representativeName: z.string().max(100),
  address: z.string().max(300),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
});

export type CompanySettingsInputParsed = z.infer<
  typeof companySettingsInputSchema
>;

/**
 * 既定の企業設定。未設定（DB 無し・未保存）のときのフォールバック。
 * 会社名は導入前の暫定値。年度開始月は法定運用で一般的な 4 月。
 */
export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "株式会社ディグロス",
  representativeName: "",
  address: "",
  fiscalYearStartMonth: 4,
  updatedAt: "1970-01-01T00:00:00+09:00" as IsoDateTime,
};
