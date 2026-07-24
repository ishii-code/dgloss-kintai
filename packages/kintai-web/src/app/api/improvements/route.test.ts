/**
 * /api/improvements ルートハンドラの結合テスト。
 *
 * サーバを起動せず route の GET/POST を直接呼ぶ。起票者は cookie セッションから解決するため、
 * Cookie ヘッダを付けて検証する。in-memory 実装＋デモシードで、未ログイン 401・投稿→一覧反映・
 * バリデーション異常(400) を確認する。
 */

import { describe, it, expect } from "vitest";
import type { ImprovementRequest } from "@dgloss-kintai/contracts";

import { GET, POST } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/improvements";

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

/** GET リクエストを作る（cookie 任意）。 */
function getRequest(cookie?: string): Request {
  return new Request(ENDPOINT, {
    headers: cookie !== undefined ? { cookie } : {},
  });
}

describe("POST /api/improvements", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await POST(
      postRequest({ category: "feature", title: "t", body: "b" }),
    );
    expect(res.status).toBe(401);
  });

  it("cookie ありで投稿すると 200 で request を返し、一覧に反映される", async () => {
    const cookie = sessionCookie(DEMO_EMPLOYEE_ID);
    const title = `テスト投稿 ${Date.now()}`;
    const postRes = await POST(
      postRequest({ category: "bug", title, body: "本文です" }, cookie),
    );
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as { request: ImprovementRequest };
    expect(postJson.request.title).toBe(title);
    expect(postJson.request.createdByEmployeeId).toBe(DEMO_EMPLOYEE_ID);
    expect(postJson.request.status).toBe("open");

    const getRes = await GET(getRequest(cookie));
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as {
      requests: readonly ImprovementRequest[];
    };
    expect(getJson.requests.some((r) => r.title === title)).toBe(true);
    // 新しい順（先頭が最新投稿）。
    expect(getJson.requests[0]?.title).toBe(title);
  });

  it("body に別の起票者を入れても cookie の従業員で起票される（なりすまし防止）", async () => {
    const postRes = await POST(
      postRequest(
        {
          createdByEmployeeId: "emp_manager",
          category: "other",
          title: `なりすまし ${Date.now()}`,
          body: "x",
        },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(postRes.status).toBe(200);
    const json = (await postRes.json()) as { request: ImprovementRequest };
    expect(json.request.createdByEmployeeId).toBe(DEMO_EMPLOYEE_ID);
  });

  it("不正な body（未知の種別）は 400（validation_error）", async () => {
    const res = await POST(
      postRequest(
        { category: "not_a_category", title: "t", body: "b" },
        sessionCookie(DEMO_EMPLOYEE_ID),
      ),
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /api/improvements", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(getRequest());
    expect(res.status).toBe(401);
  });

  it("cookie ありなら 200 で一覧（新しい順）を返す", async () => {
    const res = await GET(getRequest(sessionCookie(DEMO_EMPLOYEE_ID)));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      requests: readonly ImprovementRequest[];
    };
    expect(Array.isArray(json.requests)).toBe(true);
  });
});
