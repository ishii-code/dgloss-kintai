/**
 * 打刻。jinjer API でいう打刻/入退館/PCログ登録に対応する。
 * 生の打刻イベントを保持し、勤怠判定（区分別労働時間への変換）は上位レイヤーが行う。
 */

import type { EmployeeId, IsoDateTime, StampId } from "./common.js";

/**
 * 打刻種別。
 * - clock_in / clock_out   出退勤打刻
 * - break_start / break_end 休憩
 * - entry / exit           入退館（IC カード等）
 * - pc_login / pc_logout   PC ログ
 */
export type StampType =
  | "clock_in"
  | "clock_out"
  | "break_start"
  | "break_end"
  | "entry"
  | "exit"
  | "pc_login"
  | "pc_logout";

export const STAMP_TYPES: readonly StampType[] = [
  "clock_in",
  "clock_out",
  "break_start",
  "break_end",
  "entry",
  "exit",
  "pc_login",
  "pc_logout",
] as const;

/** 打刻の入力元。 */
export type StampSource = "manual" | "ic_card" | "pc_log" | "jinjer_api";

/** 打刻レコード。 */
export interface Stamp {
  readonly id: StampId;
  readonly employeeId: EmployeeId;
  readonly type: StampType;
  /** 打刻時刻（JST）。 */
  readonly stampedAt: IsoDateTime;
  readonly source: StampSource;
  /** 打刻場所・端末等の補足（任意）。 */
  readonly note: string | null;
}

/** 打刻登録の入力（ID・source 確定前）。バリデーションは schema.ts の zod で行う。 */
export interface StampInput {
  readonly employeeId: EmployeeId;
  readonly type: StampType;
  readonly stampedAt: IsoDateTime;
  readonly source: StampSource;
  readonly note?: string | null;
}
