import { describe, it, expect } from "vitest";
import {
  FetchJinjerTransport,
  JinjerTransportError,
  JinjerAuthError,
} from "./transport.js";
import type { MinimalFetch, MinimalFetchResponse, Clock } from "./transport.js";
import type { JinjerConfig } from "./config.js";

const config: JinjerConfig = {
  baseUrl: "https://api.jinjer.example/",
  apiKey: "api-key-1",
  secretKey: "secret-key-1",
  companyCode: "CORP1",
  apiVersion: "v1",
};

function okResponse(body: unknown): MinimalFetchResponse {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(""),
  };
}

const TOKEN_URL = "https://api.jinjer.example/api/v1/token";

/** /token へは access_token を、それ以外へは data を返すルーティング fetch。 */
function routedFetch(
  onCall: (url: string, init: Parameters<MinimalFetch>[1]) => void,
  token = "access-abc",
  data: unknown = { code: 200, result: [] },
): MinimalFetch {
  return (url, init) => {
    onCall(url, init);
    if (url === TOKEN_URL) {
      return Promise.resolve(okResponse({ access_token: token, expires_in: 14400 }));
    }
    return Promise.resolve(okResponse(data));
  };
}

describe("FetchJinjerTransport — 認証（Key+Secret→アクセストークン）", () => {
  it("トークンを取得し、データ要求に Bearer トークンを付与する", async () => {
    const calls: { url: string; init: Parameters<MinimalFetch>[1] }[] = [];
    const fetchFn = routedFetch((url, init) => calls.push({ url, init }));
    const transport = new FetchJinjerTransport(config, fetchFn);

    const result = await transport.request({
      method: "GET",
      path: "employees",
      query: { year: 2025, month: 7 },
    });

    expect(result).toEqual({ code: 200, result: [] });
    // 1 回目 = トークン取得（POST /token, key+secret を送る）
    expect(calls[0]?.url).toBe(TOKEN_URL);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(calls[0]?.init?.body).toContain("secret-key-1");
    expect(calls[0]?.init?.body).toContain("api-key-1");
    // 2 回目 = データ取得（Bearer トークン付与）
    expect(calls[1]?.url).toBe(
      "https://api.jinjer.example/api/v1/employees?year=2025&month=7",
    );
    expect(calls[1]?.init?.headers?.["Authorization"]).toBe("Bearer access-abc");
    expect(calls[1]?.init?.headers?.["X-Jinjer-Company-Code"]).toBe("CORP1");
  });

  it("トークンをキャッシュし、2回目のデータ要求では再取得しない", async () => {
    let tokenFetches = 0;
    const fetchFn = routedFetch((url) => {
      if (url === TOKEN_URL) tokenFetches += 1;
    });
    const transport = new FetchJinjerTransport(config, fetchFn);
    await transport.request({ method: "GET", path: "employees" });
    await transport.request({ method: "GET", path: "stamps" });
    expect(tokenFetches).toBe(1);
  });

  it("有効期限を過ぎたらトークンを再取得する", async () => {
    let tokenFetches = 0;
    let nowMs = 0;
    const clock: Clock = () => nowMs;
    const fetchFn = routedFetch((url) => {
      if (url === TOKEN_URL) tokenFetches += 1;
    });
    const transport = new FetchJinjerTransport(config, fetchFn, clock);
    await transport.request({ method: "GET", path: "employees" });
    // expires_in=14400秒(4時間) を超えて時刻を進める
    nowMs = 5 * 60 * 60 * 1000;
    await transport.request({ method: "GET", path: "employees" });
    expect(tokenFetches).toBe(2);
  });

  it("POST データ要求はボディを JSON 直列化し Content-Type を付ける", async () => {
    let dataBody: string | undefined;
    let dataContentType: string | undefined;
    const fetchFn: MinimalFetch = (url, init) => {
      if (url === TOKEN_URL) {
        return Promise.resolve(okResponse({ access_token: "t", expires_in: 14400 }));
      }
      dataBody = init?.body;
      dataContentType = init?.headers?.["Content-Type"];
      return Promise.resolve(okResponse({ code: 200, result: {} }));
    };
    await new FetchJinjerTransport(config, fetchFn).request({
      method: "POST",
      path: "stamps",
      body: { staff_code: "E001" },
    });
    expect(dataBody).toBe(JSON.stringify({ staff_code: "E001" }));
    expect(dataContentType).toBe("application/json");
  });

  it("データ要求の非 2xx は JinjerTransportError", async () => {
    const fetchFn: MinimalFetch = (url) => {
      if (url === TOKEN_URL) {
        return Promise.resolve(okResponse({ access_token: "t", expires_in: 14400 }));
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve("unauthorized"),
      });
    };
    await expect(
      new FetchJinjerTransport(config, fetchFn).request({
        method: "GET",
        path: "employees",
      }),
    ).rejects.toBeInstanceOf(JinjerTransportError);
  });

  it("トークン取得失敗は JinjerAuthError", async () => {
    const fetchFn: MinimalFetch = () =>
      Promise.resolve({
        ok: false,
        status: 403,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve("forbidden"),
      });
    await expect(
      new FetchJinjerTransport(config, fetchFn).request({
        method: "GET",
        path: "employees",
      }),
    ).rejects.toBeInstanceOf(JinjerAuthError);
  });

  it("トークン応答に token 文字列が無ければ JinjerAuthError", async () => {
    const fetchFn: MinimalFetch = () =>
      Promise.resolve(okResponse({ result: { note: "no token here" } }));
    await expect(
      new FetchJinjerTransport(config, fetchFn).request({
        method: "GET",
        path: "employees",
      }),
    ).rejects.toBeInstanceOf(JinjerAuthError);
  });

  it("fetch が無く注入も無ければ構築時に失敗する", () => {
    const original = (globalThis as { fetch?: unknown }).fetch;
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      expect(() => new FetchJinjerTransport(config)).toThrow();
    } finally {
      (globalThis as { fetch?: unknown }).fetch = original;
    }
  });
});
