/**
 * /api/admin/closing-run ルートの結合テスト。
 * 認可（401/403）と、締め実行→締め取得で読める（勤怠シード済み従業員）ことを確認する。
 */

import { describe, it, expect } from "vitest";
import type { RunClosingResult } from "@dgloss-kintai/api";

import { POST } from "./route";
import { GET as CLOSING_GET } from "../../closing/route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/closing-run";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function post(cookieValue: string | undefined, body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      ...(cookieValue !== undefined ? { cookie: cookieValue } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/closing-run", () => {
  it("未ログインは 401、一般は 403", async () => {
    expect((await POST(post(undefined, { year: 2026, month: 7 }))).status).toBe(401);
    expect(
      (await POST(post(cookie("emp_flex"), { year: 2026, month: 7 }))).status,
    ).toBe(403);
  });

  it("管理者が締めを実行するとデモ勤怠(2026-07)から締めが確定し、締め取得で読める", async () => {
    // デモの WorkDay は 2026-07 に数日分シードされている（emp_demo）。
    const res = await POST(
      post(cookie(DEMO_EMPLOYEE_ID), { year: 2026, month: 7, employeeId: DEMO_EMPLOYEE_ID }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: RunClosingResult };
    expect(json.result.closedCount).toBe(1);

    // 確定後、締め取得（本人）で 200 が返る。
    const url = new URL("http://localhost/api/closing");
    url.searchParams.set("year", "2026");
    url.searchParams.set("month", "7");
    const closing = await CLOSING_GET(
      new Request(url, { headers: { cookie: cookie(DEMO_EMPLOYEE_ID) } }),
    );
    expect(closing.status).toBe(200);
  });

  it("不正な年月は 400", async () => {
    const res = await POST(post(cookie(DEMO_EMPLOYEE_ID), { year: 2026, month: 99 }));
    expect(res.status).toBe(400);
  });
});
