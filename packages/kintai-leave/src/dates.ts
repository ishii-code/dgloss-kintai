/**
 * 有給休暇エンジン用の日付ユーティリティ。
 * 日付は `YYYY-MM-DD`（JST の暦日・{@link IsoDate}）で受け渡す。
 * ISO 8601 の暦日は辞書順＝時系列順なので、比較は文字列比較でよい。
 */

import { z } from "zod";
import type { IsoDate } from "@dgloss-kintai/contracts";

/** `YYYY-MM-DD` の検証スキーマ。 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "IsoDate は YYYY-MM-DD 形式で指定してください");

/** 検証済み文字列を {@link IsoDate} ブランド型に落とす。 */
export function toIsoDate(value: string): IsoDate {
  return value as IsoDate;
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0");

/**
 * 暦日に年数を加算する。時効消滅日（付与日+2年）や義務履行期間の
 * 終期（付与日+1年）の算出に使う。
 *
 * 2月29日など加算後に存在しない日付は、UTC 基準で翌月へ繰り上げる
 * （例: 2024-02-29 + 1年 → 2025-03-01）。
 */
export function addYears(iso: string, years: number): IsoDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (match === null) throw new Error(`invalid IsoDate: ${iso}`);
  const [, yStr, mStr, dStr] = match;
  if (yStr === undefined || mStr === undefined || dStr === undefined) {
    throw new Error(`invalid IsoDate: ${iso}`);
  }
  const date = new Date(
    Date.UTC(Number(yStr) + years, Number(mStr) - 1, Number(dStr)),
  );
  return toIsoDate(
    `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(
      date.getUTCDate(),
      2,
    )}`,
  );
}

/** 暦日の時系列比較。a<b で負、a>b で正、同日で 0。 */
export function compareIso(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
