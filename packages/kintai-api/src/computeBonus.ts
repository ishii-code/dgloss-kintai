/**
 * ユースケース: 賞与計算（賞与明細の算出・管理者専用は呼び出し側で認可）。
 *
 * 従業員・支給期・賞与パラメータを検証し、賞与明細（総支給まで）を組み立てる。
 * 明細の組み立ては @dgloss-kintai/jobs の buildBonusStatement（純粋関数）に委譲する。
 * 賞与は裁量的（規程に算定式なし）のため永続化は行わず、都度計算する。
 */

import { bonusParamsSchema } from "@dgloss-kintai/contracts";
import type { BonusStatement, EmployeeId } from "@dgloss-kintai/contracts";
import { buildBonusStatement } from "@dgloss-kintai/jobs";
import { z } from "zod";
import type { EmployeeRepository } from "./ports.js";
import {
  err,
  notFoundError,
  ok,
  validationError,
  type Result,
} from "./result.js";

/** 賞与計算の入力スキーマ（従業員・支給期ラベル・パラメータ）。 */
const computeBonusInputSchema = z.object({
  employeeId: z.string().min(1),
  label: z.string().min(1).max(100),
  params: bonusParamsSchema,
});

/** computeBonus の依存。 */
export interface ComputeBonusDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 従業員・パラメータから賞与明細を算出する。
 *
 * @param input 賞与計算入力（未検証の unknown。employeeId・label・params）
 * @param deps  リポジトリ port
 * @returns 賞与明細、または ApiError
 */
export async function computeBonus(
  input: unknown,
  deps: ComputeBonusDeps,
): Promise<Result<BonusStatement>> {
  const parsed = computeBonusInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "賞与計算の入力が不正です"));
  }

  const employeeId = parsed.data.employeeId as EmployeeId;
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return err(notFoundError(`従業員が見つかりません: ${parsed.data.employeeId}`));
  }

  const statement = buildBonusStatement(
    employee,
    parsed.data.params,
    parsed.data.label,
  );
  return ok(statement);
}
