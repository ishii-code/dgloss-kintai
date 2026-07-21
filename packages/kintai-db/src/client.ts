/**
 * PrismaClient 生成ヘルパー。
 *
 * リポジトリ実装には PrismaClient を DI するため、本番・スクリプトからは
 * ここで生成したインスタンスを注入する。接続文字列は `DATABASE_URL` から解決する。
 */

import { PrismaClient } from "@prisma/client";

/** PrismaClient の生成オプション。 */
export interface CreatePrismaClientOptions {
  /** 接続文字列。未指定なら環境変数 `DATABASE_URL` を使う。 */
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
  const { databaseUrl, log } = options;
  return new PrismaClient({
    ...(databaseUrl !== undefined
      ? { datasources: { db: { url: databaseUrl } } }
      : {}),
    ...(log !== undefined ? { log: [...log] } : {}),
  });
}
