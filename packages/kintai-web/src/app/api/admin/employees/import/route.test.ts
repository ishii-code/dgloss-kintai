/**
 * /api/admin/employees/import・export ルートの結合テスト。
 *
 * エクスポート CSV を取得し、そのままインポートに流して往復（同値復元）を確認する。
 * 管理者は cookie（0001）、一般は 0002。403・取込結果・ヘッダ不正 400 を確認する。
 */

import { describe, it, expect } from "vitest";
import type { ImportResult } from "@dgloss-kintai/api";

import { POST as IMPORT } from "./route";
import { GET as EXPORT } from "../export/route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const GENERAL_EMPLOYEE_ID = "emp_hanako";

function cookie(id: string): string {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function exportReq(c?: string): Request {
  return new Request("http://localhost/api/admin/employees/export", {
    headers: c !== undefined ? { cookie: c } : {},
  });
}

/** CSV テキストを body に持つ import リクエスト（text/csv）。 */
function importReq(csv: string, c?: string): Request {
  const headers: Record<string, string> = { "content-type": "text/csv" };
  if (c !== undefined) headers.cookie = c;
  return new Request("http://localhost/api/admin/employees/import", {
    method: "POST",
    headers,
    body: csv,
  });
}

describe("GET /api/admin/employees/export", () => {
  it("一般ユーザーは 403", async () => {
    expect((await EXPORT(exportReq(cookie(GENERAL_EMPLOYEE_ID)))).status).toBe(
      403,
    );
  });

  it("管理者は CSV を attachment で返す", async () => {
    const res = await EXPORT(exportReq(cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    const text = await res.text();
    expect(text).toContain("社員番号");
  });
});

describe("POST /api/admin/employees/import", () => {
  it("一般ユーザーは 403", async () => {
    expect(
      (await IMPORT(importReq("dummy", cookie(GENERAL_EMPLOYEE_ID)))).status,
    ).toBe(403);
  });

  it("export → import で往復取込できる", async () => {
    const exported = await EXPORT(exportReq(cookie(DEMO_EMPLOYEE_ID)));
    const csv = await exported.text();
    const res = await IMPORT(importReq(csv, cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { result: ImportResult };
    expect(json.result.total).toBeGreaterThanOrEqual(1);
    expect(json.result.failed).toBe(0);
    expect(json.result.succeeded).toBe(json.result.total);
  });

  it("ヘッダ不正な CSV は 400", async () => {
    const res = await IMPORT(importReq("誤ヘッダ\n1,2", cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(400);
  });
});
