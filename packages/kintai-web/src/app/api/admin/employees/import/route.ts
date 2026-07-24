/**
 * 従業員 CSV インポートの管理者専用ルート（App Router・サーバ専用）。
 *
 * - `POST /api/admin/employees/import` CSV をアップロードし一括取込する（importEmployeesCsv）。
 *   body は multipart/form-data（field `file`）または CSV テキストそのものを受ける。
 *
 * cookie セッション＋社員番号 allowlist で管理者を確認する（未ログイン 401・一般 403）。
 * 取込結果（成功／失敗件数・行番号付きエラー明細）を JSON で返す。ヘッダ不正時のみ 400。
 */

import { importEmployeesCsv } from "@dgloss-kintai/api";
import type { ApiError, ImportResult } from "@dgloss-kintai/api";

import { getDeps } from "@/server/deps";
import { checkAdmin, adminDenyResponse } from "@/server/adminAuth";
import { apiErrorStatus, OK_STATUS } from "@/server/httpStatus";

/** in-memory シングルトン state を使うため常に動的実行にする。 */
export const dynamic = "force-dynamic";

/** ApiError を JSON レスポンスへ変換する。 */
function errorResponse(error: ApiError): Response {
  return Response.json({ error }, { status: apiErrorStatus(error.code) });
}

/** リクエストから CSV テキストを取り出す（multipart の file、なければ生テキスト）。 */
async function readCsvText(req: Request): Promise<string> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (file instanceof File) {
      return await file.text();
    }
    if (typeof file === "string") {
      return file;
    }
    return "";
  }
  return await req.text();
}

/**
 * 従業員 CSV 取込。管理者のみ。
 */
export async function POST(req: Request): Promise<Response> {
  const admin = await checkAdmin(req);
  if (!admin.ok) {
    return adminDenyResponse(admin.status);
  }

  const csvText = await readCsvText(req);
  const deps = await getDeps();
  const result = await importEmployeesCsv(csvText, {
    employees: deps.employees,
    ids: deps.ids,
  });
  if (!result.ok) {
    return errorResponse(result.error);
  }
  const importResult: ImportResult = result.value;
  return Response.json({ result: importResult }, { status: OK_STATUS });
}
