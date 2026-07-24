/**
 * 従業員管理 API（一覧・作成）の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET  /api/admin/employees` 契約含む全項目の一覧を返す（listEmployeesDetailed）。
 * - `POST /api/admin/employees` 従業員＋雇用契約を新規作成する（createEmployee）。
 *
 * いずれも cookie セッション＋社員番号 allowlist で管理者を確認し、未ログインは 401・
 * 一般ユーザーは 403。機密（給与等）を含むため一般公開しない。入力検証はサービス層（zod）に委ねる。
 */

import { createEmployee, listEmployeesDetailed } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";
import type { Employee } from "@dgloss-kintai/contracts";

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
 * 従業員の詳細一覧（契約含む）。管理者のみ。
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await listEmployeesDetailed({ employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const employees: readonly Employee[] = result.value;
  return Response.json({ employees }, { status: OK_STATUS });
}

/**
 * 従業員の新規作成。管理者のみ。id はサーバで採番する。
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

  const deps = await getDeps();
  const result = await createEmployee(body, {
    employees: deps.employees,
    ids: deps.ids,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ employee: result.value }, { status: OK_STATUS });
}
