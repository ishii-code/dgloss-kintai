/**
 * 給与 CSV ダウンロードの API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/payroll?year=&month=` 対象年月の月次締めから給与連携 CSV を生成し、
 *   `Content-Disposition: attachment` で返す。
 *
 * employeeId は httpOnly cookie セッションから解決する。未ログインは 401。対象の締めが無ければ
 * 404。CSV は Excel 対策で UTF-8 BOM 付き・時間は `h:mm` 表現とする。
 */

import { getMonthlyClosing } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { apiErrorStatus, UNAUTHORIZED_STATUS } from "@/server/httpStatus";
import { readSessionEmployeeId } from "@/server/session";
import { buildPayrollCsv } from "@/lib/payrollCsv";

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
 * 給与 CSV ダウンロード。
 * @param req `year`・`month` をクエリに持つリクエスト。
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

  const employee = await deps.employees.findById(employeeId);
  const employees = employee === null ? [] : [employee];
  const csv = buildPayrollCsv([result.value], employees, {
    bom: true,
    timeFormat: "hmm",
    newline: "crlf",
  });

  const mm = String(query.period.month).padStart(2, "0");
  const filename = `payroll_${query.period.year}-${mm}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
