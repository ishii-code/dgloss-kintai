/**
 * 日次勤怠の API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/workdays?from=&to=` 期間（暦日）で日次勤怠を照会する（listWorkDays）。
 *
 * employeeId は httpOnly cookie セッションから解決する（クライアント指定に頼らない）。
 * 未ログイン（cookie 無し）は 401。from/to は `YYYY-MM-DD`。
 */

import { listWorkDays } from "@dgloss-kintai/api";
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
 * 日次勤怠照会。
 * @param req `from`・`to`（`YYYY-MM-DD`）をクエリに持つリクエスト。
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
  const result = await listWorkDays(query, {
    workDays: deps.workDays,
    employees: deps.employees,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ workDays: result.value }, { status: OK_STATUS });
}
