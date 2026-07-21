/**
 * ユースケース: 打刻登録。
 *
 * 入力を stampInputSchema で検証し、従業員の存在を確認したうえで打刻を保存する。
 * バリデーション失敗は validation_error、対象従業員なしは not_found を Result で返す。
 */

import { stampInputSchema } from "@dgloss-kintai/contracts";
import type {
  EmployeeId,
  Stamp,
  StampSource,
  StampType,
} from "@dgloss-kintai/contracts";
import type {
  EmployeeRepository,
  IdGenerator,
  StampRepository,
} from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** registerStamp の依存。 */
export interface RegisterStampDeps {
  readonly stamps: StampRepository;
  readonly employees: EmployeeRepository;
  readonly ids: IdGenerator;
}

/**
 * 打刻を登録する。
 *
 * @param input 打刻入力（未検証の unknown を受け取り、内部で zod 検証する）
 * @param deps  リポジトリ・採番 port
 * @returns 登録された打刻、または ApiError
 */
export async function registerStamp(
  input: unknown,
  deps: RegisterStampDeps,
): Promise<Result<Stamp>> {
  const parsed = stampInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "打刻入力が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(
      notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`),
    );
  }

  const stamp: Stamp = {
    id: deps.ids.stampId(),
    employeeId,
    type: parsed.data.type as StampType,
    stampedAt: parsed.data.stampedAt as Stamp["stampedAt"],
    source: parsed.data.source as StampSource,
    note: parsed.data.note ?? null,
  };

  await deps.stamps.save(stamp);
  return ok(stamp);
}
