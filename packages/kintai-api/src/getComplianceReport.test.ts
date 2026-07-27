/**
 * getComplianceReport ユースケースのテスト。
 * in-memory の締めリポジトリから年度内12か月を収集し、上限評価を検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  ClassifiedWorkMinutes,
  Employee,
  EmployeeId,
  Minutes,
  MonthlyClosing,
  Yen,
} from "@dgloss-kintai/contracts";
import { getComplianceReport } from "./getComplianceReport.js";
import {
  InMemoryEmployeeRepository,
  InMemoryMonthlyClosingRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(): Employee {
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

function closing(
  year: number,
  month: number,
  classified: Partial<ClassifiedWorkMinutes>,
): MonthlyClosing {
  return {
    id: `emp_1:${year}-${month}` as MonthlyClosing["id"],
    employeeId: "emp_1" as EmployeeId,
    period: { year, month },
    status: "closed",
    totalWorkedMinutes: 0 as Minutes,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
      ...classified,
    },
    premium: {
      overtimeAllowance: asYen(0),
      overtimeOver60Allowance: asYen(0),
      holidayAllowance: asYen(0),
      nightAllowance: asYen(0),
      total: asYen(0),
    },
    fixedOvertimeAdditionalPayment: asYen(0),
    latenessDeduction: asYen(0),
    closedAt: null,
  };
}

describe("getComplianceReport", () => {
  it("年度内の締めを集計し違反なしを返す", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee()]),
      closings: new InMemoryMonthlyClosingRepository([
        closing(2026, 4, { statutoryOvertimeMinutes: 20 * 60 }),
        closing(2026, 5, { statutoryOvertimeMinutes: 30 * 60 }),
      ]),
    };
    const result = await getComplianceReport(
      { employeeId: "emp_1", year: 2026 },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.report.hasViolation).toBe(false);
    expect(result.value.monthly).toHaveLength(2);
    expect(result.value.startMonth).toBe(4);
  });

  it("単月45時間超で違反を検知する", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee()]),
      closings: new InMemoryMonthlyClosingRepository([
        closing(2026, 6, { statutoryOvertimeMinutes: 50 * 60 }),
      ]),
    };
    const result = await getComplianceReport(
      { employeeId: "emp_1", year: 2026 },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.report.hasViolation).toBe(true);
  });

  it("年度をまたいで12か月収集する（起点4月→翌年3月）", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee()]),
      closings: new InMemoryMonthlyClosingRepository([
        closing(2026, 4, { statutoryOvertimeMinutes: 10 * 60 }),
        closing(2027, 3, { statutoryOvertimeMinutes: 10 * 60 }),
      ]),
    };
    const result = await getComplianceReport(
      { employeeId: "emp_1", year: 2026 },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 2026-04 と 2027-03 の両方が年度内として拾える。
    expect(result.value.monthly).toHaveLength(2);
  });

  it("従業員が無ければ not_found", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([]),
      closings: new InMemoryMonthlyClosingRepository([]),
    };
    const result = await getComplianceReport(
      { employeeId: "emp_missing", year: 2026 },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("不正なクエリは validation エラー", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee()]),
      closings: new InMemoryMonthlyClosingRepository([]),
    };
    const result = await getComplianceReport({ employeeId: "emp_1" }, deps);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
