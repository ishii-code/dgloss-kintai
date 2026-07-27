# jinjer API から従業員を自動移行する（API 連携）

jinjer API から**全従業員を pull して本システムの DB へ upsert** する移行スクリプトです。
**あなたの環境で実行**し、認証情報は環境変数で渡します（このリポジトリ・作成者は秘密情報に一切触れません）。

スクリプト: `packages/kintai-connector-jinjer/scripts/migrate-jinjer-employees.mjs`

## 使い方

```bash
# 1) ビルド
pnpm -r build

# 2) 環境変数を設定（秘密はシェル/CI のシークレットで。履歴に残さない）
export JINJER_BASE_URL="https://<jinjerのAPIベースURL>"
export JINJER_API_KEY="<APIキー>"
export JINJER_SECRET_KEY="<シークレットキー>"
export JINJER_COMPANY_CODE="<会社コード>"
export DATABASE_URL="<本システムのPostgres接続文字列>"   # 本移行時のみ必要

# 3) まず疎通・件数確認（DBへ書き込まない）
node packages/kintai-connector-jinjer/scripts/migrate-jinjer-employees.mjs --dry-run

# 4) 問題なければ本移行（社員番号キーで upsert・冪等）
node packages/kintai-connector-jinjer/scripts/migrate-jinjer-employees.mjs
```

任意の環境変数:
- `JINJER_API_VERSION`（既定 `v1`）
- `JINJER_TOKEN_PATH`（トークン取得の相対パス・既定 `token`）

## 認証モデル（実装済み）

API キー＋シークレットキーで**アクセストークン（有効期限4時間）**を取得し、以降のリクエストに
`Authorization: Bearer <token>` と `X-Jinjer-Company-Code` を付与します。トークンはメモリに
キャッシュし、期限が近づくと再取得します。

## ⚠️ jinjer 実仕様に合わせた調整が要る箇所

コネクタは公開情報から**想定した形**で組んでいます。実 API と食い違う場合は以下を調整してください
（変更は 1〜2 箇所で済む設計です）。

1. **トークン取得**（`packages/kintai-connector-jinjer/src/transport.ts`）
   - 取得パス: `JINJER_TOKEN_PATH` で指定。
   - リクエスト項目名（既定 `api_key`/`secret_key`/`company_code`）や、
     応答のトークン項目名（既定 `access_token`/`accessToken`/`token` を許容）が違う場合、
     `#fetchAccessToken` / `extractToken` を実仕様へ。

2. **従業員エンドポイント・項目名**（`src/pull.ts` / `src/dto.ts` / `src/mappers.ts`）
   - 既定は `GET api/<version>/employees`、応答 `{ code, result: [ ...従業員... ] }`。
   - 従業員項目（既定）: `staff_code`, `last_name`, `first_name`, `email`, `hire_date`,
     `resignation_date`, `employment_type`, `work_system`, `office_division`, `is_managerial`,
     `basic_salary`, `annual_scheduled_working_hours`, `fixed_overtime_allowance`,
     `fixed_overtime_coverage{overtime,overtime_over60,holiday,night}`。
   - 区分コードの対応（例: `employment_type` "1"→正社員 / "2"→非正規、`work_system` "1"→固定時間制…）は
     `src/mappers.ts` の各対応表で調整。

## 検証済みの範囲

擬似 jinjer transport（fetch 注入）で **認証→pull→スキーマ検証→ドメイン変換→Prisma upsert** の
一連が動作し、従業員が DB に upsert されることを実 Postgres で確認済みです。
残るのは**実 jinjer の URL・認証情報・実項目名**のみで、上記の環境変数・調整で対応できます。

## 迷ったら CSV でも可

API 調整に手間取る場合は、jinjer の従業員エクスポート CSV を `/import` で取り込む方法も使えます
（`deploy/jinjer-employee-import.md`）。まず CSV で稼働させ、後から API 自動同期へ移行しても構いません。
