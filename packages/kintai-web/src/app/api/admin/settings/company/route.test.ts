/**
 * /api/admin/settings/company ルートの結合テスト。
 * 未ログイン401・一般403・管理者はGET既定取得＆PUT更新→再GETで反映を確認する。
 */

import { describe, it, expect } from "vitest";
import type { CompanySettings } from "@dgloss-kintai/contracts";

import { GET, PUT } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/settings/company";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function reqGet(cookieValue?: string): Request {
  return new Request(ENDPOINT, {
    headers: cookieValue !== undefined ? { cookie: cookieValue } : {},
  });
}

function reqPut(cookieValue: string, body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "PUT",
    headers: { cookie: cookieValue, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/admin/settings/company", () => {
  it("未ログインは 401", async () => {
    const res = await GET(reqGet());
    expect(res.status).toBe(401);
  });

  it("一般ユーザーは 403", async () => {
    const res = await GET(reqGet(cookie("emp_flex")));
    expect(res.status).toBe(403);
  });

  it("管理者は既定を含む設定を 200 で取得できる", async () => {
    const res = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { settings: CompanySettings };
    expect(json.settings.fiscalYearStartMonth).toBeGreaterThanOrEqual(1);
  });
});

describe("PUT /api/admin/settings/company", () => {
  it("管理者が更新すると再取得で反映される", async () => {
    const put = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), {
        companyName: "更新テスト株式会社",
        representativeName: "代表 花子",
        address: "大阪府",
        fiscalYearStartMonth: 1,
      }),
    );
    expect(put.status).toBe(200);
    const putJson = (await put.json()) as { settings: CompanySettings };
    expect(putJson.settings.companyName).toBe("更新テスト株式会社");
    expect(putJson.settings.fiscalYearStartMonth).toBe(1);

    const get = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    const getJson = (await get.json()) as { settings: CompanySettings };
    expect(getJson.settings.companyName).toBe("更新テスト株式会社");
    expect(getJson.settings.fiscalYearStartMonth).toBe(1);
  });

  it("一般ユーザーの更新は 403", async () => {
    const res = await PUT(
      reqPut(cookie("emp_flex"), {
        companyName: "x",
        representativeName: "",
        address: "",
        fiscalYearStartMonth: 4,
      }),
    );
    expect(res.status).toBe(403);
  });

  it("会社名が空なら 400", async () => {
    const res = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), {
        companyName: "",
        representativeName: "",
        address: "",
        fiscalYearStartMonth: 4,
      }),
    );
    expect(res.status).toBe(400);
  });
});
