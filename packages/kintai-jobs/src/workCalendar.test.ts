/**
 * resolveDayType / weekdayOf のテスト（勤務カレンダー）。
 */

import { describe, expect, it } from "vitest";
import type { WorkCalendar } from "@dgloss-kintai/contracts";
import { DEFAULT_WORK_CALENDAR } from "@dgloss-kintai/contracts";
import { resolveDayType, weekdayOf } from "./workCalendar.js";

describe("weekdayOf", () => {
  it("曜日を返す（2026-07-01 は水曜=3）", () => {
    expect(weekdayOf("2026-07-01")).toBe(3);
    expect(weekdayOf("2026-07-04")).toBe(6); // 土
    expect(weekdayOf("2026-07-05")).toBe(0); // 日
  });
});

describe("resolveDayType（既定=日曜法定・土曜所定）", () => {
  it("平日は workday", () => {
    expect(resolveDayType("2026-07-01")).toBe("workday");
  });
  it("日曜は法定休日", () => {
    expect(resolveDayType("2026-07-05")).toBe("legal_holiday");
  });
  it("土曜は所定休日", () => {
    expect(resolveDayType("2026-07-04")).toBe("scheduled_holiday");
  });
});

describe("resolveDayType（会社カレンダー上書き）", () => {
  const cal: WorkCalendar = {
    legalHolidayWeekday: 0,
    scheduledHolidayWeekdays: [6],
    customHolidays: ["2026-07-01"], // 平日を会社休日に
    updatedAt: DEFAULT_WORK_CALENDAR.updatedAt,
  };
  it("個別の会社休日は所定休日として扱う", () => {
    expect(resolveDayType("2026-07-01", cal)).toBe("scheduled_holiday");
  });
  it("法定休日の曜日が所定休日にも含まれる場合は法定を優先", () => {
    const c: WorkCalendar = { ...cal, scheduledHolidayWeekdays: [0, 6] };
    expect(resolveDayType("2026-07-05", c)).toBe("legal_holiday");
  });
});
