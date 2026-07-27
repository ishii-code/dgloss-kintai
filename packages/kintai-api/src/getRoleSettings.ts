/**
 * ユースケース: ロール設定の取得。
 *
 * 保存済みのロール設定（管理者社員番号一覧）を返す。未保存なら null を返し、
 * 呼び出し側（web の role 解決）が環境変数・既定へフォールバックする。
 * 常に成功する。
 */

import type { RoleSettings } from "@dgloss-kintai/contracts";
import type { RoleSettingsRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** getRoleSettings の依存。 */
export interface GetRoleSettingsDeps {
  readonly roleSettings: RoleSettingsRepository;
}

/** ロール設定を取得する（未保存は null）。 */
export async function getRoleSettings(
  deps: GetRoleSettingsDeps,
): Promise<Result<RoleSettings | null>> {
  const stored = await deps.roleSettings.get();
  return ok(stored);
}
