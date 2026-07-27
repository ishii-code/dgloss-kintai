/**
 * 承認申請の取消 API ルート（申請者本人・App Router・サーバ専用）。
 *
 * - `POST /api/workflow/cancel` 自分の pending 申請を取り消す（cancelApprovalRequest）。
 *
 * 申請者（applicantEmployeeId）は cookie セッションから解決する（クライアント指定は無視）。
 * 未ログインは 401。本人以外・pending 以外は conflict（409）としてサービス層が返す。
 */

import { cancelApprovalRequest } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import {
  apiErrorStatus,
  OK_STATUS,
  UNAUTHORIZED_STATUS,
} from "@/server/httpStatus";
import { readSessionEmployeeId } from "@/server/session";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/** 未ログイン（401）レスポンスを返す。 */
function unauthorizedResponse(): Response {
  return Response.json(
    { error: { code: "not_found", message: "ログインが必要です" } },
    { status: UNAUTHORIZED_STATUS },
  );
}

/**
 * 承認申請の取消。申請者本人のみ・pending のみ。
 * @param req JSON body（requestId）。applicantEmployeeId はセッションで解決。
 */
export async function POST(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
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
  const input = { ...base, applicantEmployeeId: employeeId };

  const deps = await getDeps();
  const result = await cancelApprovalRequest(input, {
    approvals: deps.approvals,
    clock: deps.clock,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ request: result.value }, { status: OK_STATUS });
}
