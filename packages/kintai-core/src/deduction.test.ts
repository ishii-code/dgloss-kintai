import { describe, it, expect } from "vitest";
import { calculateLatenessDeduction } from "./deduction.js";
import type { WagePremiumConfig } from "./config.js";

/**
 * 賃金規程第21条 遅刻・早退・私用外出等の控除をテストする。
 *   控除額 = 基本給 ÷ 月間平均所定労働時間 × 控除分, 端数切り捨て（第21条2項）。
 * 基準: 基本給 300,000 / 年間所定 1,900h。
 */

const CONFIG: WagePremiumConfig = { annualScheduledWorkingHours: 1900 };
const profile = { basicSalary: 300_000 };

describe("calculateLatenessDeduction — 第21条", () => {
  it("遅刻 1.5h（90分）を控除し、端数は切り捨てる", () => {
    // 300000 × 12 × 90 / 114000 = 324,000,000 / 114,000 = 2842.10 → floor 2842
    expect(calculateLatenessDeduction(profile, 90, CONFIG)).toBe(2_842);
  });

  it("端数は切り上げず必ず切り捨てる（割増の切り上げと逆方向）", () => {
    // 1 分: 300000 × 12 / 114000 = 31.578 → floor 31
    expect(calculateLatenessDeduction(profile, 1, CONFIG)).toBe(31);
  });

  it("控除時間 0 なら 0 円", () => {
    expect(calculateLatenessDeduction(profile, 0, CONFIG)).toBe(0);
  });

  it("割り切れる場合はそのままの整数額", () => {
    // 基本給 380,000, 60分: 380000 × 12 × 60 / 114000 = 273,600,000/114,000 = 2400
    expect(
      calculateLatenessDeduction({ basicSalary: 380_000 }, 60, CONFIG),
    ).toBe(2_400);
  });

  it("基本給が負なら例外", () => {
    expect(() =>
      calculateLatenessDeduction({ basicSalary: -1 }, 60, CONFIG),
    ).toThrow(RangeError);
  });

  it("控除時間が非整数なら例外", () => {
    expect(() =>
      calculateLatenessDeduction(profile, 1.5, CONFIG),
    ).toThrow(RangeError);
  });

  it("控除時間が負なら例外", () => {
    expect(() =>
      calculateLatenessDeduction(profile, -30, CONFIG),
    ).toThrow(RangeError);
  });
});
