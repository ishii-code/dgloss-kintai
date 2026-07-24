/**
 * /api/admin/employees（一覧・作成）ルートの結合テスト。
 *
 * サーバを起動せず route の GET/POST を直接呼ぶ。管理者は cookie（社員番号 0001＝admin）で、
 * 一般は 0002（general）で検証する。in-memory 実装＋デモシードで、403・作成→一覧反映・
 * 重複 409 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { Employee } from "@dgloss-kintai/contracts";

import { GET, POST } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/employees";
/** 一般ユーザー（社員番号 0002）のデモ従業員 ID。 */
const GENERAL_EMPLOYEE_ID = "emp_hanako";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function getReq(c?: string): Request {
  return new Request(ENDPOINT, { headers: c !== undefined ? { cookie: c } : {} });
}

function postReq(body: unknown, c?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (c !== undefined) headers.cookie = c;
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** 有効な作成入力。 */
function validInput(code: string): unknown {
  return {
    employeeCode: code,
    name: "テスト 社員",
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

describe("GET /api/admin/employees", () => {
  it("未ログインは 401", async () => {
    expect((await GET(getReq())).status).toBe(401);
  });

  it("一般ユーザーは 403", async () => {
    expect((await GET(getReq(cookie(GENERAL_EMPLOYEE_ID)))).status).toBe(403);
  });

  it("管理者は 200 で詳細一覧（契約含む）を返す", async () => {
    const res = await GET(getReq(cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { employees: readonly Employee[] };
    expect(json.employees.length).toBeGreaterThanOrEqual(1);
    // 契約（機密含む）が付いている。
    expect(json.employees[0]?.contract).toBeDefined();
  });
});

describe("POST /api/admin/employees", () => {
  it("一般ユーザーは 403", async () => {
    const res = await POST(
      postReq(validInput(`Z${Date.now()}`), cookie(GENERAL_EMPLOYEE_ID)),
    );
    expect(res.status).toBe(403);
  });

  it("管理者は作成でき、一覧に反映される", async () => {
    const code = `T${Date.now()}`;
    const res = await POST(postReq(validInput(code), cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { employee: Employee };
    expect(json.employee.employeeCode).toBe(code);

    const listRes = await GET(getReq(cookie(DEMO_EMPLOYEE_ID)));
    const listJson = (await listRes.json()) as {
      employees: readonly Employee[];
    };
    expect(listJson.employees.some((e) => e.employeeCode === code)).toBe(true);
  });

  it("社員番号重複は 409", async () => {
    const code = `D${Date.now()}`;
    await POST(postReq(validInput(code), cookie(DEMO_EMPLOYEE_ID)));
    const res = await POST(postReq(validInput(code), cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(409);
  });

  it("不正入力（勤務体系）は 400", async () => {
    const bad = validInput(`B${Date.now()}`) as { contract: { workSystem: string } };
    bad.contract.workSystem = "unknown";
    const res = await POST(postReq(bad, cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(400);
  });
});
