/**
 * 年月（`YYYY-MM`）と暦日範囲のユーティリティ（純粋関数）。
 *
 * 勤怠一覧・月次締め・給与 CSV 画面で共通に使う「対象年月」の解釈を集約する。
 * タイムゾーンは常に JST を前提とし、当月の判定も JST の暦日で行う。
 */

import type { IsoDate, YearMonth } from "@dgloss-kintai/contracts";

/** 年月を `YYYY-MM` 文字列へ整形する。 */
export function formatYearMonth(period: YearMonth): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

/**
 * `YYYY-MM` 文字列を年月へ解釈する。形式・範囲（月 1-12）が不正なら null。
 *
 * @param value `2026-07` のような文字列
 * @returns 年月、または null
 */
export function parseYearMonth(value: string): YearMonth | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (m === null) {
    return null;
  }
  const year = Number.parseInt(m[1] ?? "", 10);
  const month = Number.parseInt(m[2] ?? "", 10);
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  return { year, month };
}

/** JST の当月（`now` 基準）を年月で返す。 */
export function currentYearMonth(now: Date = new Date()): YearMonth {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (t: string): number =>
    Number.parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
  return { year: get("year"), month: get("month") };
}

/**
 * 年月の暦日範囲 `[from, to]`（当月1日〜末日、`YYYY-MM-DD`）を返す。
 *
 * @param period 対象年月
 * @returns from（1日）と to（末日）の暦日
 */
export function monthDateRange(period: YearMonth): {
  readonly from: IsoDate;
  readonly to: IsoDate;
} {
  const mm = String(period.month).padStart(2, "0");
  // 翌月0日 = 当月末日。month は 1-12 なので Date の月インデックス（0-11）へは +0。
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const from = `${period.year}-${mm}-01` as IsoDate;
  const to = `${period.year}-${mm}-${String(lastDay).padStart(2, "0")}` as IsoDate;
  return { from, to };
}

/**
 * 年月を月単位でずらす（繰り上げ・繰り下げを処理する）。
 *
 * @param period 基準年月
 * @param delta  ずらす月数（負で過去）
 * @returns ずらした後の年月
 */
export function shiftYearMonth(period: YearMonth, delta: number): YearMonth {
  const zeroBased = period.year * 12 + (period.month - 1) + delta;
  const year = Math.floor(zeroBased / 12);
  const month = (zeroBased % 12) + 1;
  return { year, month };
}
