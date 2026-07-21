/**
 * 打刻の API ルート（App Router・サーバ専用）。
 *
 * - `POST /api/stamps`                       打刻を登録する（body → registerStamp）。
 * - `GET  /api/stamps?employeeId=&from=&to=` 時刻範囲で打刻を照会する（listStamps）。
 *
 * サービス層の `Result` を {@link apiErrorStatus} で HTTP ステータスへマップし、
 * 成功は 200 でデータを返す。JSON パース失敗は 400 で握る。
 */

import { registerStamp, listStamps } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 打刻登録。
 * @param req JSON body（employeeId・type・stampedAt・source・note?）を持つリクエスト
 */
export async function POST(req: Request): Promise<Response> {
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
  const result = await registerStamp(body, {
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
 * @param req `employeeId`・`from`・`to`（RFC3339）をクエリに持つリクエスト
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = {
    employeeId: url.searchParams.get("employeeId") ?? "",
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
