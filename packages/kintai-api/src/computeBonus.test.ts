/**
 * computeBonus ユースケースのテスト。
 */

import { describe, expect, it } from "vitest";
import type { Employee, EmployeeId, Yen } from "@dgloss-kintai/contracts";
import { computeBonus } from "./computeBonus.js";
import { InMemoryEmployeeRepository } from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(
  employmentType: "regular" | "non_regular" = "regular",
): Employee {
  return {
    id: "emp_1" as EmployeeId,
    employeeCode: "0001",
    name: "テスト 太郎",
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType,
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: asYen(300_000),
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: asYen(0),
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

const params = {
  monthsMultiplier: 200,
  evaluationRate: 110,
  attendanceRate: 100,
  adjustment: 0,
};

describe("computeBonus", () => {
  it("正社員の賞与明細を返す", async () => {
    const deps = { employees: new InMemoryEmployeeRepository([employee()]) };
    const result = await computeBonus(
      { employeeId: "emp_1", label: "2026年 夏季賞与", params },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grossBonus).toBe(660_000);
    expect(result.value.eligible).toBe(true);
  });

  it("非正規は総支給0・eligible=false", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("non_regular")]),
    };
    const result = await computeBonus(
      { employeeId: "emp_1", label: "夏季", params },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.eligible).toBe(false);
    expect(result.value.grossBonus).toBe(0);
  });

  it("従業員が無ければ not_found", async () => {
    const deps = { employees: new InMemoryEmployeeRepository([]) };
    const result = await computeBonus(
      { employeeId: "missing", label: "夏季", params },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("範囲外パラメータ（支給月数が上限超）は validation エラー", async () => {
    const deps = { employees: new InMemoryEmployeeRepository([employee()]) };
    const result = await computeBonus(
      {
        employeeId: "emp_1",
        label: "夏季",
        params: { ...params, monthsMultiplier: 999_999 },
      },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });

  it("ラベル空は validation エラー", async () => {
    const deps = { employees: new InMemoryEmployeeRepository([employee()]) };
    const result = await computeBonus(
      { employeeId: "emp_1", label: "", params },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
