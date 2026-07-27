/**
 * /api/leave ルートハンドラの結合テスト。
 * 未ログイン 401・シード従業員の残高取得（入社2024-04-01・基準日指定）を確認する。
 */

import { describe, it, expect } from "vitest";
import type { LeaveBalanceResult } from "@dgloss-kintai/api";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/leave";

function req(asOf?: string, cookie?: string): Request {
  const url = new URL(ENDPOINT);
  if (asOf !== undefined) {
    url.searchParams.set("asOf", asOf);
  }
  return new Request(url, {
    headers: cookie !== undefined ? { cookie } : {},
  });
}

describe("GET /api/leave", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(req("2026-07-27"));
    expect(res.status).toBe(401);
  });

  it("シード従業員（入社2024-04-01）の残高を 200 で返す", async () => {
    const res = await GET(
      req("2026-07-27", `${SESSION_COOKIE_NAME}=${DEMO_EMPLOYEE_ID}`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { leave: LeaveBalanceResult };
    // 2024-10 に10日・2025-10 に11日付与 → 累計21日（取得なし）。
    expect(json.leave.balance.grantedDays).toBe(21);
    expect(json.leave.balance.remainingDays).toBeGreaterThan(0);
    expect(json.leave.asOf).toBe("2026-07-27");
  });
});
