/**
 * /api/stamps ルートハンドラの結合テスト。
 *
 * サーバを起動せず、route モジュールの POST/GET を直接 import し、`new Request(...)` を
 * 渡して `Response` の status / JSON を検証する。employeeId は httpOnly cookie セッション
 * （`kintai_employee`）から解決するため、リクエストに Cookie ヘッダを付けて検証する。
 * in-memory 実装＋デモ従業員シードで、cookie 未設定時の 401・登録→当日一覧反映・
 * バリデーション異常(400) を確認する。
 */

import { describe, it, expect } from "vitest";
import type { Stamp } from "@dgloss-kintai/contracts";

import { POST, GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/stamps";

/** セッション cookie 文字列を作る。 */
function sessionCookie(employeeId: string): string {
  return `${SESSION_COOKIE_NAME}=${employeeId}`;
}

/** JSON body 付きの POST リクエストを作る（cookie 任意）。 */
function postRequest(body: unknown, cookie?: string): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (cookie !== undefined) {
    headers.cookie = cookie;
  }
  return new Request(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/** クエリ付きの GET リクエストを作る（cookie 任意）。 */
function getRequest(params: Record<string, string>, cookie?: string): Request {
  const url = new URL(ENDPOINT);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url, {
    headers: cookie !== undefined ? { cookie } : {},
  });
}

describe("POST /api/stamps", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await POST(
      postRequest({
        type: "clock_in",
        stampedAt: "2026-07-21T09:00:00+09:00",
        source: "manual",
        note: null,
      }),
    );
    expect(res.status).toBe(401);
  });

  it("cookie ありで登録すると 200 で stamp を返し、当日 GET に反映される", async () => {
    const cookie = sessionCookie(DEMO_EMPLOYEE_ID);
    const stampedAt = "2026-07-21T09:00:00+09:00";
    const postRes = await POST(
      postRequest(
        { type: "clock_in", stampedAt, source: "manual", note: null },
        cookie,
      ),
    );
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as { stamp: Stamp };
    expect(postJson.stamp.type).toBe("clock_in");
    expect(postJson.stamp.employeeId).toBe(DEMO_EMPLOYEE_ID);
    expect(postJson.stamp.id).toMatch(/^stamp_/);

    const getRes = await GET(
      getRequest(
        {
          from: "2026-07-21T00:00:00+09:00",
          to: "2026-07-21T23:59:59+09:00",
        },
        cookie,
      ),
    );
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as { stamps: readonly Stamp[] };
    const found = getJson.stamps.find((s) => s.stampedAt === stampedAt);
    expect(found?.type).toBe("clock_in");
  });

  it("body に別の employeeId を入れても cookie の従業員で登録される（なりすまし防止）", async () => {
    const postRes = await POST(
      postRequest(
        {
          employeeId: "emp_manager",
          type: "clock_in",
          stampedAt: "2026-07-21T10:00:00+09:00",
          source: "manual",
          note: null,
        },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as { stamp: Stamp };
    expect(postJson.stamp.employeeId).toBe(DEMO_EMPLOYEE_ID);
  });

  it("不正な body（未知の打刻種別）は 400（validation_error）", async () => {
    const res = await POST(
      postRequest(
        {
          type: "not_a_type",
          stampedAt: "2026-07-21T09:00:00+09:00",
          source: "manual",
        },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });

  it("JSON として解析できない body は 400", async () => {
    const badReq = new Request(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: sessionCookie(DEMO_EMPLOYEE_ID),
      },
      body: "{ this is not json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });
});

describe("GET /api/stamps", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(
      getRequest({
        from: "2026-07-21T00:00:00+09:00",
        to: "2026-07-21T23:59:59+09:00",
      }),
    );
    expect(res.status).toBe(401);
  });

  it("from > to の不正クエリは 400（validation_error）", async () => {
    const res = await GET(
      getRequest(
        {
          from: "2026-07-21T23:59:59+09:00",
          to: "2026-07-21T00:00:00+09:00",
        },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });
});
