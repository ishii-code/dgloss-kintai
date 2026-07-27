/**
 * 企業設定の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET /api/admin/settings/company` 現在の企業設定を返す（未保存は既定）。
 * - `PUT /api/admin/settings/company` 企業設定を更新する（会社名・代表者・所在地・年度開始月）。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * 入力検証はサービス層（zod）に委ねる。
 */

import { getCompanySettings, updateCompanySettings } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";
import type { CompanySettings } from "@dgloss-kintai/contracts";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/** 企業設定の取得。管理者のみ。 */
export async function GET(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const deps = await getDeps();
  const result = await getCompanySettings({
    companySettings: deps.companySettings,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const settings: CompanySettings = result.value;
  return Response.json({ settings }, { status: OK_STATUS });
}

/**
 * 企業設定の更新。管理者のみ。
 * @param req JSON body（companyName・representativeName・address・fiscalYearStartMonth）。
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
  const result = await updateCompanySettings(body, {
    companySettings: deps.companySettings,
    clock: deps.clock,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const settings: CompanySettings = result.value;
  return Response.json({ settings }, { status: OK_STATUS });
}
