/**
 * ユースケース: ロール設定の更新（管理者専用・呼び出し側で認可）。
 *
 * 入力を roleSettingsInputSchema で検証し（最低1名必須）、指定された社員番号が
 * すべて実在する従業員であることを確認してから保存する。
 * 実在確認により、タイプミスで誰も管理者に該当しなくなる締め出しを防ぐ。
 */

import { roleSettingsInputSchema } from "@dgloss-kintai/contracts";
import type { RoleSettings } from "@dgloss-kintai/contracts";
import type {
  Clock,
  EmployeeRepository,
  RoleSettingsRepository,
} from "./ports.js";
import {
  err,
  ok,
  validationError,
  type ApiError,
  type Result,
} from "./result.js";

/** updateRoleSettings の依存。 */
export interface UpdateRoleSettingsDeps {
  readonly roleSettings: RoleSettingsRepository;
  readonly employees: EmployeeRepository;
  readonly clock: Clock;
}

/** 実在しない社員番号を含む場合の検証エラーを組み立てる。 */
function unknownCodesError(codes: readonly string[]): ApiError {
  return {
    code: "validation_error",
    message: `存在しない社員番号が含まれています: ${codes.join(", ")}`,
  };
}

/**
 * ロール設定を更新する。
 *
 * @param input 更新入力（未検証の unknown。adminEmployeeCodes）
 * @param deps  リポジトリ・時刻 port
 */
export async function updateRoleSettings(
  input: unknown,
  deps: UpdateRoleSettingsDeps,
): Promise<Result<RoleSettings>> {
  const parsed = roleSettingsInputSchema.safeParse(input);
  if (!parsed.success) {
    return err(validationError(parsed.error, "ロール設定の入力が不正です"));
  }

  // 重複を除いて一意化する。
  const codes = [...new Set(parsed.data.adminEmployeeCodes)];

  // すべて実在する従業員の社員番号であることを確認する（締め出し防止）。
  const employees = await deps.employees.list();
  const known = new Set(employees.map((e) => e.employeeCode));
  const unknown = codes.filter((c) => !known.has(c));
  if (unknown.length > 0) {
    return err(unknownCodesError(unknown));
  }

  const settings: RoleSettings = {
    adminEmployeeCodes: codes,
    updatedAt: deps.clock.now(),
  };

  await deps.roleSettings.save(settings);
  return ok(settings);
}
