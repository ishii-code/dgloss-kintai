/**
 * 勤務カレンダー（休日区分の判定設定）。
 *
 * 日次化（打刻→WorkDay）で各暦日を workday / legal_holiday（法定休日）/
 * scheduled_holiday（所定休日）に振り分けるための会社設定。会社全体で 1 レコードの
 * シングルトン。曜日ベース＋個別の会社休日（祝日等）で表す。
 *
 * 法定休日は週1日（労基法第35条）。既定は日曜を法定休日、土曜を所定休日（完全週休2日）。
 * 個別休日（customHolidays）は所定休日として扱う（祝日・年末年始・創立記念日など）。
 */

import { z } from "zod";
import { isoDateSchema } from "./schema.js";
import type { IsoDateTime } from "./common.js";

/** 勤務カレンダー（シングルトン）。 */
export interface WorkCalendar {
  /** 法定休日の曜日（0=日〜6=土・労基法第35条の週1日）。 */
  readonly legalHolidayWeekday: number;
  /** 所定休日の曜日（0=日〜6=土・複数可）。法定休日の曜日と重複時は法定優先。 */
  readonly scheduledHolidayWeekdays: readonly number[];
  /** 個別の会社休日（`YYYY-MM-DD`）。所定休日として扱う（祝日・年末年始等）。 */
  readonly customHolidays: readonly string[];
  /** 最終更新時刻。 */
  readonly updatedAt: IsoDateTime;
}

/** 勤務カレンダーの更新入力（updatedAt 確定前）。 */
export interface WorkCalendarInput {
  readonly legalHolidayWeekday: number;
  readonly scheduledHolidayWeekdays: readonly number[];
  readonly customHolidays: readonly string[];
}

/** 更新入力の zod スキーマ。 */
export const workCalendarInputSchema = z.object({
  legalHolidayWeekday: z.number().int().min(0).max(6),
  scheduledHolidayWeekdays: z.array(z.number().int().min(0).max(6)).max(7),
  customHolidays: z.array(isoDateSchema).max(400),
});

export type WorkCalendarInputParsed = z.infer<typeof workCalendarInputSchema>;

/**
 * 既定の勤務カレンダー。日曜=法定休日、土曜=所定休日（完全週休2日）、個別休日なし。
 * DB 未設定時のフォールバックにも用いる。
 */
export const DEFAULT_WORK_CALENDAR: WorkCalendar = {
  legalHolidayWeekday: 0,
  scheduledHolidayWeekdays: [6],
  customHolidays: [],
  updatedAt: "1970-01-01T00:00:00+09:00" as IsoDateTime,
};
