/**
 * Result 型とエラー表現。
 *
 * サービス層は例外を投げず、成功・失敗を `Result<T>` で型として返す。
 * これにより呼び出し側（Next.js API ルート等）は網羅的にエラーを処理でき、
 * HTTP ステータスへのマッピングも `ApiError.code` を見て機械的に行える。
 */

import type { ZodError } from "zod";

/**
 * エラー種別。HTTP ステータスへの対応の目安:
 * - validation_error … 400（入力バリデーション失敗）
 * - not_found        … 404（対象リソースなし）
 * - conflict         … 409（重複・状態不整合）
 * - internal_error   … 500（想定外）
 */
export type ApiErrorCode =
  | "validation_error"
  | "not_found"
  | "conflict"
  | "internal_error";

/** バリデーションエラーの詳細（フィールド単位）。 */
export interface ApiErrorDetail {
  /** エラー箇所のパス（例 `stampedAt`、`period.month`）。 */
  readonly path: string;
  /** 人間可読なメッセージ。 */
  readonly message: string;
}

/** サービス層のエラー。code でハンドリング、message は表示・ログ用。 */
export interface ApiError {
  readonly code: ApiErrorCode;
  readonly message: string;
  /** バリデーション等の詳細（任意）。 */
  readonly details?: readonly ApiErrorDetail[];
}

/** 成功／失敗を型で表す結果。例外に頼らない。 */
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ApiError };

/** 成功の Result を作る。 */
export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

/** 失敗の Result を作る。 */
export function err<T = never>(error: ApiError): Result<T> {
  return { ok: false, error };
}

/**
 * zod の検証失敗を validation_error（400 相当）の ApiError に変換する。
 * 各 issue をフィールド単位の詳細に落とす。
 */
export function validationError(
  error: ZodError,
  message = "入力値が不正です",
): ApiError {
  return {
    code: "validation_error",
    message,
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/** not_found（404 相当）の ApiError を作る。 */
export function notFoundError(message: string): ApiError {
  return { code: "not_found", message };
}
