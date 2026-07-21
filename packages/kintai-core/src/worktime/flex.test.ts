import { describe, it, expect } from "vitest";
import {
  settleFlexPeriod,
  legalTotalFrameMinutes,
  scheduledTotalMinutes,
} from "./flex.js";

/**
 * フレックスタイム制の清算（就業規則第48条）を、就業規則から手計算した期待値で検証する。
 *
 * 基準となる 2 つの枠（清算期間 31 日・所定休日 8 日・標準 8h の例）:
 *   所定総労働時間 S = (31 − 8) × 480 = 11040 分（184h）
 *   法定総枠       F = floor(31 × 2400 ÷ 7) = floor(74400/7) = floor(10628.571) = 10628 分
 * F < S のアグレッシブな配置のため、この構成では法定内残業は発生せず、超過はすべて法定外。
 */

const at = (h: number, m = 0): number => h * 60 + m;

describe("legalTotalFrameMinutes — 法定総枠 F（分未満切り捨て）", () => {
  it("31 日 → floor(74400/7) = 10628 分", () => {
    expect(legalTotalFrameMinutes(31)).toBe(10628);
  });
  it("30 日 → floor(72000/7) = 10285 分", () => {
    expect(legalTotalFrameMinutes(30)).toBe(10285);
  });
  it("7 日（割り切れる） → 2400 分（40h）", () => {
    expect(legalTotalFrameMinutes(7)).toBe(2400);
  });
  it("28 日（割り切れる） → 9600 分（160h）", () => {
    expect(legalTotalFrameMinutes(28)).toBe(9600);
  });
});

describe("scheduledTotalMinutes — 所定総労働時間 S", () => {
  it("31 日・所定休日 8 → 23 × 480 = 11040 分（184h）", () => {
    expect(scheduledTotalMinutes(31, 8)).toBe(11040);
  });
  it("30 日・所定休日 10 → 20 × 480 = 9600 分（160h）", () => {
    expect(scheduledTotalMinutes(30, 10)).toBe(9600);
  });
  it("標準日時間の上書き（7h=420）が反映される", () => {
    expect(scheduledTotalMinutes(31, 8, 420)).toBe(23 * 420);
  });
  it("所定休日数 > 暦日数 は RangeError", () => {
    expect(() => scheduledTotalMinutes(30, 31)).toThrow(RangeError);
  });
});

describe("settleFlexPeriod — 清算期間 31 日・所定休日 8（S=11040, F=10628）", () => {
  const base = {
    calendarDays: 31,
    scheduledHolidayCount: 8,
  } as const;

  it("実労働が法定総枠未満（W=10000）→ 時間外なし", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 10000 });
    expect(r.statutoryOvertimeMinutes).toBe(0);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
    expect(r.nightMinutes).toBe(0);
  });

  it("法定総枠ちょうど（W=10628）→ 時間外なし（境界）", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 10628 });
    expect(r.statutoryOvertimeMinutes).toBe(0);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
  });

  it("所定超だが F 超（W=10700）→ 法定外 72 分のみ（F<S のため法定内残業は 0）", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 10700 });
    // 10700 − 10628 = 72
    expect(r.statutoryOvertimeMinutes).toBe(72);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
  });

  it("法定枠超過（W=11500）→ 法定外 872 分（11500−10628）", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 11500 });
    expect(r.statutoryOvertimeMinutes).toBe(872);
    expect(r.nonStatutoryOvertimeMinutes).toBe(0);
  });
});

describe("settleFlexPeriod — 法定内残業が発生する構成（30 日・所定休日 10, S=9600, F=10285）", () => {
  const base = {
    calendarDays: 30,
    scheduledHolidayCount: 10,
  } as const;

  it("所定超・法定枠内（W=10000）→ 法定内残業 400 分（10000−9600）、法定外 0", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 10000 });
    expect(r.nonStatutoryOvertimeMinutes).toBe(400);
    expect(r.statutoryOvertimeMinutes).toBe(0);
  });

  it("法定枠超（W=10400）→ 法定内残業 685（10285−9600）＋法定外 115（10400−10285）", () => {
    const r = settleFlexPeriod({ ...base, actualWorkedMinutes: 10400 });
    expect(r.nonStatutoryOvertimeMinutes).toBe(685);
    expect(r.statutoryOvertimeMinutes).toBe(115);
  });
});

describe("settleFlexPeriod — 深夜と休日区分", () => {
  it("日ごとの労働区間から深夜(22:00-5:00)を合算する", () => {
    const r = settleFlexPeriod({
      calendarDays: 31,
      scheduledHolidayCount: 8,
      actualWorkedMinutes: 10700,
      dailyIntervals: [
        [{ startMinute: at(9), endMinute: at(18) }], // 深夜 0
        [{ startMinute: at(22), endMinute: at(30) }], // 22:00-翌6:00 → 深夜 420
        [{ startMinute: at(0), endMinute: at(5) }], // 0:00-5:00 → 深夜 300
      ],
    });
    expect(r.nightMinutes).toBe(420 + 300);
    // 実労働 W と独立に時間外も算定される。
    expect(r.statutoryOvertimeMinutes).toBe(72);
  });

  it("法定/所定休日労働は清算枠外としてそのまま計上（passthrough）", () => {
    const r = settleFlexPeriod({
      calendarDays: 31,
      scheduledHolidayCount: 8,
      actualWorkedMinutes: 10000,
      legalHolidayMinutes: 480,
      scheduledHolidayMinutes: 300,
    });
    expect(r.legalHolidayMinutes).toBe(480);
    expect(r.scheduledHolidayMinutes).toBe(300);
  });
});

describe("settleFlexPeriod — 入力バリデーション", () => {
  it("実労働合計が負なら RangeError", () => {
    expect(() =>
      settleFlexPeriod({
        calendarDays: 31,
        scheduledHolidayCount: 8,
        actualWorkedMinutes: -1,
      }),
    ).toThrow(RangeError);
  });

  it("非整数の実労働合計は RangeError", () => {
    expect(() =>
      settleFlexPeriod({
        calendarDays: 31,
        scheduledHolidayCount: 8,
        actualWorkedMinutes: 100.5,
      }),
    ).toThrow(RangeError);
  });

  it("労働区間の end <= start は RangeError", () => {
    expect(() =>
      settleFlexPeriod({
        calendarDays: 31,
        scheduledHolidayCount: 8,
        actualWorkedMinutes: 10000,
        dailyIntervals: [[{ startMinute: at(10), endMinute: at(10) }]],
      }),
    ).toThrow(RangeError);
  });
});
