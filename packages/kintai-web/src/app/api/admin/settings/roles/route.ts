/**
 * ロール設定の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/settings/roles` 現在の管理者社員番号一覧を返す（未保存は env/既定を反映）。
 * - `PUT /api/admin/settings/roles` 管理者社員番号一覧を更新する（最低1名・実在確認あり）。
 *
 * cookie セッション＋現在の管理者判定で認可する（未ログイン 401・一般 403）。
 * 実在確認・最低1名の担保はサービス層（updateRoleSettings）に委ねる。
 */

import { getRoleSettings, updateRoleSettings } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";
import { effectiveAdminCodes } from "@/server/role";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 現在の管理者社員番号一覧を返す。管理者のみ。
 * 未保存でも、実際に効いている管理者（env/既定）を返して画面に初期表示できるようにする。
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await getRoleSettings({ roleSettings: deps.roleSettings });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  // 未保存なら env/既定の有効値を返す（画面の初期チェック状態に用いる）。
  const adminEmployeeCodes = [...effectiveAdminCodes(result.value)];
  const stored = result.value !== null;
  return Response.json({ adminEmployeeCodes, stored }, { status: OK_STATUS });
}

/**
 * 管理者社員番号一覧の更新。管理者のみ。
 * @param req JSON body（adminEmployeeCodes: string[]）。
 */
export async function PUT(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse({
      code: "validation_error",
      message: "リクエスト body の JSON 解析に失敗しました",
    });
  }

  const deps = await getDeps();
  const result = await updateRoleSettings(body, {
    roleSettings: deps.roleSettings,
    employees: deps.employees,
    clock: deps.clock,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json(
    { adminEmployeeCodes: [...result.value.adminEmployeeCodes], stored: true },
    { status: OK_STATUS },
  );
}
