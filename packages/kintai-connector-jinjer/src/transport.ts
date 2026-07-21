/**
 * HTTP transport 抽象。
 *
 * ドメイン層（pull/mapper）は `JinjerTransport` インターフェースにのみ依存し、
 * 実 HTTP 実装（`FetchJinjerTransport`）はここに隔離する。テストではスタブを注入することで
 * **実ネットワークを一切呼ばず**にフィクスチャで検証できる。
 *
 * 注意: 本パッケージは `@types/node` に依存せず（lib=ES2022 のみ）、Node のグローバル
 * `fetch` 型に頼らない。必要最小限の fetch シグネチャを {@link MinimalFetch} として自前定義し、
 * 実装は `globalThis.fetch`（Node22 のグローバル fetch）を注入する。
 */

import type { JinjerConfig } from "./config.js";
import { resolveApiVersion } from "./config.js";

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
 * グローバル fetch を用いた実 transport。
 *
 * 認証は「`Authorization: Bearer <apiKey>` ＋ `X-Jinjer-Company-Code: <companyCode>`」を送る
 * という想定（正式仕様が判明したらこのヘッダ組み立てのみ差し替える）。
 */
export class FetchJinjerTransport implements JinjerTransport {
  readonly #config: JinjerConfig;
  readonly #fetch: MinimalFetch;

  /**
   * @param config  接続設定（認証情報を含む）
   * @param fetchFn テスト用に fetch を注入可能。省略時は `globalThis.fetch` を使う。
   */
  constructor(config: JinjerConfig, fetchFn?: MinimalFetch) {
    this.#config = config;
    const resolved =
      fetchFn ?? (globalThis as unknown as { fetch?: MinimalFetch }).fetch;
    if (typeof resolved !== "function") {
      throw new Error(
        "グローバル fetch が利用できません。fetchFn を注入してください。",
      );
    }
    this.#fetch = resolved;
  }

  async request(req: JinjerRequest): Promise<unknown> {
    const version = resolveApiVersion(this.#config);
    const query = req.query ? encodeQuery(req.query) : "";
    const url = joinUrl(this.#config.baseUrl, version, req.path) + query;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.#config.apiKey}`,
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
