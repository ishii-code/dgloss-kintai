/**
 * PrismaClient 生成ヘルパー。
 *
 * リポジトリ実装には PrismaClient を DI するため、本番・スクリプトからは
 * ここで生成したインスタンスを注入する。接続文字列は `DATABASE_URL` から解決する。
 */

import { PrismaClient } from "@prisma/client";

/**
 * 接続文字列を環境変数から解決する。
 * ホスティング先により変数名が異なる（Vercel の Neon 連携は `POSTGRES_PRISMA_URL`/
 * `POSTGRES_URL` を設定するなど）ため、`DATABASE_URL` を最優先にしつつ広く受ける。
 */
export function resolveDatabaseUrl(): string | undefined {
  const env = process.env;
  return (
    env["DATABASE_URL"] ??
    env["POSTGRES_PRISMA_URL"] ??
    env["POSTGRES_URL_NON_POOLING"] ??
    env["DATABASE_URL_UNPOOLED"] ??
    env["POSTGRES_URL"] ??
    undefined
  );
}

/** PrismaClient の生成オプション。 */
export interface CreatePrismaClientOptions {
  /** 接続文字列。未指定なら {@link resolveDatabaseUrl} で環境変数から解決する。 */
  readonly databaseUrl?: string;
  /** 出力するログレベル。 */
  readonly log?: readonly ("query" | "info" | "warn" | "error")[];
}

/**
 * PrismaClient を生成する。
 * @param options 接続文字列・ログ設定
 */
export function createPrismaClient(
  options: CreatePrismaClientOptions = {},
): PrismaClient {
  const { log } = options;
  const url = options.databaseUrl ?? resolveDatabaseUrl();
  return new PrismaClient({
    ...(url !== undefined ? { datasources: { db: { url } } } : {}),
    ...(log !== undefined ? { log: [...log] } : {}),
  });
}
