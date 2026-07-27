/**
 * /api/admin/compliance ルートの結合テスト。
 * 未ログイン 401・一般 403・管理者はシード従業員のレポートを 200 で受け取れることを確認する。
 */

import { describe, it, expect } from "vitest";
import type { ComplianceReportResponse } from "@dgloss-kintai/api";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/compliance";

function req(params: Record<string, string>, cookie?: string): Request {
  const url = new URL(ENDPOINT);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url, {
    headers: cookie !== undefined ? { cookie } : {},
  });
}

describe("GET /api/admin/compliance", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(req({ employeeId: DEMO_EMPLOYEE_ID, year: "2026" }));
    expect(res.status).toBe(401);
  });

  it("一般ユーザーは 403", async () => {
    // emp_flex（0004）は一般。
    const res = await GET(
      req(
        { employeeId: DEMO_EMPLOYEE_ID, year: "2026" },
        `${SESSION_COOKIE_NAME}=emp_flex`,
      ),
    );
    expect(res.status).toBe(403);
  });

  it("管理者はレポートを 200 で受け取る", async () => {
    const res = await GET(
      req(
        { employeeId: DEMO_EMPLOYEE_ID, year: "2026" },
        `${SESSION_COOKIE_NAME}=${DEMO_EMPLOYEE_ID}`,
      ),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { report: ComplianceReportResponse };
    expect(json.report.year).toBe(2026);
    expect(json.report.startMonth).toBe(4);
    expect(typeof json.report.report.hasViolation).toBe("boolean");
  });
});
