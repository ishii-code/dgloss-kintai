/**
 * データベースサマリの管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/summary` 従業員マスタの集計（総数・在籍/退職・区分別・管理監督者）を返す。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * 集計は純粋関数（employeeSummary）で、実額（給与等）は含めない。
 */

import { employeeSummary } from "@dgloss-kintai/api";
import type { ApiError, EmployeeDatabaseSummary } from "@dgloss-kintai/api";

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
 * データベースサマリ照会。管理者のみ。
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await employeeSummary({ employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const summary: EmployeeDatabaseSummary = result.value;
  return Response.json({ summary }, { status: OK_STATUS });
}
