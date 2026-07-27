/**
 * ユースケース: 年次有給休暇の残高取得（労基法第39条）。
 *
 * 従業員・基準日を検証し、従業員マスタ（入社日）と日次勤怠（休暇区分）から
 * 有給残高・5日取得義務の状況を算定する。算定は @dgloss-kintai/jobs の
 * buildLeaveBalance（純粋関数）に委譲する。新たな永続化は不要。
 */

import type { EmployeeId, IsoDate } from "@dgloss-kintai/contracts";
import { buildLeaveBalance, type LeaveBalanceResult } from "@dgloss-kintai/jobs";
import type { EmployeeRepository, WorkDayRepository } from "./ports.js";
import { leaveBalanceQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** getLeaveBalance の依存。 */
export interface GetLeaveBalanceDeps {
  readonly employees: EmployeeRepository;
  readonly workDays: WorkDayRepository;
}

/**
 * 従業員・基準日で有給残高を取得する。
 *
 * @param query 照会クエリ（未検証。employeeId・asOf）
 * @param deps  リポジトリ port
 * @returns 有給残高（残日数・付与バケット・5日義務）、または ApiError
 */
export async function getLeaveBalance(
  query: unknown,
  deps: GetLeaveBalanceDeps,
): Promise<Result<LeaveBalanceResult>> {
  const parsed = leaveBalanceQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const asOf = parsed.data.asOf as IsoDate;

  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`));
  }

  // 入社日〜基準日の勤怠を取得し、休暇区分から取得実績を導出する。
  const workDays = await deps.workDays.listByEmployeeAndDateRange(
    employeeId,
    employee.hiredOn as IsoDate,
    asOf,
  );

  const result = buildLeaveBalance(employee, workDays, asOf);
  return ok(result);
}
