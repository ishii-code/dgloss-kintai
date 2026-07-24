/**
 * /api/admin/summary ルートの結合テスト。
 *
 * 管理者は cookie（0001）でサマリを取得でき、一般（0002）は 403・未ログインは 401。
 * デモシードにより総数・在籍などが集計されることを確認する。
 */

import { describe, it, expect } from "vitest";
import type { EmployeeDatabaseSummary } from "@dgloss-kintai/api";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const GENERAL_EMPLOYEE_ID = "emp_hanako";
const ENDPOINT = "http://localhost/api/admin/summary";

function req(id?: string): Request {
  return new Request(ENDPOINT, {
    headers:
      id !== undefined ? { cookie: `${SESSION_COOKIE_NAME}=${id}` } : {},
  });
}

describe("GET /api/admin/summary", () => {
  it("未ログインは 401", async () => {
    expect((await GET(req())).status).toBe(401);
  });

  it("一般ユーザーは 403", async () => {
    expect((await GET(req(GENERAL_EMPLOYEE_ID))).status).toBe(403);
  });

  it("管理者は集計サマリを返す", async () => {
    const res = await GET(req(DEMO_EMPLOYEE_ID));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { summary: EmployeeDatabaseSummary };
    expect(json.summary.total).toBeGreaterThanOrEqual(1);
    expect(json.summary.total).toBe(
      json.summary.active + json.summary.retired,
    );
    expect(json.summary.byWorkSystem.fixed).toBeGreaterThanOrEqual(0);
  });
});
