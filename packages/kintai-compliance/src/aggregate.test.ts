import { describe, it, expect } from "vitest";
import type { ClassifiedWorkMinutes } from "@dgloss-kintai/contracts";
import {
  aggregateMonthlyOvertime,
  overtimePlusHoliday,
} from "./aggregate.js";

/**
 * 区分別労働時間 → 月次時間外・休日労働の集計テスト。
 * 時間外労働＝statutoryOvertimeMinutes（法定内残業・所定休日・深夜は 36協定対象外）。
 * 休日労働＝legalHolidayMinutes。
 */
const day = (
  over: number,
  nonStatutory: number,
  legalHoliday: number,
  scheduledHoliday: number,
  night: number,
): ClassifiedWorkMinutes => ({
  nonStatutoryOvertimeMinutes: nonStatutory,
  statutoryOvertimeMinutes: over,
  legalHolidayMinutes: legalHoliday,
  scheduledHolidayMinutes: scheduledHoliday,
  nightMinutes: night,
});

describe("aggregateMonthlyOvertime", () => {
  it("時間外は statutoryOvertime のみ、休日は legalHoliday のみを合算する", () => {
    // 3 日分。時間外 60+90+30=180 分、法定休日 0+0+120=120 分。
    // 法定内残業(各50)・所定休日(各40)・深夜(各20)は集計に含めない。
    const days = [
      day(60, 50, 0, 40, 20),
      day(90, 50, 0, 40, 20),
      day(30, 50, 120, 40, 20),
    ];
    const result = aggregateMonthlyOvertime({ year: 2025, month: 7 }, days);
    expect(result).toEqual({
      period: { year: 2025, month: 7 },
      overtimeMinutes: 180,
      holidayMinutes: 120,
    });
  });

  it("空配列なら 0 集計", () => {
    expect(aggregateMonthlyOvertime({ year: 2025, month: 8 }, [])).toEqual({
      period: { year: 2025, month: 8 },
      overtimeMinutes: 0,
      holidayMinutes: 0,
    });
  });

  it("不正入力（負の分）は zod で弾く", () => {
    const bad = { ...day(0, 0, 0, 0, 0), statutoryOvertimeMinutes: -1 };
    expect(() =>
      aggregateMonthlyOvertime({ year: 2025, month: 7 }, [bad]),
    ).toThrow();
  });

  it("不正な年月（month 13）は弾く", () => {
    expect(() =>
      aggregateMonthlyOvertime({ year: 2025, month: 13 }, []),
    ).toThrow();
  });
});

describe("overtimePlusHoliday", () => {
  it("時間外＋休日の合計を返す", () => {
    expect(
      overtimePlusHoliday({
        period: { year: 2025, month: 7 },
        overtimeMinutes: 2400,
        holidayMinutes: 600,
      }),
    ).toBe(3000);
  });
});
