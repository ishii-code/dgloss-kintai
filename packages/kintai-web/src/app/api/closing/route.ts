/**
 * 月次締めの API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/closing?year=&month=` 年月の月次締めを取得する（getMonthlyClosing）。
 *
 * employeeId は httpOnly cookie セッションから解決する。未ログインは 401。締めが無ければ
 * サービス層が not_found を返し 404 になる（画面側で「未締め」表示に用いる）。
 */

import { getMonthlyClosing } from "@dgloss-kintai/api";
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
 * 月次締め照会。
 * @param req `year`・`month` をクエリに持つリクエスト（数値へ解釈する）。
 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return unauthorizedResponse();
  }

  const url = new URL(req.url);
  const year = Number.parseInt(url.searchParams.get("year") ?? "", 10);
  const month = Number.parseInt(url.searchParams.get("month") ?? "", 10);
  const query = {
    employeeId,
    period: {
      year: Number.isFinite(year) ? year : 0,
      month: Number.isFinite(month) ? month : 0,
    },
  };

  const deps = await getDeps();
  const result = await getMonthlyClosing(query, { closings: deps.closings });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ closing: result.value }, { status: OK_STATUS });
}
