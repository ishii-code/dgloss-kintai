import { describe, it, expect } from "vitest";
import { classifyDailyWork, DAILY_STATUTORY_MINUTES } from "./classify.js";
import type { LaborInterval } from "./classify.js";

/**
 * 1 日分の区分判定をテストする。時刻は 00:00 からの絶対分。
 * 就業規則第48-51条・賃金規程第20条に基づく手計算値で検証する。
 */

const iv = (startHour: number, endHour: number): LaborInterval => ({
  startMinute: startHour * 60,
  endMinute: endHour * 60,
});

describe("classifyDailyWork — 定数", () => {
  it("日 8h の法定労働時間は 480 分", () => {
    expect(DAILY_STATUTORY_MINUTES).toBe(480);
  });
});

describe("classifyDailyWork — 所定労働日の時間外分割（第48条）", () => {
  it("所定 8h・実 10h → 法定外 120 分、法定内残業 0", () => {
    // 9:00-20:00 で 1h 休憩控除 → 実 10h。ここでは休憩控除後の区間を直接渡す。
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(9, 19)], // 10h
      scheduledWorkMinutes: 480,
    });
    expect(result.statutoryOvertimeMinutes).toBe(120);
    expect(result.nonStatutoryOvertimeMinutes).toBe(0);
    expect(result.legalHolidayMinutes).toBe(0);
    expect(result.scheduledHolidayMinutes).toBe(0);
  });

  it("短日：所定 6h・実 7.5h → 法定内残業 90 分、法定外 0", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [{ startMinute: 9 * 60, endMinute: 9 * 60 + 450 }], // 7.5h = 450min
      scheduledWorkMinutes: 360, // 6h
    });
    expect(result.nonStatutoryOvertimeMinutes).toBe(90);
    expect(result.statutoryOvertimeMinutes).toBe(0);
  });

  it("所定 8h・実 8h ちょうど → 時間外なし（境界）", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(9, 17)], // 8h
      scheduledWorkMinutes: 480,
    });
    expect(result.nonStatutoryOvertimeMinutes).toBe(0);
    expect(result.statutoryOvertimeMinutes).toBe(0);
  });

  it("所定 6h・実 10h → 法定内残業 120 分（6→8h）＋法定外 120 分（8h 超）", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(9, 19)], // 10h
      scheduledWorkMinutes: 360, // 6h
    });
    expect(result.nonStatutoryOvertimeMinutes).toBe(120);
    expect(result.statutoryOvertimeMinutes).toBe(120);
  });

  it("実労働が所定未満（実 4h・所定 8h）→ 時間外なし（不就労は別レイヤーの控除対象）", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(9, 13)], // 4h
      scheduledWorkMinutes: 480,
    });
    expect(result.nonStatutoryOvertimeMinutes).toBe(0);
    expect(result.statutoryOvertimeMinutes).toBe(0);
  });

  it("複数区間（午前・午後を分割）の合計で判定する", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(9, 12), iv(13, 20)], // 3h + 7h = 10h
      scheduledWorkMinutes: 480,
    });
    expect(result.statutoryOvertimeMinutes).toBe(120);
  });
});

describe("classifyDailyWork — 深夜の加算とスタック", () => {
  it("21:00-24:00 勤務 → 深夜 120 分（他区分と重複加算）", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [iv(21, 24)], // 3h
      scheduledWorkMinutes: 480,
    });
    expect(result.nightMinutes).toBe(120);
  });

  it("深夜と法定外がスタックする（16:00-翌2:00＝10h、うち深夜 22-翌2 の 4h）", () => {
    // 16:00-翌2:00 = [960, 1560], 10h → 法定外 120 分
    // 深夜 22:00-24:00(120) + 0:00-2:00(120) = 240 分
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [{ startMinute: 16 * 60, endMinute: 26 * 60 }],
      scheduledWorkMinutes: 480,
    });
    expect(result.statutoryOvertimeMinutes).toBe(120);
    expect(result.nightMinutes).toBe(240);
  });
});

describe("classifyDailyWork — 休日ルーティング（第51条）", () => {
  it("法定休日：全労働を legalHolidayMinutes へ（時間外分割しない）", () => {
    const result = classifyDailyWork({
      dayType: "legal_holiday",
      intervals: [iv(9, 21)], // 12h
    });
    expect(result.legalHolidayMinutes).toBe(720);
    expect(result.statutoryOvertimeMinutes).toBe(0);
    expect(result.nonStatutoryOvertimeMinutes).toBe(0);
    expect(result.scheduledHolidayMinutes).toBe(0);
  });

  it("法定休日でも深夜は別途加算する（22:00-翌2:00）", () => {
    const result = classifyDailyWork({
      dayType: "legal_holiday",
      intervals: [{ startMinute: 22 * 60, endMinute: 26 * 60 }], // 4h
    });
    expect(result.legalHolidayMinutes).toBe(240);
    expect(result.nightMinutes).toBe(240);
  });

  it("所定休日：全労働を scheduledHolidayMinutes へ（時間外分割しない）", () => {
    const result = classifyDailyWork({
      dayType: "scheduled_holiday",
      intervals: [iv(9, 21)], // 12h
    });
    expect(result.scheduledHolidayMinutes).toBe(720);
    expect(result.statutoryOvertimeMinutes).toBe(0);
    expect(result.legalHolidayMinutes).toBe(0);
  });
});

describe("classifyDailyWork — 入力バリデーション", () => {
  it("非整数の区間は例外", () => {
    expect(() =>
      classifyDailyWork({
        dayType: "workday",
        intervals: [{ startMinute: 540, endMinute: 600.5 }],
        scheduledWorkMinutes: 480,
      }),
    ).toThrow(RangeError);
  });

  it("負の区間は例外", () => {
    expect(() =>
      classifyDailyWork({
        dayType: "workday",
        intervals: [{ startMinute: -1, endMinute: 60 }],
        scheduledWorkMinutes: 480,
      }),
    ).toThrow(RangeError);
  });

  it("end <= start の区間は例外", () => {
    expect(() =>
      classifyDailyWork({
        dayType: "workday",
        intervals: [{ startMinute: 600, endMinute: 600 }],
        scheduledWorkMinutes: 480,
      }),
    ).toThrow(RangeError);
  });

  it("重なる区間は例外（二重計上防止）", () => {
    expect(() =>
      classifyDailyWork({
        dayType: "workday",
        intervals: [iv(9, 13), iv(12, 18)],
        scheduledWorkMinutes: 480,
      }),
    ).toThrow(RangeError);
  });

  it("所定労働時間が非整数なら例外", () => {
    expect(() =>
      classifyDailyWork({
        dayType: "workday",
        intervals: [iv(9, 17)],
        scheduledWorkMinutes: 480.5,
      }),
    ).toThrow(RangeError);
  });

  it("労働区間が空でも 0 で確定する（欠勤・休日出勤なし）", () => {
    const result = classifyDailyWork({
      dayType: "workday",
      intervals: [],
      scheduledWorkMinutes: 480,
    });
    expect(result).toEqual({
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    });
  });
});
