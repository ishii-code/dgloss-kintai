/**
 * 従業員管理 API（詳細・更新）の管理者専用ルート（App Router・サーバ専用）。
 *
 * - `GET   /api/admin/employees/[id]` 契約含む全項目を取得する（getEmployeeDetail）。
 * - `PUT   /api/admin/employees/[id]` 従業員＋雇用契約を更新する（updateEmployee）。
 * - `PATCH /api/admin/employees/[id]` PUT と同じ（部分更新は扱わず全項目を受ける）。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * URL の id を正とし、body の id は無視する。入力検証はサービス層（zod）に委ねる。
 */

import { getEmployeeDetail, updateEmployee } from "@dgloss-kintai/api";
import type { ApiError } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ルートパラメータ（Next.js 15 では Promise）。 */
type RouteContext = { readonly params: Promise<{ readonly id: string }> };

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/**
 * 従業員の詳細照会（契約含む）。管理者のみ。
 */
export async function GET(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const { id } = await context.params;
  const deps = await getDeps();
  const result = await getEmployeeDetail({ id }, { employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ employee: result.value }, { status: OK_STATUS });
}

/** 従業員を更新する（PUT/PATCH 共通処理）。 */
async function handleUpdate(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }
  const { id } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse({
      code: "validation_error",
      message: "リクエスト body の JSON 解析に失敗しました",
    });
  }

  // URL の id を正とし、body の id は上書きする。
  const base = typeof body === "object" && body !== null ? body : {};
  const input = { ...base, id };

  const deps = await getDeps();
  const result = await updateEmployee(input, { employees: deps.employees });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  return Response.json({ employee: result.value }, { status: OK_STATUS });
}

/** 従業員の更新（全項目）。管理者のみ。 */
export async function PUT(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  return handleUpdate(req, context);
}

/** 従業員の更新（PUT と同一）。管理者のみ。 */
export async function PATCH(
  req: Request,
  context: RouteContext,
): Promise<Response> {
  return handleUpdate(req, context);
}
