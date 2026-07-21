# jinjer API 連携仕様メモ

自作勤怠システムから jinjer（ジンジャー勤怠/給与）へ接続するための仕様整理。
**移行（Ph0）** と **Shadow Mode 突合（Ph2・本命）** に使う。

> jinjer API は「データ入出力口」であり計算ロジックは取得できない。用途は
> (1) 従業員マスタ＋過去勤怠の移行 pull、(2) jinjer の締め結果を「正解データ」とした 1 円突合。

## 確定事項（公開情報より）

| 項目 | 内容 | 出典 |
| --- | --- | --- |
| 認証方式 | **API Key ＋ Secret Key** を送ってアクセストークンを取得し、以降のリクエストに付与 | 公式・Zendesk |
| トークン有効期限 | **4 時間** | 公式 |
| 従業員 | 登録・更新・削除が可能（マスタ移行に使える） | プレスリリース |
| 打刻系 | 打刻情報・入退館・PC ログの登録が可能 | プレスリリース |
| 勤怠/給与 | 勤怠データ、**給与計算結果・賞与計算結果**の取得が可能（＝突合の正解データ） | プレスリリース |
| ドキュメント | https://doc.api.jinjer.biz/index.html （SPA・要ブラウザ） | 公式 |

## 未確定（実接続に必須・要確認）

公式ドキュメント（SPA）または前セッションの従業員マスタ同期実装からのみ確定できる。

- [ ] トークン取得エンドポイントの正確なパス（現状の既定は `/api/{version}/token`）
- [ ] トークン取得リクエストのフィールド名（現状 `api_key` / `secret_key` / `company_code`）
- [ ] トークン応答のフィールド名（現状 `access_token` / `expires_in` を防御的に探索）
- [ ] 各データエンドポイントの正確なパス（現状 `employees` / `stamps` / `daily_attendances` / `monthly_closings`）
- [ ] 各レスポンスの JSON フィールド名（`dto.ts` のスキーマ）
- [ ] 会社コードの渡し方（現状 `X-Jinjer-Company-Code` ヘッダ）
- [ ] ページネーション・レート制限・エラーコード体系

## 実装の差し替えポイント（実仕様が判明したら）

本コネクタは実仕様を差し替えやすい構造にしてある。変更は次の 3〜4 箇所で完結する。

1. **`transport.ts`** — 認証（トークン取得の path / リクエスト・応答フィールド名）とデータ要求のヘッダ。`FetchJinjerTransport` の `#fetchAccessToken` / `extractToken` を確定させる。
2. **`config.ts`** — `tokenPath` 既定値、`accessTokenTtlMs`（応答が `expires_in` を返すならそちら優先）。
3. **`dto.ts`** — 各レスポンスの zod スキーマ（フィールド名）。
4. **`mappers.ts`** — DTO → contracts ドメイン型のコード変換表（勤務体系・打刻種別・日区分・休暇・雇用区分の対応）。

`pull.ts` / `verify.ts` / `shadow.ts`（突合ロジック）は実仕様に依存しないため無変更で本番転用できる。

## 秘密情報の扱い

`JinjerConfig`（`apiKey` / `secretKey` / `companyCode`）は環境変数等から注入する。
コードにハードコードしない。トークンはメモリにのみキャッシュし永続化しない。

## 動作確認

実 jinjer 接続なしで突合パイプラインを検証できる:

```sh
pnpm --filter @dgloss-kintai/connector-jinjer build
node packages/kintai-connector-jinjer/dist/runner/main.js
```

`src/runner/` はスタブ transport ＋フィクスチャで `runShadowVerification` を実行する。
本番接続時は `StubJinjerTransport` を `FetchJinjerTransport`（実 config）へ、
インメモリ勤怠ソースを実 DB アダプタへ差し替える。
