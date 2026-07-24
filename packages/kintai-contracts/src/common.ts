/**
 * 共通のプリミティブ型。
 *
 * ID は string ベースだが、取り違えをコンパイル時に防ぐためブランド型にする。
 * 日付・時刻は ISO 8601 文字列（`YYYY-MM-DD` / RFC3339）で受け渡し、
 * タイムゾーンは常に JST（Asia/Tokyo）を前提とする。
 */

declare const brand: unique symbol;

/** ブランド型ヘルパー。`Brand<string, "Employee">` のように使う。 */
export type Brand<T, B extends string> = T & { readonly [brand]: B };

/** 従業員 ID。 */
export type EmployeeId = Brand<string, "EmployeeId">;
/** 打刻 ID。 */
export type StampId = Brand<string, "StampId">;
/** 日次勤怠 ID。 */
export type WorkDayId = Brand<string, "WorkDayId">;
/** 月次締め ID。 */
export type MonthlyClosingId = Brand<string, "MonthlyClosingId">;
/** 改善リクエスト ID。 */
export type ImprovementRequestId = Brand<string, "ImprovementRequestId">;

/** `YYYY-MM-DD`（JST の暦日）。 */
export type IsoDate = Brand<string, "IsoDate">;
/** RFC3339 タイムスタンプ（例 `2025-07-01T09:00:00+09:00`）。 */
export type IsoDateTime = Brand<string, "IsoDateTime">;

/** 年月（締め単位）。month は 1-12。 */
export interface YearMonth {
  readonly year: number;
  readonly month: number;
}

/**
 * 金額（円・整数）。割増・控除は 1 円単位で確定するため小数を持たない。
 * 計算ロジックは @dgloss-kintai/core が担う。
 */
export type Yen = Brand<number, "Yen">;

/** 分（労働時間の最小単位・整数）。打刻は分単位で確定する。 */
export type Minutes = Brand<number, "Minutes">;
