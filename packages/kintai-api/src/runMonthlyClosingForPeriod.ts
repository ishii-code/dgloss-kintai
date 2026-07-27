/**
 * ユースケース: 月次締めの実行（賃金規程第6条）。
 *
 * 対象年月について、従業員の日次勤怠（WorkDay）を集計して月次締め（MonthlyClosing）を
 * 算出・保存する。算定は @dgloss-kintai/jobs の runMonthlyClosing（純粋関数）に委譲する。
 * これにより「勤怠 → 締め → 給与明細／36協定」が実データで連結する（従来は手動投入が必要だった）。
 *
 * 対象は employeeId 指定時はその1名、未指定時は全従業員。勤怠が1件も無い従業員は
 * 意味のない空締めを作らないためスキップする。保存は従業員×年月で upsert（再実行で上書き・冪等）。
 * 認可（管理者のみ）は呼び出し側（API ルートの checkAdmin）で担保する。
 */

import { yearMonthSchema } from "@dgloss-kintai/contracts";
import type {
  Employee,
  EmployeeId,
  IsoDate,
  MonthlyClosing,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { runMonthlyClosing } from "@dgloss-kintai/jobs";
import { z } from "zod";
import type {
  EmployeeRepository,
  MonthlyClosingRepository,
  WorkDayRepository,
} from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** 締め実行の入力スキーマ（対象年月・任意の従業員）。 */
const runClosingInputSchema = z.object({
  period: yearMonthSchema,
  employeeId: z.string().min(1).optional(),
});

/** runMonthlyClosingForPeriod の依存。 */
export interface RunMonthlyClosingDeps {
  readonly employees: EmployeeRepository;
  readonly workDays: WorkDayRepository;
  readonly closings: MonthlyClosingRepository;
}

/** 締め実行の結果サマリ。 */
export interface RunClosingResult {
  readonly period: YearMonth;
  /** 締めを確定・保存した件数。 */
  readonly closedCount: number;
  /** 勤怠が無くスキップした従業員数。 */
  readonly skippedCount: number;
  /** 確定した締め（従業員番号・総支給の内訳参照用）。 */
  readonly closings: readonly MonthlyClosing[];
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** 年月から暦日範囲（当月1日〜末日・`YYYY-MM-DD`）を求める。 */
function monthRange(period: YearMonth): { from: IsoDate; to: IsoDate } {
  const lastDay = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
  const mm = pad2(period.month);
  return {
    from: `${period.year}-${mm}-01` as IsoDate,
    to: `${period.year}-${mm}-${pad2(lastDay)}` as IsoDate,
  };
}

/**
 * 対象年月の月次締めを実行・保存する。
 *
 * @param input 締め実行入力（未検証。period・任意の employeeId）
 * @param deps  リポジトリ port
 * @returns 締め件数・スキップ数・確定した締め、または ApiError
 */
export async function runMonthlyClosingForPeriod(
  input: unknown,
  deps: RunMonthlyClosingDeps,
): Promise<Result<RunClosingResult>> {
  const parsed = runClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "締め実行の入力が不正です"));
  }

  const period = parsed.data.period;

  // 対象従業員（指定1名 or 全員）を決める。
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
  const closings: MonthlyClosing[] = [];
  let skippedCount = 0;

  for (const employee of targets) {
    const workDays = await deps.workDays.listByEmployeeAndDateRange(
      employee.id,
      from,
      to,
    );
    // 勤怠が無い月は空締めを作らずスキップする。
    if (workDays.length === 0) {
      skippedCount += 1;
      continue;
    }
    const closing = runMonthlyClosing({ employee, workDays, period });
    await deps.closings.save(closing);
    closings.push(closing);
  }

  return ok({
    period,
    closedCount: closings.length,
    skippedCount,
    closings,
  });
}
