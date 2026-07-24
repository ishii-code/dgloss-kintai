/**
 * サービス層の `ApiErrorCode` を HTTP ステータスコードへ写す純粋関数。
 *
 * ルートハンドラはこの関数だけで失敗を HTTP に落とせる（副作用なし・テスト対象）。
 * "server-only" には依存しないため、ユニットテストから直接 import できる。
 */

import type { ApiErrorCode } from "@dgloss-kintai/api";

/**
 * `ApiErrorCode` に対応する HTTP ステータスコードを返す。
 *
 * - validation_error … 400
 * - not_found        … 404
 * - conflict         … 409
 * - internal_error   … 500
 *
 * @param code サービス層のエラーコード
 * @returns HTTP ステータスコード
 */
export function apiErrorStatus(code: ApiErrorCode): number {
  switch (code) {
    case "validation_error":
      return 400;
    case "not_found":
      return 404;
    case "conflict":
      return 409;
    case "internal_error":
      return 500;
    default: {
      // 網羅性チェック（新しいコード追加時に型エラーで気づける）。
      const exhaustive: never = code;
      return exhaustive;
    }
  }
}

/** 成功応答（200）を表す定数。 */
export const OK_STATUS = 200 as const;

/**
 * 未ログイン（セッション cookie 無し）を表す定数。
 * `ApiErrorCode` には対応しない認可レイヤの応答のため個別に持つ。
 */
export const UNAUTHORIZED_STATUS = 401 as const;

/**
 * 権限不足（ログイン済みだが管理者でない）を表す定数。
 * `ApiErrorCode` には対応しない認可レイヤの応答のため個別に持つ。
 */
export const FORBIDDEN_STATUS = 403 as const;
