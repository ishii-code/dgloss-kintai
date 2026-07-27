/**
 * /api/admin/attendance-build ルートの結合テスト。
 * 認可（401/403）と、打刻→日次化→締め→締め取得の連結を確認する。
 */

import { describe, it, expect } from "vitest";
import type { BuildDailyResult } from "@dgloss-kintai/api";

import { POST } from "./route";
import { POST as STAMP_POST } from "../../stamps/route";
import { POST as CLOSING_RUN } from "../closing-run/route";
import { GET as CLOSING_GET } from "../../closing/route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function post(url: string, cookieValue: string | undefined, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: "POST",
    headers: {
      ...(cookieValue !== undefined ? { cookie: cookieValue } : {}),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/attendance-build", () => {
  it("未ログインは 401、一般は 403", async () => {
    expect(
      (await POST(post("/api/admin/attendance-build", undefined, { year: 2026, month: 9 }))).status,
    ).toBe(401);
    expect(
      (await POST(post("/api/admin/attendance-build", cookie("emp_flex"), { year: 2026, month: 9 }))).status,
    ).toBe(403);
  });

  it("打刻→日次化→締めまで連結し、締め取得で読める", async () => {
    // デモ太郎で 2026-09-01 の出勤・退勤を打刻（stampedAt はサーバのclockだが、
    // ここではルート経由でtypeのみ登録。日次化は打刻の実時刻で判定される）。
    // 打刻登録（clock_in / clock_out）。
    await STAMP_POST(
      post("/api/stamps", cookie(DEMO_EMPLOYEE_ID), {
        type: "clock_in",
        stampedAt: "2026-09-01T09:00:00+09:00",
        source: "manual",
      }),
    );
    await STAMP_POST(
      post("/api/stamps", cookie(DEMO_EMPLOYEE_ID), {
        type: "clock_out",
        stampedAt: "2026-09-01T18:00:00+09:00",
        source: "manual",
      }),
    );

    // 日次化（管理者）。
    const build = await POST(
      post("/api/admin/attendance-build", cookie(DEMO_EMPLOYEE_ID), {
        year: 2026,
        month: 9,
        employeeId: DEMO_EMPLOYEE_ID,
      }),
    );
    expect(build.status).toBe(200);
    const buildJson = (await build.json()) as { result: BuildDailyResult };
    expect(buildJson.result.builtCount).toBe(1);

    // 締め実行 → 締め取得で 200。
    await CLOSING_RUN(
      post("/api/admin/closing-run", cookie(DEMO_EMPLOYEE_ID), {
        year: 2026,
        month: 9,
        employeeId: DEMO_EMPLOYEE_ID,
      }),
    );
    const url = new URL("http://localhost/api/closing");
    url.searchParams.set("year", "2026");
    url.searchParams.set("month", "9");
    const closing = await CLOSING_GET(
      new Request(url, { headers: { cookie: cookie(DEMO_EMPLOYEE_ID) } }),
    );
    expect(closing.status).toBe(200);
  });
});
