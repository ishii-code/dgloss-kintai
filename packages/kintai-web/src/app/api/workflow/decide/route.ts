/**
 * 承認申請の決裁 API ルート（管理者専用・App Router・サーバ専用）。
 *
 * - `POST /api/workflow/decide` 承認申請を承認／却下する（decideApprovalRequest）。
 *
 * 決裁者（deciderEmployeeId）は cookie セッション＋社員番号 allowlist で管理者を確認し、
 * その従業員 ID を用いる（クライアント指定は無視）。未ログイン 401・一般 403。
 * pending 以外・自己承認は conflict（409）としてサービス層が返す。
 */

import { decideApprovalRequest } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 承認申請の決裁（承認／却下）。管理者のみ。
 * @param req JSON body（requestId・decision・comment?）。deciderEmployeeId はセッションで解決。
 */
export async function POST(req: Request): Promise<Response> {
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

  const base = typeof body === "object" && body !== null ? body : {};
  const input = { ...base, deciderEmployeeId: admin.employeeId };

  const deps = await getDeps();
  const result = await decideApprovalRequest(input, {
    approvals: deps.approvals,
    employees: deps.employees,
    clock: deps.clock,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ request: result.value }, { status: OK_STATUS });
}
