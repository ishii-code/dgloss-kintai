# デプロイ手順

勤怠システム（Next.js 打刻UI＋APIルート ＋ Prisma ＋ Postgres）のデプロイ。
既定は **Docker（web＋Postgres同梱）**。1 コマンドで起動でき、自社サーバ・任意のクラウド VM に載せられる。

## 構成

```
[iPad/ブラウザ] ──HTTP──▶ web (Next.js: 打刻UI + /api/*) ──Prisma──▶ Postgres
```

- `web` … `packages/kintai-web`。`DATABASE_URL` が設定されていれば `@dgloss-kintai/db`（Prisma）を
  動的 import して永続化する。未設定なら in-memory（デモ用・再起動で消える）。
- `db` … Postgres 16。初期マイグレーションは `packages/kintai-db/prisma/migrations` に含まれ、
  web コンテナ起動時に `prisma migrate deploy` で自動適用する。

## デプロイ（Docker Compose）

```sh
cp .env.example .env          # POSTGRES_PASSWORD を本番値に変更
docker compose up --build -d  # db 起動 → web ビルド → マイグレーション適用 → 起動
# → http://<host>:3000  （打刻画面）
```

- `Dockerfile` … モノレポを `pnpm -r build`（Prisma generate ＋ next build 含む）し、`next start` で提供。
- `docker-compose.yml` … `db`（healthcheck 付き）と `web` を定義。`web` は `db` が healthy になってから起動し、
  `DATABASE_URL` を自動で組み立てる。
- マイグレーションはコンテナ起動時に自動適用（`CMD` の `prisma migrate deploy`）。

> 注: 本リポジトリの CI/サンドボックスでは Docker デーモンが無いためイメージビルドは未実行。
> Docker が使える環境（本番ホスト・CI）で上記を実行する。Dockerfile / compose は標準構成。

## 従業員データの投入（重要）

`DATABASE_URL` あり（本番）モードでは、ログイン一覧・打刻に**従業員マスタが必要**。
新規 DB は従業員ゼロのため、そのままではログインできない。投入方法は次のいずれか:

1. **デモ従業員シード（初回デプロイ用）**: `KINTAI_SEED_DEMO=true`（compose の既定）だと、
   web コンテナ起動時に `@dgloss-kintai/db` の `seed`（`packages/kintai-db/src/seed.ts`）が
   デモ従業員4名を冪等に投入する。すぐにログイン→打刻を試せる。
   手動実行は `DATABASE_URL=... pnpm --filter @dgloss-kintai/db run seed`。
2. **jinjer 移行**（本番の実データ・Ph0）: `@dgloss-kintai/connector-jinjer` の `pullEmployees()` で
   従業員を取得し DB へ投入。実 jinjer 接続情報が確定してから
   （`packages/kintai-connector-jinjer/docs/JINJER_API.md` 参照）。

実データを入れたら `KINTAI_SEED_DEMO=false` にする。

ログインはキオスク型（従業員選択＝ログイン・httpOnly cookie）。パスワード/SSO は次フェーズ。

## 環境変数

| 変数 | 用途 | 必須 |
| --- | --- | --- |
| `DATABASE_URL` | Postgres 接続。未設定で in-memory | 本番は必須 |
| `POSTGRES_PASSWORD` | compose の Postgres パスワード | compose 利用時 |
| `JINJER_*` | jinjer 連携（移行・Shadow 突合）。任意 | 任意 |

## 検証済みの事実（このリポジトリで確認）

- `pnpm -r build`（Next.js 本番ビルド含む全9パッケージ）成功。テスト 367 件緑。
- **本番モード実行**（`next start` ＋ 実 Postgres 16 ＋ `DATABASE_URL`）で、
  打刻登録(POST 200)→照会(GET 200)→**Postgres への永続化**を確認。
- 初期マイグレーション（全テーブル・enum・index・FK）を実 Postgres に適用済み。

## マネージド DB / 他ホストの場合

- Postgres をマネージド（Neon / Supabase / RDS 等）にする場合は `db` サービスを使わず、
  `web` の `DATABASE_URL` をマネージド DB に向け、初回に `prisma migrate deploy` を実行する。
- Vercel 等のサーバレスに載せる場合は外部 Postgres が必須（in-memory は不可）。
  `serverExternalPackages` で Prisma を外部化済みなので、外部 DB を指定すれば動作する。

## ロールバック

マイグレーションは追加的。スキーマ変更時は `prisma migrate` で新規マイグレーションを積む。
データ破壊的変更は避け、必要なら手動 SQL を別マイグレーションとして管理する。
