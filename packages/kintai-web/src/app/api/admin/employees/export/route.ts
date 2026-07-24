/**
 * 従業員 CSV エクスポートの管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/employees/export` 全従業員を CSV でダウンロードする（exportEmployeesCsv）。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * import と列定義を共有し、そのまま取込テンプレートとしても使える。Excel 対策で UTF-8 BOM を付与する。
 */

import { exportEmployeesCsv } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** UTF-8 BOM（Excel でのの文字化け対策）。 */
const BOM = "﻿";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 従業員 CSV ダウンロード。管理者のみ。
 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await exportEmployeesCsv({ employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const filename = "employees.csv";
  return new Response(BOM + result.value, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
