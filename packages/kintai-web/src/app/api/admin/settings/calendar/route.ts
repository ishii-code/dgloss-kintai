/**
 * 勤務カレンダーの管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/settings/calendar` 現在の勤務カレンダーを返す（未保存は既定）。
 * - `PUT /api/admin/settings/calendar` 勤務カレンダーを更新する
 *   （法定休日曜日・所定休日曜日・会社休日）。
 *
 * cookie セッション＋現在の管理者判定で認可する（未ログイン 401・一般 403）。
 * 設定は日次化（打刻→WorkDay）の休日区分判定に反映される。
 */

import { getWorkCalendar, updateWorkCalendar } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";
import type { WorkCalendar } from "@dgloss-kintai/contracts";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/** 勤務カレンダーの取得。管理者のみ。 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await getWorkCalendar({ calendar: deps.calendar });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const calendar: WorkCalendar = result.value;
  return Response.json({ calendar }, { status: OK_STATUS });
}

/**
 * 勤務カレンダーの更新。管理者のみ。
 * @param req JSON body（legalHolidayWeekday・scheduledHolidayWeekdays・customHolidays）。
 */
export async function PUT(req: Request): Promise<Response> {
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
  const result = await updateWorkCalendar(body, {
    calendar: deps.calendar,
    clock: deps.clock,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const calendar: WorkCalendar = result.value;
  return Response.json({ calendar }, { status: OK_STATUS });
}
