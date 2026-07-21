/**
 * ユースケース: 日次勤怠照会。
 *
 * 従業員・期間（from <= to の暦日）を検証し、従業員の存在を確認したうえで
 * 日次勤怠を取得する。不正な期間は validation_error を Result で返す。
 */

import type { EmployeeId, IsoDate, WorkDay } from "@dgloss-kintai/contracts";
import type { EmployeeRepository, WorkDayRepository } from "./ports.js";
import { workDayQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** listWorkDays の依存。 */
export interface ListWorkDaysDeps {
  readonly workDays: WorkDayRepository;
  readonly employees: EmployeeRepository;
}

/**
 * 従業員・期間で日次勤怠を照会する。
 *
 * @param query 照会クエリ（未検証。employeeId・from・to）
 * @param deps  リポジトリ port
 * @returns 日付昇順の日次勤怠配列、または ApiError
 */
export async function listWorkDays(
  query: unknown,
  deps: ListWorkDaysDeps,
): Promise<Result<readonly WorkDay[]>> {
  const parsed = workDayQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(
      notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`),
    );
  }

  const workDays = await deps.workDays.listByEmployeeAndDateRange(
    employeeId,
    parsed.data.from as IsoDate,
    parsed.data.to as IsoDate,
  );
  return ok(workDays);
}
