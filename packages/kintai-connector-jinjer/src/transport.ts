/**
 * HTTP transport 抽象。
 *
 * ドメイン層（pull/mapper）は `JinjerTransport` インターフェースにのみ依存し、
 * 実 HTTP 実装（`FetchJinjerTransport`）はここに隔離する。テストではスタブを注入することで
 * **実ネットワークを一切呼ばず**にフィクスチャで検証できる。
 *
 * 認証（公開情報より確定）: API Key ＋ Secret Key で**アクセストークン（有効期限 4 時間）**を
 * 取得し、以降のデータ取得リクエストに `Authorization: Bearer <token>` として付与する。
 * トークンはメモリにキャッシュし、有効期限が近づいたら再取得する。トークン取得エンドポイントの
 * 正確なパス・応答フィールド名は公式ドキュメント（SPA）でのみ確認可能なため、既定値＋防御的
 * パースで実装し、判明時は最小差分で確定できる構造にしている（docs/JINJER_API.md 参照）。
 *
 * 注意: 本パッケージは `@types/node` に依存せず（lib=ES2022 のみ）、Node のグローバル
 * `fetch` 型に頼らない。必要最小限の fetch シグネチャを {@link MinimalFetch} として自前定義し、
 * 実装は `globalThis.fetch`（Node22 のグローバル fetch）を注入する。
 */

import type { JinjerConfig } from "./config.js";
import {
  resolveAccessTokenTtlMs,
  resolveApiVersion,
  resolveTokenPath,
} from "./config.js";

/** jinjer API に投げる HTTP メソッド。 */
export type JinjerHttpMethod = "GET" | "POST";

/** transport に渡す抽象リクエスト。path は API バージョン以下の相対パス（例 `employees`）。 */
export interface JinjerRequest {
  readonly method: JinjerHttpMethod;
  /** API バージョンより後ろの相対パス（先頭スラッシュ有無どちらでも可）。 */
  readonly path: string;
  /** クエリ文字列（GET）。値は文字列化して送る。 */
  readonly query?: Readonly<Record<string, string | number>>;
  /** リクエストボディ（POST）。JSON 直列化して送る。 */
  readonly body?: unknown;
}

/**
 * HTTP transport 抽象。返り値は未検証の `unknown`。
 * 呼び出し側が必ず zod で検証してからドメインに入れる。
 */
export interface JinjerTransport {
  request(req: JinjerRequest): Promise<unknown>;
}

/** transport の HTTP エラー。ステータスと対象パスを保持する。 */
export class JinjerTransportError extends Error {
  readonly status: number;
  readonly path: string;
  constructor(status: number, path: string, message: string) {
    super(`jinjer API error ${status} for ${path}: ${message}`);
    this.name = "JinjerTransportError";
    this.status = status;
    this.path = path;
  }
}

/** 認証（アクセストークン取得）に失敗したときのエラー。 */
export class JinjerAuthError extends Error {
  constructor(message: string) {
    super(`jinjer 認証に失敗しました: ${message}`);
    this.name = "JinjerAuthError";
  }
}

/** {@link MinimalFetch} が返すレスポンスの最小形。 */
export interface MinimalFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/** 依存する fetch の最小シグネチャ。Node22 のグローバル fetch はこれに構造的に適合する。 */
export type MinimalFetch = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<MinimalFetchResponse>;

/** 現在時刻（ミリ秒）を返す時計。トークン有効期限の判定をテスト可能にするため注入する。 */
export type Clock = () => number;

/** キャッシュ済みアクセストークン。 */
interface CachedToken {
  readonly token: string;
  /** このミリ秒時刻を過ぎたら失効とみなす（安全マージン込み）。 */
  readonly expiresAtMs: number;
}

