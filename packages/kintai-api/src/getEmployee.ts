/**
 * ユースケース: 従業員の単体照会（存在確認つき）。
 *
 * 簡易ログイン（従業員選択）の確定時に、指定 employeeId を zod で検証し、実在を確認する。
 * バリデーション失敗は validation_error、対象なしは not_found を Result で返す。
 */

import { z } from "zod";
import type { Employee, EmployeeId } from "@dgloss-kintai/contracts";
import type { EmployeeRepository } from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** 従業員指定のクエリ。 */
export const employeeQuerySchema = z.object({
  employeeId: z.string().min(1),
});

/** getEmployee の依存。 */
export interface GetEmployeeDeps {
  readonly employees: EmployeeRepository;
}

/**
 * employeeId を検証し、実在する従業員を返す。
 *
 * @param query 未検証のクエリ（employeeId を含む）
 * @param deps  リポジトリ port
 * @returns 従業員、または ApiError
 */
export async function getEmployee(
  query: unknown,
  deps: GetEmployeeDeps,
): Promise<Result<Employee>> {
  const parsed = employeeQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "従業員指定が不正です"));
  }
  const employee = await deps.employees.findById(
    parsed.data.employeeId as EmployeeId,
  );
  if (employee === null) {
    return err(
      notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`),
    );
  }
  return ok(employee);
}
