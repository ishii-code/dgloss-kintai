/**
 * キオスク型ログインのミドルウェア。
 *
 * セッション cookie（{@link SESSION_COOKIE_NAME}）が無い状態でページへアクセスしたら
 * `/login` へリダイレクトする。存在検証は DB を要するためここでは行わず、cookie の有無のみ
 * で判定する（存在検証は各 API ルートが担う）。
 *
 * 除外:
 * - `/login`          ログイン画面そのもの。
 * - `/api/*`          API は自前で認可する（`/api/session`・`/api/employees` は未ログインでも可、
 *                     `/api/stamps` は cookie 未設定なら 401 を返す）。HTML へのリダイレクトは不適切。
 * - `/_next/*`・静的アセット  matcher で除外。
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/server/session";

/** リダイレクト対象外のパス接頭辞。 */
const PUBLIC_PREFIXES = ["/login", "/api"] as const;

/** 未ログインならログイン画面へ誘導する。 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isPublic) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (session === undefined || session === "") {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

/** `_next` 内部と静的アセットは対象外。 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
