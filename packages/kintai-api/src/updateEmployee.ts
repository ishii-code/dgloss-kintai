/**
 * ユースケース: 既存従業員の更新（雇用契約含む）。
 *
 * 入力を employeeUpdateInputSchema で検証し、id で対象を特定する。対象が無ければ not_found、
 * 社員番号を他従業員と衝突する値へ変更しようとした場合は conflict を Result で返す。
 */

import type { Employee, EmployeeId } from "@dgloss-kintai/contracts";
import {
  contractFromParsed,
  employeeUpdateInputSchema,
} from "./employeeInput.js";
import type { EmployeeRepository } from "./ports.js";
import {
  conflictError,
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** updateEmployee の依存。 */
export interface UpdateEmployeeDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 従業員を更新する。
 *
 * @param input 未検証の更新入力（id 必須・本体＋契約）
 * @param deps  リポジトリ port
 * @returns 更新後の従業員、または ApiError
 */
export async function updateEmployee(
  input: unknown,
  deps: UpdateEmployeeDeps,
): Promise<Result<Employee>> {
  const parsed = employeeUpdateInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "従業員更新入力が不正です"));
  }

  const id = parsed.data.id as EmployeeId;
  const current = await deps.employees.findById(id);
  if (current === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.id}`));
  }

  // 社員番号を他従業員と衝突する値へ変更しようとしていないか確認する。
  const all = await deps.employees.list();
  const collision = all.some(
    (e) => e.id !== id && e.employeeCode === parsed.data.employeeCode,
  );
  if (collision) {
    return err(
      conflictError(`社員番号が重複しています: ${parsed.data.employeeCode}`),
    );
  }

  const employee: Employee = {
    id,
    employeeCode: parsed.data.employeeCode,
    name: parsed.data.name,
    email: parsed.data.email ?? null,
    hiredOn: parsed.data.hiredOn,
    retiredOn: parsed.data.retiredOn ?? null,
    contract: contractFromParsed(parsed.data.contract),
  };

  await deps.employees.upsert(employee);
  return ok(employee);
}
