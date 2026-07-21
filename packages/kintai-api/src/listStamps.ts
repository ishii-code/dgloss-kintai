/**
 * ユースケース: 打刻照会。
 *
 * 従業員・時刻範囲（from <= to の RFC3339）を検証し、従業員の存在を確認したうえで
 * 打刻を時刻昇順で取得する。打刻画面の当日履歴表示などに用いる。
 */

import type { EmployeeId, IsoDateTime, Stamp } from "@dgloss-kintai/contracts";
import type { EmployeeRepository, StampRepository } from "./ports.js";
import { stampQuerySchema } from "./schema.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** listStamps の依存。 */
export interface ListStampsDeps {
  readonly stamps: StampRepository;
  readonly employees: EmployeeRepository;
}

/**
 * 従業員・時刻範囲で打刻を照会する。
 *
 * @param query 照会クエリ（未検証。employeeId・from・to）
 * @param deps  リポジトリ port
 * @returns 時刻昇順の打刻配列、または ApiError
 */
export async function listStamps(
  query: unknown,
  deps: ListStampsDeps,
): Promise<Result<readonly Stamp[]>> {
  const parsed = stampQuerySchema.safeParse(query);
  if (!parsed.success) {
    return err(validationError(parsed.error, "照会条件が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(
      notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`),
    );
  }

  const stamps = await deps.stamps.listByEmployeeAndRange(
    employeeId,
    parsed.data.from as IsoDateTime,
    parsed.data.to as IsoDateTime,
  );
  return ok(stamps);
}
