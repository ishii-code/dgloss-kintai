/**
 * ユースケース: 給与明細取得（総支給まで）。
 *
 * 従業員・年月を検証し、月次締めと従業員マスタを取得して給与明細（Payslip）を組み立てる。
 * 明細の組み立ては @dgloss-kintai/jobs の buildPayslip（純粋関数）に委譲する。
 * 締めが無ければ not_found、従業員が無ければ not_found を返す。
 */

import type { EmployeeId, Payslip } from "@dgloss-kintai/contracts";
import { buildPayslip } from "@dgloss-kintai/jobs";
import type { EmployeeRepository, MonthlyClosingRepository } from "./ports.js";
import { payslipQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** getPayslip の依存。 */
export interface GetPayslipDeps {
  readonly closings: MonthlyClosingRepository;
  readonly employees: EmployeeRepository;
}

/**
 * 従業員・年月で給与明細（総支給まで）を取得する。
 *
 * @param query 照会クエリ（未検証。employeeId・period・任意の commuteAllowance）
 * @param deps  リポジトリ port
 * @returns 給与明細、または ApiError
 */
export async function getPayslip(
  query: unknown,
  deps: GetPayslipDeps,
): Promise<Result<Payslip>> {
  const parsed = payslipQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const { year, month } = parsed.data.period;
  const label = `${parsed.data.employeeId} ${year}-${String(month).padStart(2, "0")}`;

  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`));
  }

  const closing = await deps.closings.findByEmployeeAndPeriod(
    employeeId,
    parsed.data.period,
  );
  if (closing === null) {
    return err(notFoundError(`月次締めが見つかりません: ${label}`));
  }

  const options =
    parsed.data.commuteAllowance !== undefined
      ? { commuteAllowance: parsed.data.commuteAllowance as Payslip["grossPay"] }
      : {};
  const payslip = buildPayslip(closing, employee, options);
  return ok(payslip);
}
