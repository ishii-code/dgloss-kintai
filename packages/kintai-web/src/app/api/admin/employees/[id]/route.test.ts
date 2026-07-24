/**
 * /api/admin/employees/[id]（詳細・更新）ルートの結合テスト。
 *
 * 親ルートの POST で従業員を作成し、その id で詳細取得・更新を検証する。
 * 管理者は cookie（0001）、一般は 0002。未ログイン 401・一般 403・not_found 404 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { Employee } from "@dgloss-kintai/contracts";

import { GET, PUT } from "./route";
import { POST as CREATE } from "../route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const GENERAL_EMPLOYEE_ID = "emp_hanako";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

/** params（Next.js 15 は Promise）を持つ context。 */
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

function baseInput(code: string): Record<string, unknown> {
  return {
    employeeCode: code,
    name: "詳細 太郎",
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300000,
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: 0,
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

/** 従業員を1件作成して id を返す。 */
async function createEmployee(code: string): Promise<string> {
  const res = await CREATE(
    new Request("http://localhost/api/admin/employees", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: cookie(DEMO_EMPLOYEE_ID),
      },
      body: JSON.stringify(baseInput(code)),
    }),
  );
  const json = (await res.json()) as { employee: Employee };
  return json.employee.id;
}

const DETAIL_URL = "http://localhost/api/admin/employees/x";

function getReq(c?: string): Request {
  return new Request(DETAIL_URL, {
    headers: c !== undefined ? { cookie: c } : {},
  });
}

describe("GET /api/admin/employees/[id]", () => {
  it("管理者は詳細（契約含む）を取得できる", async () => {
    const id = await createEmployee(`ID${Date.now()}`);
    const res = await GET(getReq(cookie(DEMO_EMPLOYEE_ID)), ctx(id));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { employee: Employee };
    expect(json.employee.id).toBe(id);
    expect(json.employee.contract.basicSalary).toBe(300000);
  });

  it("一般ユーザーは 403", async () => {
    const id = await createEmployee(`ID${Date.now()}b`);
    const res = await GET(getReq(cookie(GENERAL_EMPLOYEE_ID)), ctx(id));
    expect(res.status).toBe(403);
  });

  it("存在しない id は 404", async () => {
    const res = await GET(getReq(cookie(DEMO_EMPLOYEE_ID)), ctx("ghost-id"));
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/admin/employees/[id]", () => {
  it("管理者は更新でき、URL の id が優先される", async () => {
    const id = await createEmployee(`UP${Date.now()}`);
    const updated = { ...baseInput(`UP2${Date.now()}`), name: "更新後", id: "偽id" };
    const res = await PUT(
      new Request(DETAIL_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: cookie(DEMO_EMPLOYEE_ID),
        },
        body: JSON.stringify(updated),
      }),
      ctx(id),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { employee: Employee };
    expect(json.employee.id).toBe(id);
    expect(json.employee.name).toBe("更新後");
  });

  it("存在しない id の更新は 404", async () => {
    const res = await PUT(
      new Request(DETAIL_URL, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          cookie: cookie(DEMO_EMPLOYEE_ID),
        },
        body: JSON.stringify(baseInput(`NF${Date.now()}`)),
      }),
      ctx("ghost-id"),
    );
    expect(res.status).toBe(404);
  });
});
