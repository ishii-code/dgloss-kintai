/**
 * /api/stamps ルートハンドラの結合テスト。
 *
 * サーバを起動せず、route モジュールの POST/GET を直接 import し、`new Request(...)` を
 * 渡して `Response` の status / JSON を検証する。in-memory 実装＋デモ従業員シードで、
 * 打刻登録→当日一覧反映・バリデーション異常(400)・不明従業員(404) を確認する。
 */

import { describe, it, expect } from "vitest";
import type { Stamp } from "@dgloss-kintai/contracts";

import { POST, GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";

const ENDPOINT = "http://localhost/api/stamps";

/** JSON body 付きの POST リクエストを作る。 */
function postRequest(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** クエリ付きの GET リクエストを作る。 */
function getRequest(params: Record<string, string>): Request {
  const url = new URL(ENDPOINT);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url);
}

describe("POST /api/stamps", () => {
  it("正しい打刻を登録すると 200 で stamp を返し、当日 GET に反映される", async () => {
    const stampedAt = "2026-07-21T09:00:00+09:00";
    const postRes = await POST(
      postRequest({
        employeeId: DEMO_EMPLOYEE_ID,
        type: "clock_in",
        stampedAt,
        source: "manual",
        note: null,
      }),
    );
    expect(postRes.status).toBe(200);
    const postJson = (await postRes.json()) as { stamp: Stamp };
    expect(postJson.stamp.type).toBe("clock_in");
    expect(postJson.stamp.employeeId).toBe(DEMO_EMPLOYEE_ID);
    expect(postJson.stamp.id).toMatch(/^stamp_/);

    const getRes = await GET(
      getRequest({
        employeeId: DEMO_EMPLOYEE_ID,
        from: "2026-07-21T00:00:00+09:00",
        to: "2026-07-21T23:59:59+09:00",
      }),
    );
    expect(getRes.status).toBe(200);
    const getJson = (await getRes.json()) as { stamps: readonly Stamp[] };
    const found = getJson.stamps.find((s) => s.stampedAt === stampedAt);
    expect(found?.type).toBe("clock_in");
  });

  it("不正な body（未知の打刻種別）は 400（validation_error）", async () => {
    const res = await POST(
      postRequest({
        employeeId: DEMO_EMPLOYEE_ID,
        type: "not_a_type",
        stampedAt: "2026-07-21T09:00:00+09:00",
        source: "manual",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });

  it("JSON として解析できない body は 400", async () => {
    const badReq = new Request(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{ this is not json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });

  it("存在しない従業員は 404（not_found）", async () => {
    const res = await POST(
      postRequest({
        employeeId: "emp_unknown",
        type: "clock_in",
        stampedAt: "2026-07-21T09:00:00+09:00",
        source: "manual",
      }),
    );
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("not_found");
  });
});

describe("GET /api/stamps", () => {
  it("from > to の不正クエリは 400（validation_error）", async () => {
    const res = await GET(
      getRequest({
        employeeId: DEMO_EMPLOYEE_ID,
        from: "2026-07-21T23:59:59+09:00",
        to: "2026-07-21T00:00:00+09:00",
      }),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("validation_error");
  });

  it("存在しない従業員の照会は 404", async () => {
    const res = await GET(
      getRequest({
        employeeId: "emp_unknown",
        from: "2026-07-21T00:00:00+09:00",
        to: "2026-07-21T23:59:59+09:00",
      }),
    );
    expect(res.status).toBe(404);
  });
});
