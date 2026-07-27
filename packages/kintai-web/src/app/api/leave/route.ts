/**
 * 年次有給休暇の残高 API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/leave?asOf=YYYY-MM-DD` 基準日時点の有給残高を取得する（getLeaveBalance）。
 *   asOf 省略時はサーバの現在日（JST）を用いる。
 *
 * employeeId は httpOnly cookie セッションから解決する。未ログインは 401。
 * 付与・取得は従業員の入社日・日次勤怠の休暇区分から導出する（新たな永続化は無し）。
 */

import { getLeaveBalance } from "@dgloss-kintai/api";
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

/** JST の現在暦日（`YYYY-MM-DD`）を返す。 */
function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * 有給残高照会。
 * @param req `asOf`（省略可）をクエリに持つリクエスト。
 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const asOf = url.searchParams.get("asOf") ?? todayJst();

  const deps = await getDeps();
  const result = await getLeaveBalance(
    { employeeId, asOf },
    { employees: deps.employees, workDays: deps.workDays },
  );

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ leave: result.value }, { status: OK_STATUS });
}
