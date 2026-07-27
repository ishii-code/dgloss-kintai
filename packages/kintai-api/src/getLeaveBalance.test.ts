/**
 * getLeaveBalance ユースケースのテスト。
 * in-memory リポジトリで従業員（入社日）と勤怠（休暇区分）を用意し、残高取得を検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  IsoDate,
  Minutes,
  WorkDay,
  Yen,
} from "@dgloss-kintai/contracts";
import { getLeaveBalance } from "./getLeaveBalance.js";
import {
  InMemoryEmployeeRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(hiredOn: string): Employee {
  return {
    id: "emp_1" as EmployeeId,
    employeeCode: "0001",
    name: "テスト 太郎",
    email: null,
    hiredOn,
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

function paidLeaveDay(date: string): WorkDay {
  return {
    id: `wd_${date}` as WorkDay["id"],
    employeeId: "emp_1" as EmployeeId,
    date: date as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: 0 as Minutes,
    breakMinutes: 0 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: "paid_full",
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  };
}

describe("getLeaveBalance", () => {
  it("入社6か月で10日付与された残高を返す", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("2024-04-01")]),
      workDays: new InMemoryWorkDayRepository([]),
    };
    const result = await getLeaveBalance(
      { employeeId: "emp_1", asOf: "2024-10-01" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.balance.grantedDays).toBe(10);
    expect(result.value.balance.remainingDays).toBe(10);
  });

  it("勤怠の有給取得を残高に反映する", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("2024-04-01")]),
      workDays: new InMemoryWorkDayRepository([paidLeaveDay("2024-10-10")]),
    };
    const result = await getLeaveBalance(
      { employeeId: "emp_1", asOf: "2024-12-31" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.balance.takenDays).toBe(1);
    expect(result.value.balance.remainingDays).toBe(9);
  });

  it("従業員が無ければ not_found", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([]),
      workDays: new InMemoryWorkDayRepository([]),
    };
    const result = await getLeaveBalance(
      { employeeId: "emp_missing", asOf: "2024-10-01" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("不正な基準日は validation エラー", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("2024-04-01")]),
      workDays: new InMemoryWorkDayRepository([]),
    };
    const result = await getLeaveBalance(
      { employeeId: "emp_1", asOf: "2024/10/01" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
