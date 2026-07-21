import { describe, it, expect } from "vitest";
import { listWorkDays, type ListWorkDaysDeps } from "./listWorkDays.js";
import {
  InMemoryEmployeeRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";
import { makeEmployee, makeWorkDay } from "./fixtures.js";

function makeDeps(): ListWorkDaysDeps {
  return {
    workDays: new InMemoryWorkDayRepository([
      makeWorkDay("emp-1", "2025-07-01"),
      makeWorkDay("emp-1", "2025-07-02"),
      makeWorkDay("emp-1", "2025-08-01"),
      makeWorkDay("emp-2", "2025-07-01"),
    ]),
    employees: new InMemoryEmployeeRepository([makeEmployee("emp-1")]),
  };
}

describe("listWorkDays", () => {
  it("正常系: 従業員・期間で日次勤怠を日付昇順で返す", async () => {
    const result = await listWorkDays(
      { employeeId: "emp-1", from: "2025-07-01", to: "2025-07-31" },
      makeDeps(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((w) => w.date)).toEqual([
      "2025-07-01",
      "2025-07-02",
    ]);
  });

  it("正常系: 該当なしは空配列", async () => {
    const result = await listWorkDays(
      { employeeId: "emp-1", from: "2025-09-01", to: "2025-09-30" },
      makeDeps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it("異常系: from > to は validation_error", async () => {
    const result = await listWorkDays(
      { employeeId: "emp-1", from: "2025-07-31", to: "2025-07-01" },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.details?.some((d) => d.path === "from")).toBe(true);
  });

  it("異常系: 不正な日付形式は validation_error", async () => {
    const result = await listWorkDays(
      { employeeId: "emp-1", from: "2025/07/01", to: "2025-07-31" },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.details?.some((d) => d.path === "from")).toBe(true);
  });

  it("異常系: 存在しない従業員は not_found", async () => {
    const result = await listWorkDays(
      { employeeId: "ghost", from: "2025-07-01", to: "2025-07-31" },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });
});
