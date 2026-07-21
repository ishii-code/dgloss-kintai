import { describe, it, expect } from "vitest";
import { applyWeeklyOvertime, WEEKLY_STATUTORY_MINUTES } from "./weekly.js";
import type { DailyWorkInput } from "./classify.js";

/**
 * 週 40h ルール（賃金規程第18-19条）をテストする。
 * 週は日曜起算でグルーピング済みの配列を渡す前提。
 */

/** 所定 8h の労働日を作る（9:00 から hours 時間、休憩控除後）。 */
const workday = (hours: number, scheduled = 480): DailyWorkInput => ({
  dayType: "workday",
  intervals: [{ startMinute: 9 * 60, endMinute: 9 * 60 + hours * 60 }],
  scheduledWorkMinutes: scheduled,
});

/** 所定外の出勤日（その日の所定 0h、実 hours 時間 → 全て法定内残業になりうる）。 */
const extraWorkday = (hours: number): DailyWorkInput => ({
  dayType: "workday",
  intervals: [{ startMinute: 9 * 60, endMinute: 9 * 60 + hours * 60 }],
  scheduledWorkMinutes: 0,
});

const scheduledHoliday = (hours: number): DailyWorkInput => ({
  dayType: "scheduled_holiday",
  intervals: [{ startMinute: 9 * 60, endMinute: 9 * 60 + hours * 60 }],
});

const legalHoliday = (hours: number): DailyWorkInput => ({
  dayType: "legal_holiday",
  intervals: [{ startMinute: 9 * 60, endMinute: 9 * 60 + hours * 60 }],
});

const sumStatutory = (rs: { statutoryOvertimeMinutes: number }[]): number =>
  rs.reduce((a, r) => a + r.statutoryOvertimeMinutes, 0);

describe("applyWeeklyOvertime — 定数", () => {
  it("週 40h は 2400 分", () => {
    expect(WEEKLY_STATUTORY_MINUTES).toBe(2400);
  });
});

describe("applyWeeklyOvertime — 週 40h 超の振替", () => {
  it("平日 8h×5（=40h）＋所定外の土曜 4h → 土曜 4h が法定外に振替（日次 8h 以内でも）", () => {
    // Sun 休 / Mon-Fri 8h / Sat 所定外 4h
    const week: DailyWorkInput[] = [
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      extraWorkday(4), // 土曜: 法定内残業 240 分
    ];
    const results = applyWeeklyOvertime(week);
    // 週 straight = 40h + 4h = 44h → 超過 4h(240) が法定外へ
    const saturday = results[5];
    expect(saturday?.statutoryOvertimeMinutes).toBe(240);
    expect(saturday?.nonStatutoryOvertimeMinutes).toBe(0);
    expect(sumStatutory(results)).toBe(240);
  });

  it("土曜が所定休日 4h の場合も週 40h 超で法定外へ振替（scheduledHoliday→statutory）", () => {
    const week: DailyWorkInput[] = [
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      scheduledHoliday(4),
    ];
    const results = applyWeeklyOvertime(week);
    const saturday = results[5];
    expect(saturday?.statutoryOvertimeMinutes).toBe(240);
    expect(saturday?.scheduledHolidayMinutes).toBe(0);
  });

  it("週 40h ちょうどは振替なし（境界）", () => {
    const week: DailyWorkInput[] = [
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
    ];
    const results = applyWeeklyOvertime(week);
    expect(sumStatutory(results)).toBe(0);
    expect(results.every((r) => r.nonStatutoryOvertimeMinutes === 0)).toBe(true);
  });

  it("週合計が 40h 未満なら土曜出勤も所定休日のまま（振替なし）", () => {
    // Mon-Fri 7h(=35h) + 所定休日 4h = 39h < 40h
    const week: DailyWorkInput[] = [
      workday(7),
      workday(7),
      workday(7),
      workday(7),
      workday(7),
      scheduledHoliday(4),
    ];
    const results = applyWeeklyOvertime(week);
    expect(sumStatutory(results)).toBe(0);
    expect(results[5]?.scheduledHolidayMinutes).toBe(240);
  });
});

describe("applyWeeklyOvertime — 二重計上の回避", () => {
  it("日次で既に法定外計上済みの分は週 40h に二重計上しない", () => {
    // Mon 10h（日次法定外 120）+ Tue-Fri 8h。実労働 44h だが straight は 40h ちょうど。
    const week: DailyWorkInput[] = [
      workday(10),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
    ];
    const results = applyWeeklyOvertime(week);
    // 月曜の日次法定外 120 のみ。週 40h からの追加振替は 0。
    expect(sumStatutory(results)).toBe(120);
    expect(results[0]?.statutoryOvertimeMinutes).toBe(120);
  });

  it("法定休日労働は週 40h の算定に含めない（40h 超でも振替を誘発しない）", () => {
    // Mon-Fri 8h(=40h) + 日曜=法定休日 4h
    const week: DailyWorkInput[] = [
      legalHoliday(4),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
      workday(8),
    ];
    const results = applyWeeklyOvertime(week);
    // 法定休日 4h は legalHoliday のまま、週 40h 由来の法定外は 0。
    expect(results[0]?.legalHolidayMinutes).toBe(240);
    expect(sumStatutory(results)).toBe(0);
  });
});

describe("applyWeeklyOvertime — 安全側（取りこぼし防止）", () => {
  it("所定外の 6 連勤 7h（=42h、全て法定内残業）→ 超過 2h が法定外に", () => {
    const week: DailyWorkInput[] = [
      extraWorkday(7),
      extraWorkday(7),
      extraWorkday(7),
      extraWorkday(7),
      extraWorkday(7),
      extraWorkday(7),
    ];
    const results = applyWeeklyOvertime(week);
    // 週 straight = 42h → 超過 120 分を法定外へ（法定内残業から振替）。
    expect(sumStatutory(results)).toBe(120);
    const totalNonStatutory = results.reduce(
      (a, r) => a + r.nonStatutoryOvertimeMinutes,
      0,
    );
    // 42h(2520) の法定内残業のうち 120 が法定外へ移り、残り 2400。
    expect(totalNonStatutory).toBe(2520 - 120);
  });

  it('weekStart が "sunday" 以外なら例外', () => {
    expect(() =>
      // @ts-expect-error 対応外の週起算日
      applyWeeklyOvertime([workday(8)], { weekStart: "monday" }),
    ).toThrow(RangeError);
  });
});
