/**
 * /api/workdays ルートハンドラの結合テスト。
 * 未ログイン 401・当月のシード勤怠取得・不正期間 400 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { WorkDay } from "@dgloss-kintai/contracts";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/workdays";

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

describe("GET /api/workdays", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(getRequest({ from: "2026-07-01", to: "2026-07-31" }));
    expect(res.status).toBe(401);
  });

  it("cookie ありで当月のシード勤怠を返す", async () => {
    const res = await GET(
      getRequest(
        { from: "2026-07-01", to: "2026-07-31" },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { workDays: readonly WorkDay[] };
    expect(json.workDays.length).toBeGreaterThan(0);
    // 日付昇順で返る。
    expect(json.workDays[0]?.date).toBe("2026-07-01");
  });

  it("from > to の不正期間は 400（validation_error）", async () => {
    const res = await GET(
      getRequest(
        { from: "2026-07-31", to: "2026-07-01" },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(res.status).toBe(400);
  });
});
