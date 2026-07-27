/**
 * 賞与計算の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `POST /api/admin/bonus` 従業員・パラメータから賞与明細（総支給まで）を算出する。
 *
 * cookie セッション＋現在の管理者判定で認可する（未ログイン 401・一般 403）。
 * 賞与は裁量的のため永続化せず都度計算する。入力検証はサービス層（zod）に委ねる。
 * 所得税・社会保険料（賞与分）は外部連携（未計上）で明細に含む。
 */

import { computeBonus } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";
import type { BonusStatement } from "@dgloss-kintai/contracts";

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
 * 賞与計算。管理者のみ。
 * @param req JSON body（employeeId・label・params）。
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
  const result = await computeBonus(body, { employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const statement: BonusStatement = result.value;
  return Response.json({ statement }, { status: OK_STATUS });
}
