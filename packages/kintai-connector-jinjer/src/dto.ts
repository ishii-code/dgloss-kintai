/**
 * jinjer レスポンスの想定 DTO と zod スキーマ。
 *
 * jinjer API は「計算ロジックを持たないデータ入出力口」。ここでは jinjer が返すであろう
 * 従業員マスタ・打刻・日次勤怠・月次締めの **snake_case DTO** を zod で定義し、
 * 外部データを必ず検証してから contracts 型へマップする（マップは mappers.ts）。
 *
 * フィールド名・コード体系（勤務体系・打刻種別等）は現時点の**想定**であり、
 * 実仕様が判明したらスキーマとコード変換表（mappers.ts）を差し替える。
 */

import { z } from "zod";

/**
 * jinjer レスポンスの共通エンベロープ。多くの jinjer API は
 * `{ code: 200, result: <payload> }` 形式で包む想定。
 */
export function jinjerEnvelopeSchema<T extends z.ZodTypeAny>(
  inner: T,
): z.ZodObject<{ code: z.ZodNumber; result: T }> {
  return z.object({
    code: z.number().int(),
    result: inner,
  });
}

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
const hhmmRegex = /^\d{2}:\d{2}$/;

/** 固定時間外勤務手当の充当区分（jinjer 側 snake_case）。 */
export const jinjerFixedOvertimeCoverageSchema = z.object({
  overtime: z.boolean(),
  overtime_over60: z.boolean(),
  holiday: z.boolean(),
  night: z.boolean(),
});

/**
 * 従業員マスタ DTO（Ph0 移行対象）。
 * 賃金計算に必要な契約情報（勤務体系・年間所定・固定残業）は jinjer の
 * 従業員／給与マスタから取得する想定でここに含める。
 */
export const jinjerEmployeeDtoSchema = z.object({
  /** 社員番号（連携キー）。 */
  staff_code: z.string().min(1),
  last_name: z.string(),
  first_name: z.string(),
  email: z.string().email().nullable().optional(),
  hire_date: z.string().regex(isoDateRegex),
  resignation_date: z.string().regex(isoDateRegex).nullable().optional(),
  /** 雇用区分コード（変換表は mappers.ts）。 */
  employment_type: z.string().min(1),
  /** 勤務体系コード。 */
  work_system: z.string().min(1),
  /** 所属区分コード。 */
  office_division: z.string().min(1),
  /** 管理監督者区分（労基法第41条2号該当）。 */
  is_managerial: z.boolean(),
  /** 基本給（月額・円・整数）。 */
  basic_salary: z.number().int().nonnegative(),
  /** 当該年度の年間所定労働時間（時間）。 */
  annual_scheduled_working_hours: z.number().positive(),
  /** 固定時間外勤務手当（月額・円）。0 で固定残業なし。 */
  fixed_overtime_allowance: z.number().int().nonnegative(),
  fixed_overtime_coverage: jinjerFixedOvertimeCoverageSchema,
});

/** 打刻 DTO。 */
export const jinjerStampDtoSchema = z.object({
  staff_code: z.string().min(1),
  /** 打刻種別コード（変換表は mappers.ts）。 */
  stamp_type: z.string().min(1),
  /** 打刻時刻（RFC3339・オフセット必須）。 */
  stamped_at: z.string().datetime({ offset: true }),
  note: z.string().nullable().optional(),
});

/** 区分別労働時間 DTO（分・非負整数）。 */
export const jinjerClassifiedMinutesDtoSchema = z.object({
  non_statutory_overtime_minutes: z.number().int().nonnegative(),
  statutory_overtime_minutes: z.number().int().nonnegative(),
  legal_holiday_minutes: z.number().int().nonnegative(),
  scheduled_holiday_minutes: z.number().int().nonnegative(),
  night_minutes: z.number().int().nonnegative(),
});

/** 日次勤怠 DTO（jinjer が集計した1日分）。 */
export const jinjerDailyAttendanceDtoSchema = z.object({
  staff_code: z.string().min(1),
  work_date: z.string().regex(isoDateRegex),
  /** 日区分コード。 */
  day_type: z.string().min(1),
  scheduled_start: z.string().regex(hhmmRegex).nullable().optional(),
  scheduled_end: z.string().regex(hhmmRegex).nullable().optional(),
  actual_worked_minutes: z.number().int().nonnegative(),
  break_minutes: z.number().int().nonnegative(),
  absence_minutes: z.number().int().nonnegative(),
  /** 休暇種別コード（なければ null）。 */
  leave_type: z.string().nullable().optional(),
  classified: jinjerClassifiedMinutesDtoSchema,
});

/** 月次締めの割増賃金 DTO（jinjer が算定した円・整数）。 */
export const jinjerAllowancesDtoSchema = z.object({
  overtime_allowance: z.number().int().nonnegative(),
  overtime_over60_allowance: z.number().int().nonnegative(),
  holiday_allowance: z.number().int().nonnegative(),
  night_allowance: z.number().int().nonnegative(),
});

/**
 * 月次締め DTO（Shadow Mode の「正解データ」）。
 * jinjer が算定した総労働時間・区分別労働時間・割増賃金を保持する。
 */
export const jinjerMonthlyClosingDtoSchema = z.object({
  staff_code: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  total_working_minutes: z.number().int().nonnegative(),
  classified: jinjerClassifiedMinutesDtoSchema,
  allowances: jinjerAllowancesDtoSchema,
});

/** 従業員一覧レスポンス。 */
export const jinjerEmployeeListSchema = jinjerEnvelopeSchema(
  z.array(jinjerEmployeeDtoSchema),
);
/** 打刻一覧レスポンス。 */
export const jinjerStampListSchema = jinjerEnvelopeSchema(
  z.array(jinjerStampDtoSchema),
);
/** 日次勤怠一覧レスポンス。 */
export const jinjerDailyAttendanceListSchema = jinjerEnvelopeSchema(
  z.array(jinjerDailyAttendanceDtoSchema),
);
/** 月次締め一覧レスポンス。 */
export const jinjerMonthlyClosingListSchema = jinjerEnvelopeSchema(
  z.array(jinjerMonthlyClosingDtoSchema),
);

export type JinjerEmployeeDto = z.infer<typeof jinjerEmployeeDtoSchema>;
export type JinjerStampDto = z.infer<typeof jinjerStampDtoSchema>;
export type JinjerClassifiedMinutesDto = z.infer<
  typeof jinjerClassifiedMinutesDtoSchema
>;
export type JinjerDailyAttendanceDto = z.infer<
  typeof jinjerDailyAttendanceDtoSchema
>;
export type JinjerAllowancesDto = z.infer<typeof jinjerAllowancesDtoSchema>;
export type JinjerMonthlyClosingDto = z.infer<
  typeof jinjerMonthlyClosingDtoSchema
>;
