/**
 * ユースケース: 従業員 CSV のエクスポート。
 *
 * 全従業員を列順固定・RFC4180 エスケープの CSV 文字列へ写す。import と列定義
 * （{@link EMPLOYEE_CSV_HEADERS}）を共有し、往復可能（export → import で同値復元）に保つ。
 */

import { serializeEmployeesCsv } from "./employeeCsv.js";
import type { EmployeeRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** exportEmployeesCsv の依存。 */
export interface ExportEmployeesCsvDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 全従業員を CSV 文字列へ書き出す。
 *
 * @param deps リポジトリ port
 * @returns CSV 文字列（ヘッダ行含む・常に成功）
 */
export async function exportEmployeesCsv(
  deps: ExportEmployeesCsvDeps,
): Promise<Result<string>> {
  const employees = await deps.employees.list();
  return ok(serializeEmployeesCsv(employees));
}
