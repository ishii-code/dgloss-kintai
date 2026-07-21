/**
 * 36協定の上限値・警告しきい値の設定（config 外出し）。
 *
 * 既定 `DEFAULT_36_LIMITS` は労働基準法第36条の法定上限。
 * 特別条項の締結内容や社内基準に合わせて会社ごとに上書きできる。
 * すべて「分」の整数で保持し、比較・超過量算定を整数で行えるようにする。
 */

import { z } from "zod";

/** 時間を分に変換する（整数前提）。 */
const hoursToMinutes = (hours: number): number => hours * 60;

/**
 * 36協定・上限規制の設定値。時間はすべて分（整数）。
 */
export interface ThirtySixAgreementLimits {
  /** 原則: 単月の時間外労働の上限（分）。法定 45時間 = 2700分。「超えない」＝以下は可。 */
  readonly monthlyOvertimeLimitMinutes: number;
  /** 原則: 年間の時間外労働の上限（分）。法定 360時間 = 21600分。以下は可。 */
  readonly annualOvertimeLimitMinutes: number;
  /** 特別条項: 年間の時間外労働の上限（分）。法定 720時間 = 43200分。以下は可。 */
  readonly annualSpecialOvertimeLimitMinutes: number;
  /**
   * 特別条項: 単月の時間外＋休日労働の上限（分）。法定 100時間 = 6000分。
   * 「100時間未満」＝この値ちょうどは違法（超過）。
   */
  readonly monthlyWithHolidayLimitMinutes: number;
  /**
   * 特別条項: 複数月平均の時間外＋休日労働の 1か月あたり上限（分）。法定 80時間 = 4800分。
   * 「80時間以下」＝平均がこの値ちょうどは可。
   */
  readonly multiMonthAverageLimitMinutes: number;
  /** 複数月平均を評価する窓の月数。法定 2〜6か月。 */
  readonly multiMonthWindowSizes: readonly number[];
  /** 特別条項: 月45時間超を許容する年間回数の上限。法定 6回。 */
  readonly over45CountLimit: number;
  /**
   * 警告（接近）しきい値。上限に対する百分率（整数）。
   * 例 90 なら、上限の 90% 以上で `warning`。回数上限では ceil(上限 × %/100)。
   */
  readonly warningRatioPercent: number;
}

/**
 * 労働基準法第36条の法定上限（既定値）。
 * 原則 月45h・年360h、特別条項 単月100h未満・複数月平均80h以下・年720h・月45h超は年6回まで。
 */
export const DEFAULT_36_LIMITS: ThirtySixAgreementLimits = {
  monthlyOvertimeLimitMinutes: hoursToMinutes(45),
  annualOvertimeLimitMinutes: hoursToMinutes(360),
  annualSpecialOvertimeLimitMinutes: hoursToMinutes(720),
  monthlyWithHolidayLimitMinutes: hoursToMinutes(100),
  multiMonthAverageLimitMinutes: hoursToMinutes(80),
  multiMonthWindowSizes: [2, 3, 4, 5, 6],
  over45CountLimit: 6,
  warningRatioPercent: 90,
};

/** `ThirtySixAgreementLimits` の zod スキーマ（外部入力検証用）。 */
export const thirtySixAgreementLimitsSchema = z.object({
  monthlyOvertimeLimitMinutes: z.number().int().positive(),
  annualOvertimeLimitMinutes: z.number().int().positive(),
  annualSpecialOvertimeLimitMinutes: z.number().int().positive(),
  monthlyWithHolidayLimitMinutes: z.number().int().positive(),
  multiMonthAverageLimitMinutes: z.number().int().positive(),
  multiMonthWindowSizes: z.array(z.number().int().min(2).max(12)).min(1),
  over45CountLimit: z.number().int().nonnegative(),
  warningRatioPercent: z.number().int().min(1).max(100),
});

/**
 * 上限設定を検証して確定する。未指定なら法定既定を返す。
 * 外部（API・設定ファイル等）由来の値は必ずこの関数で検証してからドメインに渡す。
 *
 * @param input 上書き設定（省略時は {@link DEFAULT_36_LIMITS}）。
 * @returns 検証済みの上限設定。
 */
export function resolveLimits(input?: unknown): ThirtySixAgreementLimits {
  if (input === undefined) return DEFAULT_36_LIMITS;
  return thirtySixAgreementLimitsSchema.parse(input);
}
