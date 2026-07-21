import { describe, it, expect } from "vitest";
import {
  getMonthlyClosing,
  type GetMonthlyClosingDeps,
} from "./getMonthlyClosing.js";
import { InMemoryMonthlyClosingRepository } from "./inMemory.js";
import { makeMonthlyClosing } from "./fixtures.js";

function makeDeps(): GetMonthlyClosingDeps {
  return {
    closings: new InMemoryMonthlyClosingRepository([
      makeMonthlyClosing("emp-1", { year: 2025, month: 7 }),
    ]),
  };
}

describe("getMonthlyClosing", () => {
  it("正常系: 従業員・年月で月次締めを返す", async () => {
    const result = await getMonthlyClosing(
      { employeeId: "emp-1", period: { year: 2025, month: 7 } },
      makeDeps(),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.employeeId).toBe("emp-1");
    expect(result.value.period).toEqual({ year: 2025, month: 7 });
    expect(result.value.status).toBe("closed");
  });

  it("異常系: 締めが無ければ not_found", async () => {
    const result = await getMonthlyClosing(
      { employeeId: "emp-1", period: { year: 2025, month: 8 } },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("異常系: month が範囲外は validation_error", async () => {
    const result = await getMonthlyClosing(
      { employeeId: "emp-1", period: { year: 2025, month: 13 } },
      makeDeps(),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
    expect(result.error.details?.some((d) => d.path === "period.month")).toBe(
      true,
    );
  });

  it("異常系: period 欠落は validation_error", async () => {
    const result = await getMonthlyClosing({ employeeId: "emp-1" }, makeDeps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
