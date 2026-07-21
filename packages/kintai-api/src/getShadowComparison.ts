/**
 * ユースケース: Shadow Mode 突合結果の取得（Ph2）。
 *
 * 自作エンジンと jinjer の締めを 1 円単位で比較した結果を照会する。
 * 従業員・年月を検証し、突合結果が無ければ not_found を返す。
 */

import type { EmployeeId, ShadowComparison } from "@dgloss-kintai/contracts";
import type { ShadowComparisonRepository } from "./ports.js";
import { shadowComparisonQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** getShadowComparison の依存。 */
export interface GetShadowComparisonDeps {
  readonly shadowComparisons: ShadowComparisonRepository;
}

/**
 * 従業員・年月で Shadow 突合結果を取得する。
 *
 * @param query 照会クエリ（未検証。employeeId・period）
 * @param deps  リポジトリ port
 * @returns 突合結果、または ApiError
 */
export async function getShadowComparison(
  query: unknown,
  deps: GetShadowComparisonDeps,
): Promise<Result<ShadowComparison>> {
  const parsed = shadowComparisonQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const comparison = await deps.shadowComparisons.findByEmployeeAndPeriod(
    employeeId,
    parsed.data.period,
  );
  if (comparison === null) {
    const { year, month } = parsed.data.period;
    return err(
      notFoundError(
        `突合結果が見つかりません: ${parsed.data.employeeId} ${year}-${String(month).padStart(2, "0")}`,
      ),
    );
  }
  return ok(comparison);
}
