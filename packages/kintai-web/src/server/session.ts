import "server-only";

/**
 * キオスク型・簡易ログインのセッション（サーバ専用）。
 *
 * 共有 iPad 打刻端末を想定し、「従業員を選ぶ」ことを簡易ログインとみなす。
 * セッションの実体は httpOnly cookie `kintai_employee`（値＝employeeId）1つのみで、
 * クライアント JS からは読めない（なりすまし・改ざんの緩和）。
 *
 * ここでは Web 標準の {@link Request} / {@link Response} を通じて cookie を読み書きする。
 * これにより route ハンドラ内でも、`new Request(...)` を渡す結合テストからでも同一経路で
 * 検証できる（Next の `cookies()` は AsyncLocalStorage 依存でテスト単体では扱えないため）。
 *
 * 注意: パスワード/SSO は将来の強化事項であり本実装には含めない。cookie 値は署名/暗号化
 * していないため、真に認証が必要になった段階で署名付きセッションや IdP 連携へ差し替える。
 */

import type { EmployeeId } from "@dgloss-kintai/contracts";

/** セッション cookie 名（middleware でも参照する）。 */
export const SESSION_COOKIE_NAME = "kintai_employee";

/** cookie の共通属性（httpOnly・sameSite=lax・全パス）。 */
const COOKIE_BASE_ATTRS = "Path=/; HttpOnly; SameSite=Lax";

/**
 * リクエストの Cookie ヘッダから現在のログイン従業員 ID を読む。
 * 未ログイン（cookie 無し・空）は null。
 *
 * @param req 受信リクエスト
 * @returns employeeId、または null
 */
export function readSessionEmployeeId(req: Request): EmployeeId | null {
  const header = req.headers.get("cookie");
  if (header === null || header === "") {
    return null;
  }
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    const name = part.slice(0, eq).trim();
    if (name === SESSION_COOKIE_NAME) {
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      return value === "" ? null : (value as EmployeeId);
    }
  }
  return null;
}

/**
 * セッション cookie をセットする `Set-Cookie` ヘッダ値を組み立てる（ログイン）。
 * 本番（HTTPS）では Secure も付与する。
 *
 * @param employeeId ログインさせる従業員 ID
 */
export function sessionSetCookie(employeeId: EmployeeId): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(employeeId)}; ${COOKIE_BASE_ATTRS}${secure}`;
}

/**
 * セッション cookie を失効させる `Set-Cookie` ヘッダ値を組み立てる（ログアウト）。
 */
export function sessionClearCookie(): string {
  return `${SESSION_COOKIE_NAME}=; ${COOKIE_BASE_ATTRS}; Max-Age=0`;
}
