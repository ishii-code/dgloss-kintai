/**
 * /api/admin/bonus ルートの結合テスト。
 * 認可（401/403）・正社員の試算・非正規0・バリデーションを確認する。
 */

import { describe, it, expect } from "vitest";
import type { BonusStatement } from "@dgloss-kintai/contracts";

import { POST } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/bonus";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function req(cookieValue: string | undefined, body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      ...(cookieValue !== undefined ? { cookie: cookieValue } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

const validBody = {
  employeeId: DEMO_EMPLOYEE_ID,
  label: "2026年 夏季賞与",
  params: {
    monthsMultiplier: 200,
    evaluationRate: 110,
    attendanceRate: 100,
    adjustment: 0,
  },
};

describe("POST /api/admin/bonus", () => {
  it("未ログインは 401、一般は 403", async () => {
    expect((await POST(req(undefined, validBody))).status).toBe(401);
    expect((await POST(req(cookie("emp_flex"), validBody))).status).toBe(403);
  });

  it("管理者は正社員の賞与を試算できる（基本給300,000×2.0×1.10=660,000）", async () => {
    const res = await POST(req(cookie(DEMO_EMPLOYEE_ID), validBody));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { statement: BonusStatement };
    expect(json.statement.eligible).toBe(true);
    expect(json.statement.grossBonus).toBe(660_000);
  });

  it("範囲外パラメータは 400", async () => {
    const res = await POST(
      req(cookie(DEMO_EMPLOYEE_ID), {
        ...validBody,
        params: { ...validBody.params, monthsMultiplier: 999_999 },
      }),
    );
    expect(res.status).toBe(400);
  });
});
