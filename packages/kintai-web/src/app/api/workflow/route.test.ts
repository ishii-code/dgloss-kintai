/**
 * /api/workflow（一覧・起票）と /decide・/cancel の結合テスト。
 * 未ログイン 401・起票・決裁（管理者）・取消・自己承認/権限の分岐を確認する。
 */

import { describe, it, expect } from "vitest";
import type { ApprovalRequest } from "@dgloss-kintai/contracts";

import { GET, POST } from "./route";
import { POST as DECIDE } from "./decide/route";
import { POST as CANCEL } from "./cancel/route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import { SESSION_COOKIE_NAME } from "@/server/session";

const ENDPOINT = "http://localhost/api/workflow";

function cookie(employeeId: string): string {
  return `${SESSION_COOKIE_NAME}=${employeeId}`;
}

function req(
  path: string,
  method: "GET" | "POST",
  cookieValue?: string,
  body?: unknown,
): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: {
      ...(cookieValue !== undefined ? { cookie: cookieValue } : {}),
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const application = {
  type: "overtime",
  subject: "結合テストの残業",
  detail: "テスト用の残業申請です。",
  targetDate: "2026-07-31",
};

describe("GET /api/workflow", () => {
  it("cookie 未設定なら 401", async () => {
    const res = await GET(new Request(ENDPOINT));
    expect(res.status).toBe(401);
  });

  it("ログイン済みならシード済みの申請を 200 で返す", async () => {
    const res = await GET(new Request(ENDPOINT, { headers: { cookie: cookie(DEMO_EMPLOYEE_ID) } }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { requests: readonly ApprovalRequest[] };
    expect(Array.isArray(json.requests)).toBe(true);
  });
});

describe("POST /api/workflow → decide/cancel", () => {
  it("起票→管理者が承認できる（申請者は取消不可になる）", async () => {
    // 一般ユーザー（0002）が起票。
    const created = await POST(
      req("/api/workflow", "POST", cookie("emp_hanako"), application),
    );
    expect(created.status).toBe(200);
    const { request } = (await created.json()) as { request: ApprovalRequest };
    expect(request.status).toBe("pending");

    // 管理者（デモ太郎=0001）が承認。
    const decided = await DECIDE(
      req("/api/workflow/decide", "POST", cookie(DEMO_EMPLOYEE_ID), {
        requestId: request.id,
        decision: "approve",
        comment: "OK",
      }),
    );
    expect(decided.status).toBe(200);
    const decidedJson = (await decided.json()) as { request: ApprovalRequest };
    expect(decidedJson.request.status).toBe("approved");
    expect(decidedJson.request.decidedByEmployeeId).toBe(DEMO_EMPLOYEE_ID);

    // 決裁済みは取消できない（409 conflict）。
    const cancelled = await CANCEL(
      req("/api/workflow/cancel", "POST", cookie("emp_hanako"), {
        requestId: request.id,
      }),
    );
    expect(cancelled.status).toBe(409);
  });

  it("一般ユーザーの決裁は 403", async () => {
    const created = await POST(
      req("/api/workflow", "POST", cookie("emp_hanako"), application),
    );
    const { request } = (await created.json()) as { request: ApprovalRequest };

    const decided = await DECIDE(
      req("/api/workflow/decide", "POST", cookie("emp_flex"), {
        requestId: request.id,
        decision: "approve",
      }),
    );
    expect(decided.status).toBe(403);
  });

  it("申請者本人が pending を取消できる", async () => {
    const created = await POST(
      req("/api/workflow", "POST", cookie("emp_flex"), application),
    );
    const { request } = (await created.json()) as { request: ApprovalRequest };

    const cancelled = await CANCEL(
      req("/api/workflow/cancel", "POST", cookie("emp_flex"), {
        requestId: request.id,
      }),
    );
    expect(cancelled.status).toBe(200);
    const json = (await cancelled.json()) as { request: ApprovalRequest };
    expect(json.request.status).toBe("cancelled");
  });

  it("起票は未ログインなら 401", async () => {
    const res = await POST(req("/api/workflow", "POST", undefined, application));
    expect(res.status).toBe(401);
  });
});
