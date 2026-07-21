/**
 * 打刻の API ルート（App Router・サーバ専用）。
 *
 * - `POST /api/stamps`             打刻を登録する（body → registerStamp）。
 * - `GET  /api/stamps?from=&to=`   時刻範囲で打刻を照会する（listStamps）。
 *
 * employeeId は **クライアントからは受け取らず**、httpOnly cookie セッションから解決する
 * （なりすまし防止）。未ログイン（cookie 無し）は 401 を返す。from/to は従来通りクエリで受ける。
 * サービス層の `Result` を {@link apiErrorStatus} で HTTP ステータスへマップする。
 */

import { registerStamp, listStamps } from "@dgloss-kintai/api";
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
 * 打刻登録。
 * @param req JSON body（type・stampedAt・source・note?）を持つリクエスト。employeeId は
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

  // クライアント指定の employeeId は無視し、セッションの従業員で上書きする。
  const base =
    typeof body === "object" && body !== null ? body : {};
  const input = { ...base, employeeId };

  const deps = await getDeps();
  const result = await registerStamp(input, {
    stamps: deps.stamps,
    employees: deps.employees,
    ids: deps.ids,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ stamp: result.value }, { status: OK_STATUS });
}

/**
 * 打刻照会。
 * @param req `from`・`to`（RFC3339）をクエリに持つリクエスト。employeeId は cookie セッション
 *            から解決する。
 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const query = {
    employeeId,
    from: url.searchParams.get("from") ?? "",
    to: url.searchParams.get("to") ?? "",
  };

  const deps = await getDeps();
  const result = await listStamps(query, {
    stamps: deps.stamps,
    employees: deps.employees,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ stamps: result.value }, { status: OK_STATUS });
}
