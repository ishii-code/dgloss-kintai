/**
 * Prisma エラーの判定ヘルパー。
 *
 * マイグレーション未実行など「テーブルが存在しない」場合に、設定系のような
 * 既定値へフォールバックできる読み取りを壊さないための最小限の判定を提供する。
 */

/**
 * 参照先テーブルが存在しないエラー（Prisma P2021）か。
 *
 * 例) 新機能のテーブルを追加したがマイグレーション（DDL）を未適用の本番 DB。
 * この場合、設定系の get() は既定へフォールバックできるよう null を返してよい。
 * Prisma のエラークラスに依存せず、`code` を duck-typing で判定する。
 */
export function isMissingTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "P2021"
  );
}
