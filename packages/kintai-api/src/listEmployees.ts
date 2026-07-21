/**
 * ユースケース: 従業員一覧照会。
 *
 * 簡易ログイン（従業員選択）の選択肢を提供する。絞り込み（在籍者のみ等）は行わず、
 * リポジトリが返す全従業員をそのまま返す。並び順はリポジトリ実装の安定ソートに委ねる。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import type { EmployeeRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** listEmployees の依存。 */
export interface ListEmployeesDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 全従業員を照会する。
 *
 * @param deps リポジトリ port
 * @returns 従業員配列（常に成功）
 */
export async function listEmployees(
  deps: ListEmployeesDeps,
): Promise<Result<readonly Employee[]>> {
  const employees = await deps.employees.list();
  return ok(employees);
}
