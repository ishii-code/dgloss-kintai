/**
 * ユースケース: 打刻の日次化（Stamp → WorkDay）。
 *
 * 対象年月について、従業員の打刻（出退勤・休憩）から日次勤怠（WorkDay）を復元・保存する。
 * 変換は @dgloss-kintai/jobs の buildWorkDaysFromStamps（純粋関数）に委譲する。
 * これにより「打刻 → 勤怠 → 締め」が実データで連結する。
 *
 * 対象は employeeId 指定時はその1名、未指定時は全従業員。保存は従業員×暦日で upsert（冪等）。
 * 認可（管理者のみ）は呼び出し側（API ルートの checkAdmin）で担保する。
 */

import { yearMonthSchema } from "@dgloss-kintai/contracts";
import type {
  Employee,
  EmployeeId,
  IsoDateTime,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { buildWorkDaysFromStamps } from "@dgloss-kintai/jobs";
import { z } from "zod";
import type {
  EmployeeRepository,
  StampRepository,
  WorkDayRepository,
} from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** 日次化の入力スキーマ（対象年月・任意の従業員）。 */
const buildDailyInputSchema = z.object({
  period: yearMonthSchema,
  employeeId: z.string().min(1).optional(),
});

/** buildDailyAttendance の依存。 */
export interface BuildDailyAttendanceDeps {
  readonly employees: EmployeeRepository;
  readonly stamps: StampRepository;
  readonly workDays: WorkDayRepository;
}

/** 日次化の結果サマリ。 */
export interface BuildDailyResult {
  readonly period: YearMonth;
  /** 生成・保存した WorkDay 件数。 */
  readonly builtCount: number;
  /** 打刻から勤務日が生成できた従業員数。 */
  readonly employeesWithWorkDays: number;
  /** 処理対象の従業員数。 */
  readonly employeesProcessed: number;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 年月から打刻照会の時刻範囲（当月1日00:00〜末日23:59・JST）を求める。 */
function monthRange(period: YearMonth): { from: IsoDateTime; to: IsoDateTime } {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const mm = pad2(period.month);
  return {
    from: `${period.year}-${mm}-01T00:00:00+09:00` as IsoDateTime,
    to: `${period.year}-${mm}-${pad2(lastDay)}T23:59:59+09:00` as IsoDateTime,
  };
}

/**
 * 対象年月の打刻を日次勤怠へ変換・保存する。
 *
 * @param input 日次化入力（未検証。period・任意の employeeId）
 * @param deps  リポジトリ port
 */
export async function buildDailyAttendance(
  input: unknown,
  deps: BuildDailyAttendanceDeps,
): Promise<Result<BuildDailyResult>> {
  const parsed = buildDailyInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "日次化の入力が不正です"));
  }

  const period = parsed.data.period;

  let targets: readonly Employee[];
  if (parsed.data.employeeId !== undefined) {
    const one = await deps.employees.findById(
      parsed.data.employeeId as EmployeeId,
    );
    if (one === null) {
      return err(
        notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`),
      );
    }
    targets = [one];
  } else {
    targets = await deps.employees.list();
  }

  const { from, to } = monthRange(period);
  let builtCount = 0;
  let employeesWithWorkDays = 0;

  for (const employee of targets) {
    const stamps = await deps.stamps.listByEmployeeAndRange(
      employee.id,
      from,
      to,
    );
    const workDays = buildWorkDaysFromStamps(employee, stamps);
    if (workDays.length > 0) {
      employeesWithWorkDays += 1;
    }
    for (const workDay of workDays) {
      await deps.workDays.save(workDay);
      builtCount += 1;
    }
  }

  return ok({
    period,
    builtCount,
    employeesWithWorkDays,
    employeesProcessed: targets.length,
  });
}
