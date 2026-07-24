/**
 * getPayslip ユースケースのテスト。
 * in-memory リポジトリで締め・従業員を用意し、明細取得・エラー分岐を検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  Yen,
} from "@dgloss-kintai/contracts";
import { getPayslip } from "./getPayslip.js";
import {
  InMemoryEmployeeRepository,
  InMemoryMonthlyClosingRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function makeEmployee(): Employee {
  return {
    id: "emp_1" as EmployeeId,
    employeeCode: "0001",
    name: "テスト 太郎",
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
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

function makeClosing(): MonthlyClosing {
  return {
    id: "emp_1:2026-07" as MonthlyClosing["id"],
    employeeId: "emp_1" as EmployeeId,
    period: { year: 2026, month: 7 },
    status: "closed",
    totalWorkedMinutes: 9600 as MonthlyClosing["totalWorkedMinutes"],
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
    premium: {
      overtimeAllowance: asYen(20_000),
      overtimeOver60Allowance: asYen(0),
      holidayAllowance: asYen(0),
      nightAllowance: asYen(2_000),
      total: asYen(22_000),
    },
    fixedOvertimeAdditionalPayment: asYen(0),
    latenessDeduction: asYen(1_500),
    closedAt: "2026-07-31T18:00:00+09:00",
  };
}

function deps() {
  return {
    employees: new InMemoryEmployeeRepository([makeEmployee()]),
    closings: new InMemoryMonthlyClosingRepository([makeClosing()]),
  };
}

describe("getPayslip", () => {
  it("締め＋従業員から明細を返す（総支給・差引支給）", async () => {
    const result = await getPayslip(
      { employeeId: "emp_1", period: { year: 2026, month: 7 } },
      deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grossPay).toBe(322_000);
    expect(result.value.totalDeductions).toBe(1_500);
    expect(result.value.netBeforeStatutory).toBe(320_500);
  });

  it("通勤手当を総支給に含める", async () => {
    const result = await getPayslip(
      {
        employeeId: "emp_1",
        period: { year: 2026, month: 7 },
        commuteAllowance: 10_000,
      },
      deps(),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.grossPay).toBe(332_000);
  });

  it("従業員が無ければ not_found", async () => {
    const result = await getPayslip(
      { employeeId: "emp_missing", period: { year: 2026, month: 7 } },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("締めが無ければ not_found", async () => {
    const result = await getPayslip(
      { employeeId: "emp_1", period: { year: 2026, month: 8 } },
      deps(),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("不正なクエリは validation エラー", async () => {
    const result = await getPayslip({ employeeId: "" }, deps());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
