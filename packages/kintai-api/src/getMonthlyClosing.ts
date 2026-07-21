/**
 * ユースケース: 月次締め取得。
 *
 * 従業員・年月を検証し、月次締めを取得する。締めが存在しなければ not_found を返す。
 */

import type { EmployeeId, MonthlyClosing } from "@dgloss-kintai/contracts";
import type { MonthlyClosingRepository } from "./ports.js";
import { monthlyClosingQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** getMonthlyClosing の依存。 */
export interface GetMonthlyClosingDeps {
  readonly closings: MonthlyClosingRepository;
}

/**
 * 従業員・年月で月次締めを取得する。
 *
 * @param query 照会クエリ（未検証。employeeId・period）
 * @param deps  リポジトリ port
 * @returns 月次締め、または ApiError
 */
export async function getMonthlyClosing(
  query: unknown,
  deps: GetMonthlyClosingDeps,
): Promise<Result<MonthlyClosing>> {
  const parsed = monthlyClosingQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const closing = await deps.closings.findByEmployeeAndPeriod(
    employeeId,
    parsed.data.period,
  );
  if (closing === null) {
    const { year, month } = parsed.data.period;
    return err(
      notFoundError(
        `月次締めが見つかりません: ${parsed.data.employeeId} ${year}-${String(month).padStart(2, "0")}`,
      ),
    );
  }
  return ok(closing);
}
