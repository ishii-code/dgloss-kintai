/**
 * ユースケース: 従業員の詳細照会（契約含む全項目・管理用）。
 *
 * id を zod で検証し、実在する従業員を契約含めて返す。機密（給与等）を含むため、
 * 呼び出し側で管理者権限を確認したうえで用いること。
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

/** 従業員詳細照会のクエリ。 */
export const employeeDetailQuerySchema = z.object({
  id: z.string().min(1),
});

/** getEmployeeDetail の依存。 */
export interface GetEmployeeDetailDeps {
  readonly employees: EmployeeRepository;
}

/**
 * id を検証し、実在する従業員を契約含めて返す。
 *
 * @param query 未検証のクエリ（id を含む）
 * @param deps  リポジトリ port
 * @returns 従業員（契約含む）、または ApiError
 */
export async function getEmployeeDetail(
  query: unknown,
  deps: GetEmployeeDetailDeps,
): Promise<Result<Employee>> {
  const parsed = employeeDetailQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "従業員指定が不正です"));
  }
  const employee = await deps.employees.findById(parsed.data.id as EmployeeId);
  if (employee === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.id}`));
  }
  return ok(employee);
}
