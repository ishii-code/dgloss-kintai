/**
 * ユースケース: 従業員の詳細一覧（契約含む全項目・管理用）。
 *
 * ログイン用の公開サマリ（listEmployees）とは別に、管理画面向けに契約・給与などの機密を含む
 * 全項目を社員番号順で返す。呼び出し側で管理者権限を確認したうえで用いること。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import type { EmployeeRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** listEmployeesDetailed の依存。 */
export interface ListEmployeesDetailedDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 全従業員を契約含めて照会する（社員番号順・リポジトリの安定ソートに委ねる）。
 *
 * @param deps リポジトリ port
 * @returns 従業員配列（契約含む・常に成功）
 */
export async function listEmployeesDetailed(
  deps: ListEmployeesDetailedDeps,
): Promise<Result<readonly Employee[]>> {
  const employees = await deps.employees.list();
  return ok(employees);
}
