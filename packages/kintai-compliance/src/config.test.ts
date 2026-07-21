import { describe, it, expect } from "vitest";
import {
  DEFAULT_36_LIMITS,
  resolveLimits,
  thirtySixAgreementLimitsSchema,
} from "./config.js";

/**
 * 上限設定（config 外出し）のテスト。
 * 既定値は労働基準法第36条の法定上限を分で表したもの。
 */
describe("DEFAULT_36_LIMITS", () => {
  it("法定上限を分で保持する", () => {
    expect(DEFAULT_36_LIMITS.monthlyOvertimeLimitMinutes).toBe(45 * 60); // 2700
    expect(DEFAULT_36_LIMITS.annualOvertimeLimitMinutes).toBe(360 * 60); // 21600
    expect(DEFAULT_36_LIMITS.annualSpecialOvertimeLimitMinutes).toBe(720 * 60); // 43200
    expect(DEFAULT_36_LIMITS.monthlyWithHolidayLimitMinutes).toBe(100 * 60); // 6000
    expect(DEFAULT_36_LIMITS.multiMonthAverageLimitMinutes).toBe(80 * 60); // 4800
    expect(DEFAULT_36_LIMITS.multiMonthWindowSizes).toEqual([2, 3, 4, 5, 6]);
    expect(DEFAULT_36_LIMITS.over45CountLimit).toBe(6);
    expect(DEFAULT_36_LIMITS.warningRatioPercent).toBe(90);
  });

  it("既定は法定スキーマとして妥当", () => {
    expect(() => thirtySixAgreementLimitsSchema.parse(DEFAULT_36_LIMITS)).not.toThrow();
  });
});

describe("resolveLimits", () => {
  it("未指定なら法定既定を返す", () => {
    expect(resolveLimits()).toEqual(DEFAULT_36_LIMITS);
    expect(resolveLimits(undefined)).toEqual(DEFAULT_36_LIMITS);
  });

  it("会社設定で上書きできる（特別条項の社内基準）", () => {
    const custom = { ...DEFAULT_36_LIMITS, monthlyOvertimeLimitMinutes: 40 * 60 };
    expect(resolveLimits(custom).monthlyOvertimeLimitMinutes).toBe(2400);
  });

  it("不正な値（範囲外の警告%）は zod で弾く", () => {
    expect(() =>
      resolveLimits({ ...DEFAULT_36_LIMITS, warningRatioPercent: 0 }),
    ).toThrow();
    expect(() =>
      resolveLimits({ ...DEFAULT_36_LIMITS, monthlyOvertimeLimitMinutes: -1 }),
    ).toThrow();
    expect(() =>
      resolveLimits({ ...DEFAULT_36_LIMITS, multiMonthWindowSizes: [] }),
    ).toThrow();
  });
});
