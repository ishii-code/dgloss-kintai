/**
 * jinjer 従業員マスタの実移行スクリプト（本番運用・あなたの環境で実行）。
 *
 * jinjer API から全従業員を pull し、本システムの DB へ upsert します。
 * 認証情報・接続先はすべて環境変数から読みます（このスクリプトやリポジトリには秘密を持ちません）。
 *
 * === 実行前の準備 ===
 *   pnpm -r build            # ワークスペースを dist までビルド
 *
 * === 環境変数 ===
 *   必須:
 *     JINJER_BASE_URL       jinjer API のベース URL（例 https://api.jinjer.example）
 *     JINJER_API_KEY        API キー（秘密）
 *     JINJER_SECRET_KEY     シークレットキー（秘密）
 *     JINJER_COMPANY_CODE   会社コード（テナント識別子）
 *     DATABASE_URL          本システムの Postgres 接続文字列（--dry-run 時は不要）
 *   任意:
 *     JINJER_API_VERSION    API バージョン（既定 v1）
 *     JINJER_TOKEN_PATH     トークン取得の相対パス（既定 token・実仕様に合わせて上書き）
 *
 * === 実行 ===
 *   # まず疎通・件数確認（DB へ書き込まない）
 *   node packages/kintai-connector-jinjer/scripts/migrate-jinjer-employees.mjs --dry-run
 *   # 本移行（DB へ upsert）
 *   node packages/kintai-connector-jinjer/scripts/migrate-jinjer-employees.mjs
 *
 * === うまくいかない場合の調整ポイント ===
 *   - トークン取得パス/応答フィールド: JINJER_TOKEN_PATH を実仕様へ。応答が access_token/
 *     accessToken/token 以外なら transport.ts の extractToken を調整（詳細 docs/JINJER_API.md）。
 *   - 従業員エンドポイント/項目名: 既定は GET api/<version>/employees、応答 { code, result: [...] }。
 *     項目コード（employment_type 等）の対応は connector の mappers.ts を参照・調整。
 */

import { FetchJinjerTransport, JinjerConnector } from "../dist/index.js";
import { migrateEmployees } from "@dgloss-kintai/jobs";

/** 環境変数を必須で取得（無ければ終了）。 */
function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    console.error(`環境変数 ${name} が未設定です。`);
    process.exit(2);
  }
  return v;
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  const config = {
    baseUrl: requireEnv("JINJER_BASE_URL"),
    apiKey: requireEnv("JINJER_API_KEY"),
    secretKey: requireEnv("JINJER_SECRET_KEY"),
    companyCode: requireEnv("JINJER_COMPANY_CODE"),
    ...(process.env.JINJER_API_VERSION
      ? { apiVersion: process.env.JINJER_API_VERSION }
      : {}),
    ...(process.env.JINJER_TOKEN_PATH
      ? { tokenPath: process.env.JINJER_TOKEN_PATH }
      : {}),
  };

  const connector = new JinjerConnector(new FetchJinjerTransport(config));

  console.log("jinjer から従業員マスタを取得します…");
  const employees = await connector.pullEmployees();
  console.log(`取得: ${employees.length} 名`);

  if (dryRun) {
    for (const e of employees) {
      console.log(`  - ${e.employeeCode} ${e.name} (${e.contract.employmentType})`);
    }
    console.log("--dry-run のため DB へは書き込みませんでした。");
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL が未設定です（本移行には必須）。");
    process.exit(2);
  }

  // 動的 import で DB 層を読み込む（--dry-run では Prisma を一切ロードしない）。
  const db = await import("@dgloss-kintai/db");
  const prisma = db.createPrismaClient();
  try {
    const sink = new db.PrismaEmployeeRepository(prisma);
    const result = await migrateEmployees({ source: { pullEmployees: async () => employees }, sink });
    console.log("=== 移行結果 ===");
    console.log(`  対象 ${result.total} / 成功 ${result.succeeded} / 失敗 ${result.failed}`);
    if (result.failed > 0) {
      for (const f of result.failures) {
        console.error(`  失敗 ${f.key}: ${f.reason}`);
      }
      process.exitCode = 1;
    } else {
      console.log("全従業員の移行に成功しました。");
    }
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error("移行に失敗しました:", err?.message ?? err);
  process.exit(1);
});