/** クエリを URL エンコード済み文字列にする（URLSearchParams 非依存）。 */
function encodeQuery(query: Readonly<Record<string, string | number>>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** baseUrl・path を安全に連結する（重複スラッシュを畳む）。 */
function joinUrl(baseUrl: string, apiVersion: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/api/${apiVersion}/${cleanPath}`;
}

/**
 * トークン応答から access token と（あれば）有効期限秒を防御的に抽出する。
 * jinjer の正確なフィールド名は未確認のため、一般的な別名を順に探す。
 * 実仕様が判明したらこの関数のフィールド名のみ確定させる。
 */
function extractToken(raw: unknown): { token: string; expiresInSec?: number } {
  if (typeof raw !== "object" || raw === null) {
    throw new JinjerAuthError("トークン応答が JSON オブジェクトではありません");
  }
  const record = raw as Record<string, unknown>;
  // ネストした result/data エンベロープにも対応。
  const container =
    typeof record["result"] === "object" && record["result"] !== null
      ? (record["result"] as Record<string, unknown>)
      : typeof record["data"] === "object" && record["data"] !== null
        ? (record["data"] as Record<string, unknown>)
        : record;

  const tokenValue =
    container["access_token"] ?? container["accessToken"] ?? container["token"];
  if (typeof tokenValue !== "string" || tokenValue.length === 0) {
    throw new JinjerAuthError(
      "トークン応答に access token 文字列が見つかりません（応答フィールド名を要確認）",
    );
  }

  const expiresRaw = container["expires_in"] ?? container["expiresIn"];
  const expiresInSec =
    typeof expiresRaw === "number" && Number.isFinite(expiresRaw)
      ? expiresRaw
      : undefined;

  return expiresInSec === undefined
    ? { token: tokenValue }
    : { token: tokenValue, expiresInSec };
}

/**
 * グローバル fetch を用いた実 transport。
 *
 * データ取得の前に有効なアクセストークンを確保し（必要なら Key+Secret で取得）、
 * `Authorization: Bearer <token>` ＋ `X-Jinjer-Company-Code` を付与する。
 * トークンは有効期限までメモリにキャッシュし、期限が近づいたら再取得する。
 */
export class FetchJinjerTransport implements JinjerTransport {
  readonly #config: JinjerConfig;
  readonly #fetch: MinimalFetch;
  readonly #now: Clock;
  /** 期限判定の安全マージン（秒）。実際の期限より少し手前で再取得する。 */
  readonly #expirySafetyMs = 60_000;
  #cachedToken: CachedToken | null = null;

  /**
   * @param config  接続設定（認証情報を含む）
   * @param fetchFn テスト用に fetch を注入可能。省略時は `globalThis.fetch` を使う。
   * @param clock   現在時刻（ミリ秒）。省略時は `Date.now`。トークン期限判定に使う。
   */
  constructor(config: JinjerConfig, fetchFn?: MinimalFetch, clock?: Clock) {
    this.#config = config;
    const resolved =
      fetchFn ?? (globalThis as unknown as { fetch?: MinimalFetch }).fetch;
    if (typeof resolved !== "function") {
      throw new Error(
        "グローバル fetch が利用できません。fetchFn を注入してください。",
      );
    }
    this.#fetch = resolved;
    this.#now = clock ?? (() => Date.now());
  }

  /** 有効なアクセストークンを返す（キャッシュが失効していれば再取得）。 */
  async #ensureAccessToken(): Promise<string> {
    const cached = this.#cachedToken;
    if (cached !== null && this.#now() < cached.expiresAtMs) {
      return cached.token;
    }
    const token = await this.#fetchAccessToken();
    this.#cachedToken = token;
    return token.token;
  }

  /** Key + Secret でアクセストークンを取得する。 */
  async #fetchAccessToken(): Promise<CachedToken> {
    const version = resolveApiVersion(this.#config);
    const url = joinUrl(
      this.#config.baseUrl,
      version,
      resolveTokenPath(this.#config),
    );
    const res = await this.#fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Jinjer-Company-Code": this.#config.companyCode,
      },
      body: JSON.stringify({
        // フィールド名は要確認。判明時にここを確定する。
        api_key: this.#config.apiKey,
        secret_key: this.#config.secretKey,
        company_code: this.#config.companyCode,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new JinjerAuthError(`トークン取得が ${res.status}: ${text}`);
    }
    const { token, expiresInSec } = extractToken(await res.json());
    const ttlMs =
      expiresInSec !== undefined
        ? expiresInSec * 1000
        : resolveAccessTokenTtlMs(this.#config);
    return {
      token,
      expiresAtMs: this.#now() + ttlMs - this.#expirySafetyMs,
    };
  }

  async request(req: JinjerRequest): Promise<unknown> {
    const token = await this.#ensureAccessToken();
    const version = resolveApiVersion(this.#config);
    const query = req.query ? encodeQuery(req.query) : "";
    const url = joinUrl(this.#config.baseUrl, version, req.path) + query;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Jinjer-Company-Code": this.#config.companyCode,
      Accept: "application/json",
    };

    const init: { method: string; headers: Record<string, string>; body?: string } =
      { method: req.method, headers };
    if (req.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(req.body);
    }

    const res = await this.#fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new JinjerTransportError(res.status, req.path, text);
    }
    return res.json();
  }
}
