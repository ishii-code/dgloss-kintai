/**
 * 月次締め実行の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `POST /api/admin/closing-run` 対象年月の月次締めを実行・保存する。
 *   body: { year, month, employeeId? }（employeeId 省略で全従業員）。
 *
 * cookie セッション＋現在の管理者判定で認可する（未ログイン 401・一般 403）。
 * 勤怠（WorkDay）から締めを算出して保存し、給与明細・36協定などが実データで連結する。
 */

import { runMonthlyClosingForPeriod } from "@dgloss-kintai/api";
import type { ApiError, RunClosingResult } from "@dgloss-kintai/api";

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
 * 月次締め実行。管理者のみ。
 * @param req JSON body（year・month・任意の employeeId）。
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

  // year/month を period 形へ整える（employeeId は任意でそのまま渡す）。
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const year = Number(raw.year);
  const month = Number(raw.month);
  const input = {
    period: {
      year: Number.isFinite(year) ? year : 0,
      month: Number.isFinite(month) ? month : 0,
    },
    ...(typeof raw.employeeId === "string" && raw.employeeId !== ""
      ? { employeeId: raw.employeeId }
      : {}),
  };

  const deps = await getDeps();
  const result = await runMonthlyClosingForPeriod(input, {
    employees: deps.employees,
    workDays: deps.workDays,
    closings: deps.closings,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const summary: RunClosingResult = result.value;
  return Response.json({ result: summary }, { status: OK_STATUS });
}
