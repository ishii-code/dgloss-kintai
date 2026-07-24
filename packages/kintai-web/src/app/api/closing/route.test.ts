/**
 * /api/closing ルートハンドラの結合テスト。
 * 未ログイン 401・確定済み締めの取得・未締め 404 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { MonthlyClosing } from "@dgloss-kintai/contracts";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/closing";

function sessionCookie(employeeId: string): string {
  return `${SESSION_COOKIE_NAME}=${employeeId}`;
}

function getRequest(params: Record<string, string>, cookie?: string): Request {
  const url = new URL(ENDPOINT);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url, {
    headers: cookie !== undefined ? { cookie } : {},
  });
}

describe("GET /api/closing", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(getRequest({ year: "2026", month: "6" }));
    expect(res.status).toBe(401);
  });

  it("シード済みの確定締め（2026-06）を 200 で返す", async () => {
    const res = await GET(
      getRequest({ year: "2026", month: "6" }, sessionCookie(DEMO_EMPLOYEE_ID)),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { closing: MonthlyClosing };
    expect(json.closing.period).toEqual({ year: 2026, month: 6 });
    expect(json.closing.status).toBe("closed");
  });

  it("締めが無い月は 404（未締め）", async () => {
    const res = await GET(
      getRequest({ year: "2026", month: "1" }, sessionCookie(DEMO_EMPLOYEE_ID)),
    );
    expect(res.status).toBe(404);
  });
});
