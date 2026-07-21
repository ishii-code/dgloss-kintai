/**
 * jinjer 連携の接続設定。
 *
 * 認証情報・エンドポイントは**すべて設定注入**とし、コードにハードコードしない。
 * jinjer API の正式仕様（認証方式・エンドポイント）は本実装時点で現物が無いため、
 * 「company_code + api_key を Bearer トークン相当で送る」という現実的な想定に基づく。
 * 実仕様が判明したら FetchJinjerTransport のヘッダ組み立てのみ差し替えれば足りる構造にしている。
 */

/** jinjer 接続設定。秘密情報は環境変数等から注入する前提で、型としてのみ受ける。 */
export interface JinjerConfig {
  /** API ベース URL（例 `https://api.jinjer.example`）。末尾スラッシュは有無どちらでも可。 */
  readonly baseUrl: string;
  /** API キー（秘密情報）。認証ヘッダに載せる。 */
  readonly apiKey: string;
  /** 会社コード（jinjer のテナント識別子）。 */
  readonly companyCode: string;
  /** API バージョン（パス組み立てに使用）。省略時 `v1`。 */
  readonly apiVersion?: string;
  /** リクエストタイムアウト（ミリ秒）。省略時 `30000`。 */
  readonly timeoutMs?: number;
}

/** 設定の既定値を解決する。 */
export function resolveApiVersion(config: JinjerConfig): string {
  return config.apiVersion ?? "v1";
}

/** タイムアウトの既定値を解決する。 */
export function resolveTimeoutMs(config: JinjerConfig): number {
  return config.timeoutMs ?? 30_000;
}
