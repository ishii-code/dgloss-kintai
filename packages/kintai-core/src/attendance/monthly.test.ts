import { describe, it, expect } from "vitest";
import { aggregateMonthly } from "./monthly.js";
import { classifyDailyWork } from "./classify.js";
import { applyWeeklyOvertime } from "./weekly.js";
import { calculateWagePremium } from "../premium.js";
import type { ClassifiedWorkMinutes } from "../types.js";
import type { DailyWorkInput } from "./classify.js";

/**
 * 月次集計と、割増計算エンジンへの受け渡し（結合）をテストする。
 */

describe("aggregateMonthly — 合算", () => {
  it("複数日の区分別労働時間を単純加算する（深夜も加算）", () => {
    const days: ClassifiedWorkMinutes[] = [
      {
        nonStatutoryOvertimeMinutes: 30,
        statutoryOvertimeMinutes: 120,
        legalHolidayMinutes: 0,
        scheduledHolidayMinutes: 0,
        nightMinutes: 60,
      },
      {
        nonStatutoryOvertimeMinutes: 0,
        statutoryOvertimeMinutes: 60,
        legalHolidayMinutes: 480,
        scheduledHolidayMinutes: 240,
        nightMinutes: 120,
      },
    ];
    expect(aggregateMonthly(days)).toEqual({
      nonStatutoryOvertimeMinutes: 30,
      statutoryOvertimeMinutes: 180,
      legalHolidayMinutes: 480,
      scheduledHolidayMinutes: 240,
      nightMinutes: 180,
    });
  });

  it("空配列はすべて 0", () => {
    expect(aggregateMonthly([])).toEqual({
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    });
  });

  it("非整数が混入したら例外", () => {
    expect(() =>
      aggregateMonthly([
        {
          nonStatutoryOvertimeMinutes: 1.5,
          statutoryOvertimeMinutes: 0,
          legalHolidayMinutes: 0,
          scheduledHolidayMinutes: 0,
          nightMinutes: 0,
        },
      ]),
    ).toThrow(RangeError);
  });
});

describe("結合 — classify → weekly → monthly → premium", () => {
  it("週 40h 振替後の月間集計を割増エンジンにそのまま渡せる", () => {
    // 1 週: 平日 8h×5 + 所定外土曜 4h → 土曜 4h が法定外 240 分。
    const week: DailyWorkInput[] = [
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 480 }],
        scheduledWorkMinutes: 480,
      },
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 480 }],
        scheduledWorkMinutes: 480,
      },
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 480 }],
        scheduledWorkMinutes: 480,
      },
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 480 }],
        scheduledWorkMinutes: 480,
      },
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 480 }],
        scheduledWorkMinutes: 480,
      },
      {
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 540 + 240 }],
        scheduledWorkMinutes: 0,
      },
    ];
    const monthly = aggregateMonthly(applyWeeklyOvertime(week));
    expect(monthly.statutoryOvertimeMinutes).toBe(240);

    // 割増エンジンに渡して算定できることを確認（第20条: ceil(W × 6 / 19)）。
    // 法定外 240 分: W = 125bp × 240 = 30000 → ceil(180000 / 19) = ceil(9473.68) = 9474
    const premium = calculateWagePremium(
      { basicSalary: 300_000, isManagerialEmployee: false },
      monthly,
      { annualScheduledWorkingHours: 1900 },
    );
    expect(premium.overtimeAllowance).toBe(9_474);
  });

  it("単日の classifyDailyWork も月次集計に渡せる（週を跨がない休日出勤）", () => {
    const holiday = classifyDailyWork({
      dayType: "legal_holiday",
      intervals: [{ startMinute: 9 * 60, endMinute: 17 * 60 }], // 8h
    });
    const monthly = aggregateMonthly([holiday]);
    expect(monthly.legalHolidayMinutes).toBe(480);
  });
});
