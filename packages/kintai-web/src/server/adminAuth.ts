import "server-only";

/**
 * 管理者専用 API ルートの認可（サーバ専用）。
 *
 * cookie セッションの従業員を解決し、社員番号 allowlist（{@link resolveRole}）で管理者判定する。
 * 未ログインは 401、ログイン済みだが管理者でない場合は 403 を返せるよう、判定結果を
 * 判別可能ユニオンで返す。実際の HTTP 応答生成は呼び出し側（ルート）が行う。
 */

import type { EmployeeId } from "@dgloss-kintai/contracts";

import { getDeps } from "@/server/deps";
import { resolveRoleWithSettings } from "@/server/role";
import { readSessionEmployeeId } from "@/server/session";

/** 管理者認可の結果。許可時は従業員 ID を伴う。 */
export type AdminCheck =
  | { readonly ok: true; readonly employeeId: EmployeeId }
  | { readonly ok: false; readonly status: 401 | 403 };

/**
 * リクエストの cookie セッションから管理者権限を確認する。
 *
 * - cookie 無し／該当従業員なし … `{ ok: false, status: 401 }`
 * - 管理者でない … `{ ok: false, status: 403 }`
 * - 管理者 … `{ ok: true, employeeId }`
 *
 * @param req 受信リクエスト
 * @returns 認可結果
 */
export async function checkAdmin(req: Request): Promise<AdminCheck> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return { ok: false, status: 401 };
  }
  const deps = await getDeps();
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    return { ok: false, status: 401 };
  }
  // ロール設定（DB）を優先して管理者判定する（未設定は env/既定へフォールバック）。
  const roleSettings = await deps.roleSettings.get();
  if (resolveRoleWithSettings(employee.employeeCode, roleSettings) !== "admin") {
    return { ok: false, status: 403 };
  }
  return { ok: true, employeeId };
}

/** 認可失敗（401/403）を JSON レスポンスへ変換する。 */
export function adminDenyResponse(status: 401 | 403): Response {
  const message =
    status === 401 ? "ログインが必要です" : "管理者権限が必要です";
  return Response.json(
    { error: { code: "not_found", message } },
    { status },
  );
}
