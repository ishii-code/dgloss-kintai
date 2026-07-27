/**
 * /api/admin/settings/calendar ルートの結合テスト。
 * 認可（401/403）、既定取得、更新→再取得の反映を確認する。
 */

import { describe, it, expect } from "vitest";
import type { WorkCalendar } from "@dgloss-kintai/contracts";

import { GET, PUT } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/settings/calendar";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}
function reqGet(c?: string): Request {
  return new Request(ENDPOINT, { headers: c !== undefined ? { cookie: c } : {} });
}
function reqPut(c: string, body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "PUT",
    headers: { cookie: c, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/settings/calendar", () => {
  it("未ログイン 401・一般 403", async () => {
    expect((await GET(reqGet())).status).toBe(401);
    expect((await GET(reqGet(cookie("emp_flex")))).status).toBe(403);
  });
  it("管理者は既定（日曜法定・土曜所定）を取得できる", async () => {
    const res = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { calendar: WorkCalendar };
    expect(json.calendar.legalHolidayWeekday).toBe(0);
    expect(json.calendar.scheduledHolidayWeekdays).toEqual([6]);
  });
});

describe("PUT /api/admin/settings/calendar", () => {
  it("更新すると再取得で反映される", async () => {
    const put = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), {
        legalHolidayWeekday: 0,
        scheduledHolidayWeekdays: [6],
        customHolidays: ["2026-08-11"],
      }),
    );
    expect(put.status).toBe(200);
    const get = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    const json = (await get.json()) as { calendar: WorkCalendar };
    expect(json.calendar.customHolidays).toEqual(["2026-08-11"]);
  });

  it("不正な曜日は 400", async () => {
    const res = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), {
        legalHolidayWeekday: 99,
        scheduledHolidayWeekdays: [],
        customHolidays: [],
      }),
    );
    expect(res.status).toBe(400);
  });
});
