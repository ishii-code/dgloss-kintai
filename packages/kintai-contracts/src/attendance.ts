/**
 * 日次勤怠。打刻を勤怠判定レイヤーが集計した結果を保持する。
 * 区分別の労働時間（分）は @dgloss-kintai/core の割増計算にそのまま渡せる形にする。
 */

import type {
  EmployeeId,
  IsoDate,
  Minutes,
  WorkDayId,
} from "./common.js";

/**
 * 日区分（就業規則第51条）。
 * - workday          所定労働日
 * - legal_holiday    法定休日（本社=日曜／シフト=日曜起算週の最終1日）
 * - scheduled_holiday 所定休日（法定休日以外の休日）
 */
export type DayType = "workday" | "legal_holiday" | "scheduled_holiday";

/**
 * 休暇種別（就業規則第61条ほか）。
 * - paid_full   有給（全日）
 * - paid_half   有給（半日=4h）
 * - special     特別休暇（無給・賃金規程第11条）
 * - compensatory 代休（無給・賃金規程第53条）
 * - absence     欠勤
 */
export type LeaveType =
  | "paid_full"
  | "paid_half"
  | "special"
  | "compensatory"
  | "absence";

/**
 * 区分別の月内労働時間（分）。割増計算エンジンの入力と構造一致させる。
 * 深夜（nightMinutes）は他区分と重複してよい（深夜割増は加算のみ）。
 * ここに至るまでの区分判定（22:00-5:00・法定/所定・週40h/日8h・フレックス清算・
 * 事業場外みなし）は勤怠判定レイヤーの責務。
 */
export interface ClassifiedWorkMinutes {
  readonly nonStatutoryOvertimeMinutes: number;
  readonly statutoryOvertimeMinutes: number;
  readonly legalHolidayMinutes: number;
  readonly scheduledHolidayMinutes: number;
  readonly nightMinutes: number;
}

/** 日次勤怠レコード。 */
export interface WorkDay {
  readonly id: WorkDayId;
  readonly employeeId: EmployeeId;
  readonly date: IsoDate;
  readonly dayType: DayType;
  /** 所定始業・終業（`HH:mm`、JST）。休日は null。 */
  readonly scheduledStart: string | null;
  readonly scheduledEnd: string | null;
  /** 実労働時間（休憩控除後・分）。 */
  readonly actualWorkedMinutes: Minutes;
  /** 休憩時間（分）。 */
  readonly breakMinutes: Minutes;
  /** 遅刻・早退・私用外出等の不就労時間（分・第21条控除対象）。 */
  readonly absenceMinutes: Minutes;
  /** 取得した休暇（なければ null）。 */
  readonly leave: LeaveType | null;
  /** この日の区分別労働時間。月次で合算して割増計算に渡す。 */
  readonly classified: ClassifiedWorkMinutes;
}
