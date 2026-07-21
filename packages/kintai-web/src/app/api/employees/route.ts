/**
 * 従業員一覧の API ルート（App Router・サーバ専用）。
 *
 * - `GET /api/employees` ログイン画面の従業員選択肢を返す（listEmployees）。
 *
 * 返すのは公開サマリ（id・氏名・社員番号）のみで、契約・給与などの機密は含めない。
 */

import { listEmployees } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { OK_STATUS, apiErrorStatus } from "@/server/httpStatus";
import { toEmployeeSummary } from "@/lib/employeeSummary";
import type { EmployeeSummary } from "@/lib/employeeSummary";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/**
 * 従業員一覧照会。
 */
export async function GET(): Promise<Response> {
  const deps = await getDeps();
  const result = await listEmployees({ employees: deps.employees });
  if (!result.ok) {
    return Response.json(
      { error: result.error },
      { status: apiErrorStatus(result.error.code) },
    );
  }
  const employees: readonly EmployeeSummary[] =
    result.value.map(toEmployeeSummary);
  return Response.json({ employees }, { status: OK_STATUS });
}
