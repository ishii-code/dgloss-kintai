/**
 * /api/admin/settings/roles ルートの結合テスト。
 * 認可・最低1名・実在確認に加え、DBのロール設定が実際に管理者判定へ効くことを検証する。
 * （in-memory deps は本ファイル内で共有されるため、順序に依存した1本のシナリオで検証する）
 */

import { describe, it, expect } from "vitest";

import { GET, PUT } from "./route";
import { GET as SESSION_GET } from "../../../session/route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/admin/settings/roles";

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

describe("GET /api/admin/settings/roles", () => {
  it("未ログインは 401、一般は 403", async () => {
    expect((await GET(reqGet())).status).toBe(401);
    expect((await GET(reqGet(cookie("emp_flex")))).status).toBe(403);
  });

  it("管理者は既定（env/既定=0001）を初期値として取得できる", async () => {
    const res = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      adminEmployeeCodes: string[];
      stored: boolean;
    };
    expect(json.adminEmployeeCodes).toContain("0001");
    expect(json.stored).toBe(false);
  });
});

describe("PUT /api/admin/settings/roles（安全策と反映）", () => {
  it("空配列は 400（最低1名必須）", async () => {
    const res = await PUT(reqPut(cookie(DEMO_EMPLOYEE_ID), { adminEmployeeCodes: [] }));
    expect(res.status).toBe(400);
  });

  it("実在しない社員番号は 400", async () => {
    const res = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), { adminEmployeeCodes: ["9999"] }),
    );
    expect(res.status).toBe(400);
  });

  it("管理者を 0002 に付け替えると、以降 0002 が管理者・0001 は一般になる", async () => {
    // 0001（デモ太郎・現管理者）が 0002（デモ花子）を管理者に指定。
    const put = await PUT(
      reqPut(cookie(DEMO_EMPLOYEE_ID), { adminEmployeeCodes: ["0002"] }),
    );
    expect(put.status).toBe(200);

    // 0002（emp_hanako）は管理者になり、ロール設定を取得できる。
    const asHanako = await GET(reqGet(cookie("emp_hanako")));
    expect(asHanako.status).toBe(200);

    // 0001 は一般に降格し、管理者ルートは 403 になる。
    const asTaro = await GET(reqGet(cookie(DEMO_EMPLOYEE_ID)));
    expect(asTaro.status).toBe(403);

    // セッションの役割も DB 設定に追従する。
    const session = await SESSION_GET(
      new Request("http://localhost/api/session", {
        headers: { cookie: cookie("emp_hanako") },
      }),
    );
    const sessionJson = (await session.json()) as { role: string | null };
    expect(sessionJson.role).toBe("admin");

    // 後片付け: 0002 が 0001 を管理者へ戻す（ファイル内の他順序への影響を避ける）。
    const restore = await PUT(
      reqPut(cookie("emp_hanako"), { adminEmployeeCodes: ["0001"] }),
    );
    expect(restore.status).toBe(200);
  });
});
