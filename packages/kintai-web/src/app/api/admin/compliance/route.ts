/**
 * 36協定コンプライアンスの管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/compliance?employeeId=&year=&startMonth=` 対象従業員・年度の
 *   時間外労働上限（労基法第36条）の評価レポートを返す。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * 36協定は使用者（会社）の監視義務であり、任意の従業員を横断して確認するため
 * employeeId はクエリで受ける（セッション本人に限定しない）。
 */

import { getComplianceReport } from "@dgloss-kintai/api";
import type { ApiError, ComplianceReportResponse } from "@dgloss-kintai/api";

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
 * 36協定コンプライアンス照会。管理者のみ。
 * @param req `employeeId`・`year`・`startMonth`（任意）をクエリに持つリクエスト。
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }

  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId") ?? "";
  const year = Number.parseInt(url.searchParams.get("year") ?? "", 10);
  const startMonthRaw = url.searchParams.get("startMonth");
  const query = {
    employeeId,
    year: Number.isFinite(year) ? year : 0,
    ...(startMonthRaw !== null
      ? { startMonth: Number.parseInt(startMonthRaw, 10) }
      : {}),
  };

  const deps = await getDeps();
  const result = await getComplianceReport(query, {
    employees: deps.employees,
    closings: deps.closings,
  });

  if (!result.ok) {
    return errorResponse(result.error);
  }
  const report: ComplianceReportResponse = result.value;
  return Response.json({ report }, { status: OK_STATUS });
}
