/**
 * セッション（簡易ログイン）の API ルート（App Router・サーバ専用）。
 *
 * - `GET    /api/session` 現在ログイン中の従業員を返す（未ログインは 200 で null）。
 * - `POST   /api/session` body {employeeId} を検証・存在確認し cookie をセット（ログイン）。
 * - `DELETE /api/session` cookie を失効させる（ログアウト＝別の従業員に切替）。
 *
 * 入力検証・存在確認はサービス層（getEmployee）に委ね、zod 検証を api 側へ集約する。
 * キオスク型の簡易ログインであり、パスワード/SSO は将来の強化事項（本実装では未対応）。
 */

import { getEmployee } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";
import type { EmployeeId } from "@dgloss-kintai/contracts";

import { getDeps } from "@/server/deps";
import { OK_STATUS, apiErrorStatus } from "@/server/httpStatus";
import {
  readSessionEmployeeId,
  sessionClearCookie,
  sessionSetCookie,
} from "@/server/session";
import { toEmployeeSummary } from "@/lib/employeeSummary";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 現在のログイン従業員を返す。
 * 未ログイン、または cookie の従業員が存在しない場合は `{ employee: null }`（200）。
 */
export async function GET(req: Request): Promise<Response> {
  const employeeId = readSessionEmployeeId(req);
  if (employeeId === null) {
    return Response.json({ employee: null }, { status: OK_STATUS });
  }
  const deps = await getDeps();
  const employee = await deps.employees.findById(employeeId);
  if (employee === null) {
    // cookie は残っているが該当従業員が居ない（退職・データ差替え等）→ 未ログイン扱い。
    return Response.json(
      { employee: null },
      { status: OK_STATUS, headers: { "set-cookie": sessionClearCookie() } },
    );
  }
  return Response.json(
    { employee: toEmployeeSummary(employee) },
    { status: OK_STATUS },
  );
}

/**
 * ログイン（従業員選択）。body の employeeId を検証・存在確認して cookie をセットする。
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
  const result = await getEmployee(body, { employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }

  const employeeId = result.value.id as EmployeeId;
  return Response.json(
    { employee: toEmployeeSummary(result.value) },
    {
      status: OK_STATUS,
      headers: { "set-cookie": sessionSetCookie(employeeId) },
    },
  );
}

/**
 * ログアウト（別の従業員に切替）。cookie を失効させる。
 */
export async function DELETE(): Promise<Response> {
  return Response.json(
    { employee: null },
    { status: OK_STATUS, headers: { "set-cookie": sessionClearCookie() } },
  );
}
