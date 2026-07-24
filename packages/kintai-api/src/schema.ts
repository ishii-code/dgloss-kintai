/**
 * サービス層の照会入力に対する zod スキーマ。
 *
 * 打刻登録は contracts の stampInputSchema を再利用する。日次照会・月次締め照会の
 * クエリはここで検証し、API 境界に入る前に不正な期間・年月を弾く。
 */

import { z } from "zod";
import {
  isoDateSchema,
  isoDateTimeSchema,
  yearMonthSchema,
} from "@dgloss-kintai/contracts";

/**
 * 打刻照会のクエリ。
 * from・to は RFC3339、from <= to を必須とする。
 */
export const stampQuerySchema = z
  .object({
    employeeId: z.string().min(1),
    from: isoDateTimeSchema,
    to: isoDateTimeSchema,
  })
  .refine((q) => q.from <= q.to, {
    message: "from は to 以前の時刻である必要があります",
    path: ["from"],
  });

/**
 * 日次勤怠照会のクエリ。
 * from・to は `YYYY-MM-DD`、from <= to を必須とする。
 */
export const workDayQuerySchema = z
  .object({
    employeeId: z.string().min(1),
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((q) => q.from <= q.to, {
    message: "from は to 以前の日付である必要があります",
    path: ["from"],
  });

/** 月次締め照会のクエリ。 */
export const monthlyClosingQuerySchema = z.object({
  employeeId: z.string().min(1),
  period: yearMonthSchema,
});

/** Shadow 突合照会のクエリ。 */
export const shadowComparisonQuerySchema = z.object({
  employeeId: z.string().min(1),
  period: yearMonthSchema,
});

/**
 * 給与明細照会のクエリ。
 * 締めと同じく従業員・年月で引く。通勤手当は任意（未設定は0）で総支給に含める。
 */
export const payslipQuerySchema = z.object({
  employeeId: z.string().min(1),
  period: yearMonthSchema,
  commuteAllowance: z.number().int().min(0).optional(),
});

export type StampQueryParsed = z.infer<typeof stampQuerySchema>;
export type WorkDayQueryParsed = z.infer<typeof workDayQuerySchema>;
export type MonthlyClosingQueryParsed = z.infer<
  typeof monthlyClosingQuerySchema
>;
export type ShadowComparisonQueryParsed = z.infer<
  typeof shadowComparisonQuerySchema
>;
export type PayslipQueryParsed = z.infer<typeof payslipQuerySchema>;
