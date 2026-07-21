import { describe, it, expect } from "vitest";
import {
  fixedOvertimeAllowanceFromHours,
  NON_REGULAR_FIXED_OVERTIME_HOURS,
} from "./fixedOvertimeHours.js";
import type { WagePremiumConfig } from "./config.js";
import type { EmployeeWageProfile } from "./types.js";

/**
 * 固定時間外勤務手当（非正規社員就業規則 第71条⑥）を時間数から算出するテスト。
 *
 * 基準データ:
 *   基本給            = 300,000 円
 *   年間所定労働時間  = 1,900 時間 → 年間所定分 = 114,000 分
 *   支給率            = 1.25（時給相当 1.00 + 割増 0.25）
 *
 * 固定残業手当 = 基本給 × 12 × 125 × (時間×60) ÷ (年間所定分 × 100) を切り上げ。
 * premium.test.ts と同じ reduce 形: yen = ceil(W × 6 / 19)（W = 125 × 分）で手計算する。
 */

const CONFIG: WagePremiumConfig = { annualScheduledWorkingHours: 1900 };

const profile: EmployeeWageProfile = {
  basicSalary: 300_000,
  isManagerialEmployee: false,
};

describe("fixedOvertimeAllowanceFromHours — 手計算値の検証", () => {
  it("事務職 20時間分は切り上げで 47,369 円", () => {
    // W = 125 × (20×60) = 125 × 1200 = 150,000
    // yen = ceil(150000 × 6 / 19) = ceil(900000 / 19) = ceil(47368.42) = 47369
    expect(
      fixedOvertimeAllowanceFromHours(profile, 20, CONFIG),
    ).toBe(47_369);
  });

  it("その他 40時間分は切り上げで 94,737 円", () => {
    // W = 125 × (40×60) = 125 × 2400 = 300,000
    // yen = ceil(300000 × 6 / 19) = ceil(1800000 / 19) = ceil(94736.84) = 94737
    expect(
      fixedOvertimeAllowanceFromHours(profile, 40, CONFIG),
    ).toBe(94_737);
  });

  it("既定値定数を渡しても同じ結果になる（事務職／その他）", () => {
    expect(
      fixedOvertimeAllowanceFromHours(
        profile,
        NON_REGULAR_FIXED_OVERTIME_HOURS.office,
        CONFIG,
      ),
    ).toBe(47_369);
    expect(
      fixedOvertimeAllowanceFromHours(
        profile,
        NON_REGULAR_FIXED_OVERTIME_HOURS.other,
        CONFIG,
      ),
    ).toBe(94_737);
  });
});

describe("fixedOvertimeAllowanceFromHours — 端数処理（第20条3項5号）", () => {
  it("割り切れないケースは 1 円単位で切り上げる", () => {
    // 300,000 円・20時間分は 47368.42 → 47369（上記と同じ、切り上げが効いている）
    expect(fixedOvertimeAllowanceFromHours(profile, 20, CONFIG)).toBe(47_369);
  });

  it("割り切れるケースは切り上げず整数額そのまま", () => {
    // 基本給 380,000: yen = W × 2/5（4,560,000 / 11,400,000 = 2/5）
    // W = 125 × 1200 = 150,000 → 150000 × 2 / 5 = 60,000（割り切れる）
    expect(
      fixedOvertimeAllowanceFromHours(
        { basicSalary: 380_000, isManagerialEmployee: false },
        20,
        CONFIG,
      ),
    ).toBe(60_000);
  });

  it("固定残業時間 0 のときは 0 円", () => {
    expect(fixedOvertimeAllowanceFromHours(profile, 0, CONFIG)).toBe(0);
  });
});

describe("fixedOvertimeAllowanceFromHours — 時間→分の整数バリデーション", () => {
  it("分の整数になる 0.3h（=18分）は許容する", () => {
    // W = 125 × 18 = 2250 → ceil(2250 × 6 / 19) = ceil(13500 / 19) = ceil(710.52) = 711
    expect(fixedOvertimeAllowanceFromHours(profile, 0.3, CONFIG)).toBe(711);
  });

  it("0.5時間刻み（=30分）も許容する", () => {
    // W = 125 × 30 = 3750 → ceil(3750 × 6 / 19) = ceil(22500 / 19) = ceil(1184.21) = 1185
    expect(fixedOvertimeAllowanceFromHours(profile, 0.5, CONFIG)).toBe(1_185);
  });

  it("分の整数にならない 0.01h（=0.6分）は RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(profile, 0.01, CONFIG),
    ).toThrow(RangeError);
  });

  it("固定残業時間が負なら RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(profile, -1, CONFIG),
    ).toThrow(RangeError);
  });

  it("固定残業時間が非有限なら RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(profile, Number.POSITIVE_INFINITY, CONFIG),
    ).toThrow(RangeError);
  });
});

describe("fixedOvertimeAllowanceFromHours — その他の入力バリデーション", () => {
  it("基本給が負なら RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(
        { basicSalary: -1, isManagerialEmployee: false },
        20,
        CONFIG,
      ),
    ).toThrow(RangeError);
  });

  it("基本給が非整数なら RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(
        { basicSalary: 300_000.5, isManagerialEmployee: false },
        20,
        CONFIG,
      ),
    ).toThrow(RangeError);
  });

  it("年間所定労働時間が 0 以下なら RangeError", () => {
    expect(() =>
      fixedOvertimeAllowanceFromHours(profile, 20, {
        annualScheduledWorkingHours: 0,
      }),
    ).toThrow(RangeError);
  });
});

describe("NON_REGULAR_FIXED_OVERTIME_HOURS — 既定値（第71条⑥）", () => {
  it("事務職は20時間分・その他は40時間分", () => {
    expect(NON_REGULAR_FIXED_OVERTIME_HOURS).toEqual({ office: 20, other: 40 });
  });
});
