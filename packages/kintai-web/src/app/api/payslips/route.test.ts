/**
 * /api/payslips ルートハンドラの結合テスト。
 * 未ログイン 401・確定済み締めからの明細取得・締め無し 404 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { Payslip } from "@dgloss-kintai/contracts";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/payslips";

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

describe("GET /api/payslips", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(getRequest({ year: "2026", month: "6" }));
    expect(res.status).toBe(401);
  });

  it("シード済みの確定締め（2026-06）から明細を 200 で返す", async () => {
    const res = await GET(
      getRequest({ year: "2026", month: "6" }, sessionCookie(DEMO_EMPLOYEE_ID)),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { payslip: Payslip };
    expect(json.payslip.period).toEqual({ year: 2026, month: 6 });
    // 基本給が支給先頭に載り、総支給・差引支給が算出される。
    expect(json.payslip.earnings[0]?.label).toBe("基本給");
    expect(json.payslip.grossPay).toBeGreaterThan(0);
    expect(json.payslip.netBeforeStatutory).toBe(
      json.payslip.grossPay - json.payslip.totalDeductions,
    );
    // 所得税・社保は未計上プレースホルダ（金額0）。
    expect(json.payslip.statutoryPlaceholders.map((l) => l.label)).toEqual([
      "所得税",
      "社会保険料",
    ]);
  });

  it("締めが無い月は 404（未発行）", async () => {
    const res = await GET(
      getRequest({ year: "2026", month: "1" }, sessionCookie(DEMO_EMPLOYEE_ID)),
    );
    expect(res.status).toBe(404);
  });
});
