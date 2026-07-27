/**
 * 勤務カレンダーの取得・更新ユースケース、および buildDailyAttendance への反映テスト。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  IsoDateTime,
  Stamp,
  StampType,
  Yen,
} from "@dgloss-kintai/contracts";
import { getWorkCalendar, updateWorkCalendar } from "./workCalendar.js";
import { buildDailyAttendance } from "./buildDailyAttendance.js";
import {
  FixedClock,
  InMemoryEmployeeRepository,
  InMemoryStampRepository,
  InMemoryWorkCalendarRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";

const clock = new FixedClock("2026-07-27T10:00:00+09:00" as IsoDateTime);
const asYen = (n: number): Yen => n as Yen;

describe("getWorkCalendar / updateWorkCalendar", () => {
  it("未保存なら既定（日曜法定・土曜所定）", async () => {
    const result = await getWorkCalendar({
      calendar: new InMemoryWorkCalendarRepository(),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.legalHolidayWeekday).toBe(0);
    expect(result.value.scheduledHolidayWeekdays).toEqual([6]);
  });

  it("更新すると重複除去・昇順で保存される", async () => {
    const repo = new InMemoryWorkCalendarRepository();
    const updated = await updateWorkCalendar(
      {
        legalHolidayWeekday: 0,
        scheduledHolidayWeekdays: [6, 6, 3],
        customHolidays: ["2026-08-11", "2026-01-01", "2026-01-01"],
      },
      { calendar: repo, clock },
    );
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.value.scheduledHolidayWeekdays).toEqual([3, 6]);
    expect(updated.value.customHolidays).toEqual(["2026-01-01", "2026-08-11"]);
  });

  it("不正な曜日は validation エラー", async () => {
    const result = await updateWorkCalendar(
      {
        legalHolidayWeekday: 9,
        scheduledHolidayWeekdays: [],
        customHolidays: [],
      },
      { calendar: new InMemoryWorkCalendarRepository(), clock },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });
});

function employee(): Employee {
  return {
    id: "emp_1" as EmployeeId,
    employeeCode: "0001",
    name: "テスト",
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
function stamp(type: StampType, iso: string): Stamp {
  seq += 1;
  return {
    id: `st_${seq}` as Stamp["id"],
    employeeId: "emp_1" as EmployeeId,
    type,
    stampedAt: iso as Stamp["stampedAt"],
    source: "manual",
    note: null,
  };
}

describe("buildDailyAttendance × 勤務カレンダー", () => {
  it("会社休日カレンダーを反映し、平日出勤を所定休日労働にする", async () => {
    const calendar = new InMemoryWorkCalendarRepository();
    await updateWorkCalendar(
      {
        legalHolidayWeekday: 0,
        scheduledHolidayWeekdays: [6],
        customHolidays: ["2026-07-01"], // 水曜を会社休日に
      },
      { calendar, clock },
    );
    const workDays = new InMemoryWorkDayRepository();
    const deps = {
      employees: new InMemoryEmployeeRepository([employee()]),
      stamps: new InMemoryStampRepository([
        stamp("clock_in", "2026-07-01T09:00:00+09:00"),
        stamp("clock_out", "2026-07-01T17:00:00+09:00"),
      ]),
      workDays,
      calendar,
    };
    const result = await buildDailyAttendance(
      { period: { year: 2026, month: 7 } },
      deps,
    );
    expect(result.ok).toBe(true);

    const saved = await workDays.listByEmployeeAndDateRange(
      "emp_1" as EmployeeId,
      "2026-07-01" as never,
      "2026-07-31" as never,
    );
    expect(saved[0]?.dayType).toBe("scheduled_holiday");
    expect(saved[0]?.classified.scheduledHolidayMinutes).toBe(480);
  });
});
