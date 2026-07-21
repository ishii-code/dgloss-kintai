import { describe, it, expect } from "vitest";
import {
  summarizeMonthlyAttendance,
  selectWorkDaysForPeriod,
} from "./summarize.js";
import { makeWorkDay } from "./testFixtures.js";
import type { YearMonth } from "@dgloss-kintai/contracts";

const period: YearMonth = { year: 2025, month: 7 };

describe("selectWorkDaysForPeriod", () => {
  it("当該従業員・当該期間の WorkDay だけを残す", () => {
    const days = [
      makeWorkDay("E1", "2025-07-01"),
      makeWorkDay("E1", "2025-07-31"),
      makeWorkDay("E1", "2025-08-01"), // 期間外
      makeWorkDay("E1", "2025-06-30"), // 期間外
      makeWorkDay("E2", "2025-07-10"), // 他従業員
    ];
    const scoped = selectWorkDaysForPeriod(days, "E1", period);
    expect(scoped.map((d) => d.date)).toEqual(["2025-07-01", "2025-07-31"]);
  });
});

describe("summarizeMonthlyAttendance", () => {
  it("区分別・総労働・不就労を月間合算する", () => {
    const days = [
      makeWorkDay("E1", "2025-07-01", {
        actualWorkedMinutes: 480,
        absenceMinutes: 30,
        classified: { statutoryOvertimeMinutes: 60, nightMinutes: 20 },
      }),
      makeWorkDay("E1", "2025-07-02", {
        actualWorkedMinutes: 500,
        absenceMinutes: 15,
        classified: {
          statutoryOvertimeMinutes: 90,
          legalHolidayMinutes: 100,
          nightMinutes: 10,
        },
      }),
    ];
    const s = summarizeMonthlyAttendance(days);
    expect(s.totalWorkedMinutes).toBe(980);
    expect(s.totalAbsenceMinutes).toBe(45);
    expect(s.workDayCount).toBe(2);
    expect(s.classified).toEqual({
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 150,
      legalHolidayMinutes: 100,
      scheduledHolidayMinutes: 0,
      nightMinutes: 30,
    });
  });

  it("労働ゼロ月（WorkDay なし）はゼロ値を返す", () => {
    const s = summarizeMonthlyAttendance([]);
    expect(s.totalWorkedMinutes).toBe(0);
    expect(s.totalAbsenceMinutes).toBe(0);
    expect(s.workDayCount).toBe(0);
    expect(s.classified).toEqual({
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    });
  });

  it("負の分は zod 検証で弾く", () => {
    const bad = makeWorkDay("E1", "2025-07-01", {
      classified: { nightMinutes: -1 },
    });
    expect(() => summarizeMonthlyAttendance([bad])).toThrow();
  });
});
