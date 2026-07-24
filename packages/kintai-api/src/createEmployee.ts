/**
 * ユースケース: 従業員の新規作成（雇用契約含む）。
 *
 * 入力を employeeInputSchema で検証し、社員番号の重複を確認してから id を採番して upsert する。
 * バリデーション失敗は validation_error、社員番号重複は conflict を Result で返す。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import {
  contractFromParsed,
  employeeInputSchema,
} from "./employeeInput.js";
import type { EmployeeRepository, IdGenerator } from "./ports.js";
import {
  conflictError,
  err,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** createEmployee の依存。 */
export interface CreateEmployeeDeps {
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
}

/**
 * 従業員を新規作成する。
 *
 * @param input 未検証の従業員入力（本体＋契約）
 * @param deps  リポジトリ・採番 port
 * @returns 作成された従業員、または ApiError
 */
export async function createEmployee(
  input: unknown,
  deps: CreateEmployeeDeps,
): Promise<Result<Employee>> {
  const parsed = employeeInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "従業員入力が不正です"));
  }

  const existing = await deps.employees.list();
  if (existing.some((e) => e.employeeCode === parsed.data.employeeCode)) {
    return err(
      conflictError(`社員番号が重複しています: ${parsed.data.employeeCode}`),
    );
  }

  const employee: Employee = {
    id: deps.ids.employeeId(),
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
