/**
 * /api/employees ルートハンドラの結合テスト。
 *
 * ログイン画面の選択肢となる従業員一覧（公開サマリ）が返ることを確認する。
 */

import { describe, it, expect } from "vitest";

import { GET } from "./route";
import { DEMO_EMPLOYEE_ID } from "@/lib/demo";
import type { EmployeeSummary } from "@/lib/employeeSummary";

describe("GET /api/employees", () => {
  it("200 でデモ従業員の公開サマリ一覧を返す", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { employees: readonly EmployeeSummary[] };
    expect(json.employees.length).toBeGreaterThanOrEqual(2);
    expect(json.employees.some((e) => e.id === DEMO_EMPLOYEE_ID)).toBe(true);
    // 各要素は公開サマリのキーのみ（機密なし）。
    for (const e of json.employees) {
      expect(Object.keys(e).sort()).toEqual(
        ["employeeCode", "id", "name"].sort(),
      );
    }
  });
});
