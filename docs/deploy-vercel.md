# Vercel デプロイ手順

Next.js アプリ（`packages/kintai-web`）を Vercel に、Postgres は**マネージド DB**に載せる。
Vercel はサーバレスのため **in-memory は使えず、外部 Postgres が必須**。

## 1. マネージド Postgres を用意

いずれかで Postgres を作成し、接続文字列を控える:

- **Vercel Postgres**（Vercel 統合が最も簡単）
- **Neon** / **Supabase** など

接続文字列（例）:
```
postgresql://USER:PASSWORD@HOST/DB?sslmode=require
```

## 2. マイグレーション適用（初回・スキーマ変更時）

Vercel のビルドで自動適用はしない（本番 DB への破壊を避けるため）。手元から一度実行する:

```sh
DATABASE_URL="postgresql://.../DB?sslmode=require" \
  pnpm --filter @dgloss-kintai/db exec prisma migrate deploy
```

## 3. 初期従業員のシード（初回のみ・ログイン可能にする）

```sh
DATABASE_URL="postgresql://.../DB?sslmode=require" \
  pnpm --filter @dgloss-kintai/db run seed        # デモ従業員4名
# 本番の実データは jinjer 移行（pullEmployees）に置き換える
```

## 4. Vercel プロジェクト設定

Vercel ダッシュボードでリポジトリを Import し、次を設定する:

| 項目 | 値 |
| --- | --- |
| **Root Directory** | `packages/kintai-web` |
| **Framework Preset** | Next.js（自動検出） |
| **Install / Build Command** | `packages/kintai-web/vercel.json` で指定済み（上書き不要） |
| **Node.js Version** | 22.x（`packages/kintai-web/package.json` の engines で指定済み） |

`vercel.json`（コミット済み）:
```json
{
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm --filter @dgloss-kintai/web... build"
}
```
`pnpm --filter @dgloss-kintai/web... build` が、依存パッケージ（contracts/core/api/db…）を
トポロジカル順にビルドし（**db は prisma generate を含む**）、最後に web を `next build` する。

## 5. 環境変数（Vercel の Project → Settings → Environment Variables）

| 変数 | 用途 | 必須 |
| --- | --- | --- |
| `DATABASE_URL` | マネージド Postgres 接続（`sslmode=require` 推奨） | **必須** |
| `JINJER_BASE_URL` / `JINJER_API_KEY` / `JINJER_SECRET_KEY` / `JINJER_COMPANY_CODE` | jinjer 連携（任意） | 任意 |

> `KINTAI_SEED_DEMO` は Docker 起動用。Vercel では手順 3 のシードコマンドを使う。

## 6. デプロイ

`main`（または対象ブランチ）へ push すると Vercel が自動ビルド・デプロイする。
初回は手順 2・3（migrate と seed）を必ず実行してから、発行された URL を開く:
`/login` で従業員を選択 → 打刻。

## Prisma on Vercel（対応済み）

- `schema.prisma` の `binaryTargets = ["native", "rhel-openssl-3.0.x"]` で
  Vercel サーバレス（Amazon Linux）用エンジンを同梱する。
- `next.config.mjs` の `serverExternalPackages: ["@prisma/client", "@dgloss-kintai/db"]` で
  Prisma をバンドルから除外し、ランタイムでエンジンを解決する。

## 注意

- **サーバレスで in-memory は不可**（関数がステートレス）。必ず `DATABASE_URL` を設定する。
- 打刻 API は従業員マスタの存在を前提にするため、手順 3 のシード（または jinjer 移行）が必要。
- Vercel ↔ Postgres 間はコネクション数に注意（Neon/Supabase のプーラー、または Prisma の
  接続プーリング設定を利用）。負荷が上がる場合は `?pgbouncer=true` 等を検討する。
