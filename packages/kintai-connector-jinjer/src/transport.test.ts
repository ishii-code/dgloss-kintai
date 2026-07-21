import { describe, it, expect } from "vitest";
import {
  FetchJinjerTransport,
  JinjerTransportError,
} from "./transport.js";
import type { MinimalFetch, MinimalFetchResponse } from "./transport.js";
import type { JinjerConfig } from "./config.js";

const config: JinjerConfig = {
  baseUrl: "https://api.jinjer.example/",
  apiKey: "secret-key",
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

describe("FetchJinjerTransport", () => {
  it("URL・認証ヘッダ・クエリを組み立てる（実ネットワーク不使用）", async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchFn: MinimalFetch = (url, init) => {
      seen.push({ url, headers: init?.headers ?? {} });
      return Promise.resolve(okResponse({ code: 200, result: [] }));
    };
    const transport = new FetchJinjerTransport(config, fetchFn);
    const result = await transport.request({
      method: "GET",
      path: "employees",
      query: { year: 2025, month: 7 },
    });

    expect(result).toEqual({ code: 200, result: [] });
    expect(seen[0]?.url).toBe(
      "https://api.jinjer.example/api/v1/employees?year=2025&month=7",
    );
    expect(seen[0]?.headers["Authorization"]).toBe("Bearer secret-key");
    expect(seen[0]?.headers["X-Jinjer-Company-Code"]).toBe("CORP1");
  });

  it("POST ボディを JSON 直列化し Content-Type を付ける", async () => {
    let sentBody: string | undefined;
    let sentContentType: string | undefined;
    const fetchFn: MinimalFetch = (_url, init) => {
      sentBody = init?.body;
      sentContentType = init?.headers?.["Content-Type"];
      return Promise.resolve(okResponse({ code: 200, result: {} }));
    };
    await new FetchJinjerTransport(config, fetchFn).request({
      method: "POST",
      path: "stamps",
      body: { staff_code: "E001" },
    });
    expect(sentBody).toBe(JSON.stringify({ staff_code: "E001" }));
    expect(sentContentType).toBe("application/json");
  });

  it("非 2xx は JinjerTransportError", async () => {
    const fetchFn: MinimalFetch = () =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve("unauthorized"),
      });
    await expect(
      new FetchJinjerTransport(config, fetchFn).request({
        method: "GET",
        path: "employees",
      }),
    ).rejects.toBeInstanceOf(JinjerTransportError);
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
