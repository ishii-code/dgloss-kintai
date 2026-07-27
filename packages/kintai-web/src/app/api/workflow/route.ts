/**
 * 承認ワークフローの API ルート（App Router・サーバ専用）。
 *
 * - `GET  /api/workflow` 承認申請を新しい順で一覧する（listApprovalRequests）。
 * - `POST /api/workflow` 承認申請を起票する（createApprovalRequest）。
 *
 * 申請者（applicantEmployeeId）は httpOnly cookie セッションから解決し、クライアント指定は
 * 無視する（なりすまし防止）。未ログイン（cookie 無し）は 401。入力検証はサービス層（zod）に委ねる。
 * 決裁・取消は /api/workflow/decide・/api/workflow/cancel を用いる。
 */

import {
  createApprovalRequest,
  listApprovalRequests,
} from "@dgloss-kintai/api";
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

/** 承認申請一覧。新しい順で全件返す。未ログインは 401。 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
  }

  const deps = await getDeps();
  const result = await listApprovalRequests({ approvals: deps.approvals });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ requests: result.value }, { status: OK_STATUS });
}

/**
 * 承認申請の起票。
 * @param req JSON body（type・subject・detail・targetDate?）。applicantEmployeeId は
 *            cookie セッションから解決するため body に含めても無視する。
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

  // クライアント指定の申請者は無視し、セッションの従業員で上書きする。
  const base = typeof body === "object" && body !== null ? body : {};
  const input = { ...base, applicantEmployeeId: employeeId };

  const deps = await getDeps();
  const result = await createApprovalRequest(input, {
    approvals: deps.approvals,
    employees: deps.employees,
    ids: deps.ids,
    clock: deps.clock,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ request: result.value }, { status: OK_STATUS });
}
