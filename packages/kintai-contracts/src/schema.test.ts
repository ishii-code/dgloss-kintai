import { describe, it, expect } from "vitest";
import {
  stampInputSchema,
  classifiedWorkMinutesSchema,
  yearMonthSchema,
} from "./schema.js";

describe("stampInputSchema", () => {
  it("正しい打刻入力を通す", () => {
    const parsed = stampInputSchema.parse({
      employeeId: "emp_001",
      type: "clock_in",
      stampedAt: "2025-07-01T09:00:00+09:00",
      source: "ic_card",
    });
    expect(parsed.type).toBe("clock_in");
  });

  it("未知の打刻種別を弾く", () => {
    expect(() =>
      stampInputSchema.parse({
        employeeId: "emp_001",
        type: "teleport",
        stampedAt: "2025-07-01T09:00:00+09:00",
        source: "ic_card",
      }),
    ).toThrow();
  });

  it("タイムゾーンなしのタイムスタンプを弾く", () => {
    expect(() =>
      stampInputSchema.parse({
        employeeId: "emp_001",
        type: "clock_in",
        stampedAt: "2025-07-01T09:00:00",
        source: "ic_card",
      }),
    ).toThrow();
  });
});

describe("classifiedWorkMinutesSchema", () => {
  it("負の労働時間を弾く", () => {
    expect(() =>
      classifiedWorkMinutesSchema.parse({
        nonStatutoryOvertimeMinutes: 0,
        statutoryOvertimeMinutes: -1,
        legalHolidayMinutes: 0,
        scheduledHolidayMinutes: 0,
        nightMinutes: 0,
      }),
    ).toThrow();
  });
});

describe("yearMonthSchema", () => {
  it("13月を弾く", () => {
    expect(() => yearMonthSchema.parse({ year: 2025, month: 13 })).toThrow();
  });
});
