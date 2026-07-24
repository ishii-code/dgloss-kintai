/**
 * 改善リクエストの API ルート（App Router・サーバ専用）。
 *
 * - `GET  /api/improvements` 改善リクエストを新しい順で一覧する（listImprovementRequests）。
 * - `POST /api/improvements` 改善リクエストを起票する（createImprovementRequest）。
 *
 * 起票者（createdByEmployeeId）は httpOnly cookie セッションから解決し、クライアント指定は
 * 無視する（なりすまし防止）。未ログイン（cookie 無し）は 401。入力検証はサービス層（zod）に委ねる。
 */

import {
  createImprovementRequest,
  listImprovementRequests,
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

/**
 * 改善リクエスト一覧。新しい順で全件返す。未ログインは 401。
 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
  }

  const deps = await getDeps();
  const result = await listImprovementRequests({
    improvements: deps.improvements,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ requests: result.value }, { status: OK_STATUS });
}

/**
 * 改善リクエスト起票。
 * @param req JSON body（category・title・body）を持つリクエスト。createdByEmployeeId は
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

  // クライアント指定の起票者は無視し、セッションの従業員で上書きする。
  const base = typeof body === "object" && body !== null ? body : {};
  const input = { ...base, createdByEmployeeId: employeeId };

  const deps = await getDeps();
  const result = await createImprovementRequest(input, {
    improvements: deps.improvements,
    employees: deps.employees,
    ids: deps.ids,
    clock: deps.clock,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ request: result.value }, { status: OK_STATUS });
}
