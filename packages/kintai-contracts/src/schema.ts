/**
 * 入力バリデーションスキーマ（zod）。「入力バリデーション必須」規約に対応する。
 * API 境界・ジョブ入力・jinjer 取込データはここで検証してからドメインに入れる。
 */

import { z } from "zod";
import { STAMP_TYPES } from "./stamp.js";
import { WORK_SYSTEMS, OFFICE_DIVISIONS } from "./workSystem.js";

/** `YYYY-MM-DD`。 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "IsoDate must be YYYY-MM-DD");

/** RFC3339 タイムスタンプ。 */
export const isoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "IsoDateTime must be RFC3339 with offset" });

/** 年月。month は 1-12。 */
export const yearMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

const stampSourceSchema = z.enum(["manual", "ic_card", "pc_log", "jinjer_api"]);

/** 打刻登録入力。 */
export const stampInputSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(STAMP_TYPES as [string, ...string[]]),
  stampedAt: isoDateTimeSchema,
  source: stampSourceSchema,
  note: z.string().max(500).nullish(),
});

/** 区分別労働時間（分・非負整数）。 */
export const classifiedWorkMinutesSchema = z.object({
  nonStatutoryOvertimeMinutes: z.number().int().nonnegative(),
  statutoryOvertimeMinutes: z.number().int().nonnegative(),
  legalHolidayMinutes: z.number().int().nonnegative(),
  scheduledHolidayMinutes: z.number().int().nonnegative(),
  nightMinutes: z.number().int().nonnegative(),
});

const fixedOvertimeCoverageSchema = z.object({
  overtime: z.boolean(),
  overtimeOver60: z.boolean(),
  holiday: z.boolean(),
  night: z.boolean(),
});

/** 雇用契約（計算に関わる設定値）。 */
export const employmentContractSchema = z.object({
  employmentType: z.enum(["regular", "non_regular"]),
  workSystem: z.enum(WORK_SYSTEMS as [string, ...string[]]),
  office: z.enum(OFFICE_DIVISIONS as [string, ...string[]]),
  isManagerialEmployee: z.boolean(),
  basicSalary: z.number().int().nonnegative(),
  annualScheduledWorkingHours: z.number().positive(),
  fixedOvertimeAllowance: z.number().int().nonnegative(),
  fixedOvertimeCoverage: fixedOvertimeCoverageSchema,
});

export type StampInputParsed = z.infer<typeof stampInputSchema>;
export type ClassifiedWorkMinutesParsed = z.infer<
  typeof classifiedWorkMinutesSchema
>;
export type EmploymentContractParsed = z.infer<
  typeof employmentContractSchema
>;
