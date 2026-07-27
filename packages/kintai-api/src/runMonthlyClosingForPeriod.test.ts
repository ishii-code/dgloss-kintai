/**
 * runMonthlyClosingForPeriod ユースケースのテスト。
 * 勤怠から締めを算出・保存し、後続の取得で読めること、勤怠なしはスキップを検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  Minutes,
  WorkDay,
  Yen,
} from "@dgloss-kintai/contracts";
import { runMonthlyClosingForPeriod } from "./runMonthlyClosingForPeriod.js";
import {
  InMemoryEmployeeRepository,
  InMemoryMonthlyClosingRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(id: string, code: string): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: code,
    name: `従業員 ${code}`,
    email: null,
    hiredOn: "2020-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: asYen(300_000),
      annualScheduledWorkingHours: 1900,
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

function workDay(
  employeeId: string,
  date: string,
  overtimeMin = 0,
): WorkDay {
  return {
    id: `wd_${employeeId}_${date}` as WorkDay["id"],
    employeeId: employeeId as EmployeeId,
    date: date as WorkDay["date"],
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: (480 + overtimeMin) as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: overtimeMin,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  };
}

describe("runMonthlyClosingForPeriod", () => {
  it("勤怠から締めを算出・保存し、その後 findByEmployeeAndPeriod で読める", async () => {
    const closings = new InMemoryMonthlyClosingRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("emp_1", "0001")]),
      workDays: new InMemoryWorkDayRepository([
        workDay("emp_1", "2026-07-01", 120),
        workDay("emp_1", "2026-07-02", 0),
      ]),
      closings,
    };
    const result = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedCount).toBe(1);

    const saved = await closings.findByEmployeeAndPeriod("emp_1" as EmployeeId, {
      year: 2026,
      month: 7,
    });
    expect(saved).not.toBeNull();
    expect(saved?.status).toBe("closed");
    expect(saved?.premium.total).toBeGreaterThan(0);
  });

  it("勤怠が無い従業員はスキップする（空締めを作らない）", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([
        employee("emp_1", "0001"),
        employee("emp_2", "0002"),
      ]),
      workDays: new InMemoryWorkDayRepository([
        workDay("emp_1", "2026-07-01", 0),
      ]),
      closings: new InMemoryMonthlyClosingRepository(),
    };
    const result = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedCount).toBe(1);
    expect(result.value.skippedCount).toBe(1);
  });

  it("employeeId 指定でその1名だけ締める", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([
        employee("emp_1", "0001"),
        employee("emp_2", "0002"),
      ]),
      workDays: new InMemoryWorkDayRepository([
        workDay("emp_1", "2026-07-01", 0),
        workDay("emp_2", "2026-07-01", 0),
      ]),
      closings: new InMemoryMonthlyClosingRepository(),
    };
    const result = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 7 }, employeeId: "emp_2" },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closedCount).toBe(1);
    expect(result.value.closings[0]?.employeeId).toBe("emp_2");
  });

  it("再実行は冪等（上書き）で件数が増えない", async () => {
    const closings = new InMemoryMonthlyClosingRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("emp_1", "0001")]),
      workDays: new InMemoryWorkDayRepository([workDay("emp_1", "2026-07-01", 0)]),
      closings,
    };
    await runMonthlyClosingForPeriod({ period: { year: 2026, month: 7 } }, deps);
    const again = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.value.closedCount).toBe(1);
  });

  it("存在しない従業員指定は not_found", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([]),
      workDays: new InMemoryWorkDayRepository([]),
      closings: new InMemoryMonthlyClosingRepository(),
    };
    const result = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 7 }, employeeId: "missing" },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_found");
  });

  it("不正な年月は validation エラー", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([]),
      workDays: new InMemoryWorkDayRepository([]),
      closings: new InMemoryMonthlyClosingRepository(),
    };
    const result = await runMonthlyClosingForPeriod(
      { period: { year: 2026, month: 13 } },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
