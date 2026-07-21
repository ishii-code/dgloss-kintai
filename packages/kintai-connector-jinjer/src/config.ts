/**
 * jinjer 連携の接続設定。
 *
 * 認証情報・エンドポイントは**すべて設定注入**とし、コードにハードコードしない。
 *
 * 認証モデル（公開情報から確定）: jinjer API は **API Key ＋ Secret Key** をもとに
 * **アクセストークン（有効期限 4 時間）** を取得し、以降のリクエストに付与する。
 * トークン取得エンドポイントの正確なパス・リクエスト/レスポンスのフィールド名は
 * 公式ドキュメント（SPA）でのみ確認可能なため、既定値を置きつつ config で上書きできる。
 * → 実仕様が判明したら `tokenPath` と（必要なら）{@link FetchJinjerTransport} の
 *   トークン応答パース箇所のみ差し替えれば足りる。詳細は docs/JINJER_API.md 参照。
 */

/** アクセストークンの既定有効期限（4 時間）。公開情報より。 */
export const DEFAULT_ACCESS_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;

/** トークン取得エンドポイントの既定パス（API バージョン以下の相対パス）。※要確認。 */
export const DEFAULT_TOKEN_PATH = "token";

/** jinjer 接続設定。秘密情報は環境変数等から注入する前提で、型としてのみ受ける。 */
export interface JinjerConfig {
  /** API ベース URL（例 `https://api.jinjer.example`）。末尾スラッシュは有無どちらでも可。 */
  readonly baseUrl: string;
  /** API キー（秘密情報）。アクセストークン取得に用いる。 */
  readonly apiKey: string;
  /** シークレットキー（秘密情報）。アクセストークン取得に用いる。 */
  readonly secretKey: string;
  /** 会社コード（jinjer のテナント識別子）。 */
  readonly companyCode: string;
  /** API バージョン（パス組み立てに使用）。省略時 `v1`。 */
  readonly apiVersion?: string;
  /** トークン取得エンドポイントの相対パス。省略時 {@link DEFAULT_TOKEN_PATH}。 */
  readonly tokenPath?: string;
  /**
   * アクセストークンの有効期限（ミリ秒）。省略時 {@link DEFAULT_ACCESS_TOKEN_TTL_MS}（4時間）。
   * トークン応答が `expires_in` 等を返す場合はそちらを優先し、無い場合にこの既定を使う。
   */
  readonly accessTokenTtlMs?: number;
  /** リクエストタイムアウト（ミリ秒）。省略時 `30000`。 */
  readonly timeoutMs?: number;
}

/** API バージョンの既定値を解決する。 */
export function resolveApiVersion(config: JinjerConfig): string {
  return config.apiVersion ?? "v1";
}

/** トークン取得パスの既定値を解決する。 */
export function resolveTokenPath(config: JinjerConfig): string {
  return config.tokenPath ?? DEFAULT_TOKEN_PATH;
}

/** アクセストークン有効期限の既定値を解決する。 */
export function resolveAccessTokenTtlMs(config: JinjerConfig): number {
  return config.accessTokenTtlMs ?? DEFAULT_ACCESS_TOKEN_TTL_MS;
}

/** タイムアウトの既定値を解決する。 */
export function resolveTimeoutMs(config: JinjerConfig): number {
  return config.timeoutMs ?? 30_000;
}
