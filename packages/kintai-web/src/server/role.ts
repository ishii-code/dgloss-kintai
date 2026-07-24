import "server-only";

/**
 * 役割（ロール）解決（サーバ専用）。
 *
 * Phase 1 の「ロール土台」。現在ログイン中の従業員の役割を `admin` / `general` で判定する。
 * 判定は **管理者の社員番号 allowlist** で行う。allowlist は環境変数
 * `KINTAI_ADMIN_EMPLOYEE_CODES`（カンマ区切りの社員番号）で与え、未設定なら既定で
 * `"0001"`（deps.ts のデモ「デモ 太郎」）のみを管理者とする。
 *
 * DB や他パッケージには一切手を入れない純粋な写像で、厳密な権限機構（RBAC）は Phase 4。
 * ここは土台として、社員番号 → 役割 の解決だけを担う。
 */

import type { Role } from "@/lib/modules";

/** allowlist が未設定・空のときに管理者とみなす既定の社員番号。 */
export const DEFAULT_ADMIN_EMPLOYEE_CODES: readonly string[] = ["0001"];

/** allowlist を与える環境変数名。 */
export const ADMIN_CODES_ENV = "KINTAI_ADMIN_EMPLOYEE_CODES";

/**
 * 環境変数の生値（カンマ区切り）を社員番号の配列へ解釈する（純粋関数）。
 *
 * - `undefined`・空文字・空白のみ … 既定（{@link DEFAULT_ADMIN_EMPLOYEE_CODES}）を返す。
 * - それ以外 … カンマ区切りを trim し、空要素を除いた配列を返す。
 *   （trim 後に 1 件も残らなければ既定へフォールバックする）
 *
 * @param raw 環境変数の生値
 * @returns 管理者社員番号の配列
 */
export function parseAdminCodes(raw: string | undefined): readonly string[] {
  if (raw === undefined) {
    return DEFAULT_ADMIN_EMPLOYEE_CODES;
  }
  const codes = raw
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  return codes.length === 0 ? DEFAULT_ADMIN_EMPLOYEE_CODES : codes;
}

/**
 * 社員番号と管理者 allowlist から役割を判定する（純粋関数・env 非依存）。
 * テスト・呼び出し側で allowlist を明示したい場合に使う。
 *
 * @param employeeCode 判定対象の社員番号
 * @param adminCodes   管理者社員番号の allowlist
 * @returns 該当すれば `"admin"`、そうでなければ `"general"`
 */
export function resolveRoleWith(
  employeeCode: string,
  adminCodes: readonly string[],
): Role {
  return adminCodes.includes(employeeCode) ? "admin" : "general";
}

/**
 * 現在の環境変数（{@link ADMIN_CODES_ENV}）に基づき、社員番号の役割を解決する。
 *
 * @param employeeCode 判定対象の社員番号
 * @returns `"admin"` または `"general"`
 */
export function resolveRole(employeeCode: string): Role {
  const adminCodes = parseAdminCodes(process.env[ADMIN_CODES_ENV]);
  return resolveRoleWith(employeeCode, adminCodes);
}
