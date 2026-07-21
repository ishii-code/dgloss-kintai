import { describe, it, expect } from "vitest";
import { listStamps } from "./listStamps.js";
import {
  InMemoryStampRepository,
  InMemoryEmployeeRepository,
} from "./inMemory.js";
import { makeEmployee } from "./fixtures.js";
import type { Stamp, EmployeeId, IsoDateTime } from "@dgloss-kintai/contracts";

function stamp(overrides: Partial<Stamp> = {}): Stamp {
  return {
    id: "stmp_1" as Stamp["id"],
    employeeId: "emp_1" as EmployeeId,
    type: "clock_in",
    stampedAt: "2025-07-01T09:00:00+09:00" as IsoDateTime,
    source: "manual",
    note: null,
    ...overrides,
  };
}

const deps = (stamps: readonly Stamp[]) => ({
  stamps: new InMemoryStampRepository(stamps),
  employees: new InMemoryEmployeeRepository([makeEmployee("emp_1")]),
});

describe("listStamps", () => {
  it("範囲内の打刻を時刻昇順で返す", async () => {
    const result = await listStamps(
      {
        employeeId: "emp_1",
        from: "2025-07-01T00:00:00+09:00",
        to: "2025-07-01T23:59:59+09:00",
      },
      deps([
        stamp({ id: "stmp_2" as Stamp["id"], type: "clock_out", stampedAt: "2025-07-01T18:00:00+09:00" as IsoDateTime }),
        stamp(),
      ]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((s) => s.type)).toEqual(["clock_in", "clock_out"]);
    }
  });

  it("存在しない従業員は not_found", async () => {
    const result = await listStamps(
      {
        employeeId: "ghost",
        from: "2025-07-01T00:00:00+09:00",
        to: "2025-07-01T23:59:59+09:00",
      },
      deps([]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("not_found");
  });

  it("from > to は validation_error", async () => {
    const result = await listStamps(
      {
        employeeId: "emp_1",
        from: "2025-07-02T00:00:00+09:00",
        to: "2025-07-01T00:00:00+09:00",
      },
      deps([]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });

  it("タイムゾーンなしの時刻は validation_error", async () => {
    const result = await listStamps(
      { employeeId: "emp_1", from: "2025-07-01T00:00:00", to: "2025-07-01T23:59:59" },
      deps([]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("validation_error");
  });
});
