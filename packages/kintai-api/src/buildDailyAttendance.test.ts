/**
 * buildDailyAttendance ユースケースのテスト。
 * 打刻→WorkDay の生成・保存、対象月フィルタ、対象指定、not_found を検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  Stamp,
  StampType,
  Yen,
} from "@dgloss-kintai/contracts";
import { buildDailyAttendance } from "./buildDailyAttendance.js";
import {
  InMemoryEmployeeRepository,
  InMemoryStampRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

function employee(id: string): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: id,
    name: `従業員 ${id}`,
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

let seq = 0;
function stamp(
  employeeId: string,
  type: StampType,
  isoDateTime: string,
): Stamp {
  seq += 1;
  return {
    id: `st_${seq}` as Stamp["id"],
    employeeId: employeeId as EmployeeId,
    type,
    stampedAt: isoDateTime as Stamp["stampedAt"],
    source: "manual",
    note: null,
  };
}

function dayStamps(employeeId: string, date: string): Stamp[] {
  return [
    stamp(employeeId, "clock_in", `${date}T09:00:00+09:00`),
    stamp(employeeId, "clock_out", `${date}T18:00:00+09:00`),
  ];
}

describe("buildDailyAttendance", () => {
  it("打刻から WorkDay を生成・保存し、後続の照会で読める", async () => {
    const workDays = new InMemoryWorkDayRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("E1")]),
      stamps: new InMemoryStampRepository([
        ...dayStamps("E1", "2026-07-01"),
        ...dayStamps("E1", "2026-07-02"),
      ]),
      workDays,
    };
    const result = await buildDailyAttendance(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.builtCount).toBe(2);
    expect(result.value.employeesWithWorkDays).toBe(1);

    const saved = await workDays.listByEmployeeAndDateRange(
      "E1" as EmployeeId,
      "2026-07-01" as never,
      "2026-07-31" as never,
    );
    expect(saved).toHaveLength(2);
    expect(saved[0]?.actualWorkedMinutes).toBe(540); // 9h（休憩打刻なし）
  });

  it("対象月外の打刻は含めない", async () => {
    const workDays = new InMemoryWorkDayRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("E1")]),
      stamps: new InMemoryStampRepository([
        ...dayStamps("E1", "2026-06-30"),
        ...dayStamps("E1", "2026-07-01"),
      ]),
      workDays,
    };
    const result = await buildDailyAttendance(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.builtCount).toBe(1);
  });

  it("再実行は冪等（同一日は上書き・件数が増えない）", async () => {
    const workDays = new InMemoryWorkDayRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee("E1")]),
      stamps: new InMemoryStampRepository(dayStamps("E1", "2026-07-01")),
      workDays,
    };
    await buildDailyAttendance({ period: { year: 2026, month: 7 } }, deps);
    await buildDailyAttendance({ period: { year: 2026, month: 7 } }, deps);
    const saved = await workDays.listByEmployeeAndDateRange(
      "E1" as EmployeeId,
      "2026-07-01" as never,
      "2026-07-31" as never,
    );
    expect(saved).toHaveLength(1);
  });

  it("存在しない従業員指定は not_found", async () => {
    const deps = {
      employees: new InMemoryEmployeeRepository([]),
      stamps: new InMemoryStampRepository(),
      workDays: new InMemoryWorkDayRepository(),
    };
    const result = await buildDailyAttendance(
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
      stamps: new InMemoryStampRepository(),
      workDays: new InMemoryWorkDayRepository(),
    };
    const result = await buildDailyAttendance(
      { period: { year: 2026, month: 0 } },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});
