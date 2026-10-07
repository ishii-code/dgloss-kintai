/**
 * 固定残業超過アラートの実行ルート（App Router・サーバ専用）。
 *
 * - `GET|POST /api/cron/overtime-alerts` 対象事業部の従業員について、当月1日〜基準日
 *   （既定は今日）までの見込みで固定残業超過を判定し、初回超過者を Google チャットへ通知する。
 *
 * 想定起動元は Vercel Cron（毎日）。認可は次のいずれか:
 *   - `Authorization: Bearer <CRON_SECRET>`（Vercel Cron が付与・CRON_SECRET 設定時）
 *   - 管理者 cookie セッション（画面・手動実行用）
 * CRON_SECRET 未設定時は Cron ヘッダ認可を無効化し、管理者のみ許可する（本番では設定推奨）。
 *
 * 任意クエリ: `year`・`month`（対象年月の明示）、`asOf=YYYY-MM-DD`（基準日の明示）。
 */

import { checkFixedOvertimeAlerts } from "@dgloss-kintai/api";
import type { ApiError, CheckFixedOvertimeAlertsResult } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin } from "@/server/adminAuth";
import {
  apiErrorStatus,
  OK_STATUS,
  UNAUTHORIZED_STATUS,
} from "@/server/httpStatus";
import { overtimeAlertDepartments } from "@/server/overtimeAlertNotifier";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/** Cron 秘密（CRON_SECRET）ヘッダが一致するか。未設定時は false（Cron 認可は無効）。 */
function hasValidCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret === undefined || secret === "") {
    return false;
  }
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** 実行本体（GET/POST 共通）。 */
async function run(req: Request): Promise<Response> {
  // 認可: Cron 秘密 または 管理者セッション。
  if (!hasValidCronSecret(req)) {
    const admin = await checkAdmin(req);
    if (!admin.ok) {
      return Response.json(
        { error: { code: "not_found", message: "認可されていません" } },
        { status: UNAUTHORIZED_STATUS },
      );
    }
  }

  const url = new URL(req.url);
  const year = Number.parseInt(url.searchParams.get("year") ?? "", 10);
  const month = Number.parseInt(url.searchParams.get("month") ?? "", 10);
  const asOf = url.searchParams.get("asOf");
  const input = {
    departments: overtimeAlertDepartments(),
    ...(Number.isFinite(year) && Number.isFinite(month)
      ? { period: { year, month } }
      : {}),
    ...(asOf !== null && asOf !== "" ? { asOf } : {}),
  };

  const deps = await getDeps();
  const result = await checkFixedOvertimeAlerts(input, {
    employees: deps.employees,
    workDays: deps.workDays,
    alertState: deps.alertState,
    notifier: deps.notifier,
    clock: deps.clock,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const summary: CheckFixedOvertimeAlertsResult = result.value;
  return Response.json({ result: summary }, { status: OK_STATUS });
}

export async function GET(req: Request): Promise<Response> {
  return run(req);
}

export async function POST(req: Request): Promise<Response> {
  return run(req);
}
