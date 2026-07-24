/**
 * /api/session ルートハンドラの結合テスト。
 *
 * 簡易ログイン（cookie セッション）の set（POST）/get（GET）/clear（DELETE）を検証する。
 * `new Request(...)` に Cookie ヘッダを付け、応答の Set-Cookie / JSON を確認する。
 */

import { describe, it, expect } from "vitest";

import { GET, POST, DELETE } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";
import type { EmployeeSummary } from "@/lib/employeeSummary";

const ENDPOINT = "http://localhost/api/session";

function postRequest(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/session", () => {
  it("cookie 未設定なら 200 で employee=null・role=null", async () => {
    const res = await GET(new Request(ENDPOINT));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      employee: EmployeeSummary | null;
      role: string | null;
    };
    expect(json.employee).toBeNull();
    expect(json.role).toBeNull();
  });

  it("cookie ありなら該当従業員の公開サマリと役割を返す", async () => {
    const res = await GET(
      new Request(ENDPOINT, {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${DEMO_EMPLOYEE_ID}` },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      employee: EmployeeSummary | null;
      role: string | null;
    };
    expect(json.employee?.id).toBe(DEMO_EMPLOYEE_ID);
    expect(json.employee?.name).toBe("デモ 太郎");
    // デモ太郎の社員番号 0001 は既定 allowlist に含まれ admin。
    expect(json.role).toBe("admin");
    // 機密（契約など）は含まない。
    expect(Object.keys(json.employee ?? {})).toEqual([
      "id",
      "name",
      "employeeCode",
    ]);
  });

  it("allowlist 外の従業員は role=general", async () => {
    const res = await GET(
      new Request(ENDPOINT, {
        // emp_hanako は社員番号 0002（既定 allowlist 外）。
        headers: { cookie: `${SESSION_COOKIE_NAME}=emp_hanako` },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { role: string | null };
    expect(json.role).toBe("general");
  });
});

describe("POST /api/session", () => {
  it("存在する従業員でログインすると 200・Set-Cookie を返す", async () => {
    const res = await POST(postRequest({ employeeId: DEMO_EMPLOYEE_ID }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=${DEMO_EMPLOYEE_ID}`);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const json = (await res.json()) as { employee: EmployeeSummary };
    expect(json.employee.id).toBe(DEMO_EMPLOYEE_ID);
  });

  it("存在しない従業員は 404", async () => {
    const res = await POST(postRequest({ employeeId: "emp_ghost" }));
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("not_found");
  });

  it("employeeId 欠落は 400", async () => {
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });
});

describe("DELETE /api/session", () => {
  it("cookie を失効させる Set-Cookie を返す", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=`);
    expect(setCookie).toContain("Max-Age=0");
  });
});
