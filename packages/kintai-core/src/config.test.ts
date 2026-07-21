import { describe, it, expect } from "vitest";
import {
  resolveWagePremiumConfig,
  annualScheduledMinutesOf,
  DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS,
} from "./config.js";

describe("resolveWagePremiumConfig", () => {
  it("60時間超しきい値の既定は 60（第20条3項2号(1)b）", () => {
    const resolved = resolveWagePremiumConfig({
      annualScheduledWorkingHours: 1900,
    });
    expect(resolved.overtimeIncreasedRateThresholdHours).toBe(60);
    expect(DEFAULT_OVERTIME_INCREASED_RATE_THRESHOLD_HOURS).toBe(60);
  });

  it("しきい値は上書きできる", () => {
    const resolved = resolveWagePremiumConfig({
      annualScheduledWorkingHours: 1900,
      overtimeIncreasedRateThresholdHours: 45,
    });
    expect(resolved.overtimeIncreasedRateThresholdHours).toBe(45);
  });

  it("年間所定労働時間が 0 以下・非有限なら例外", () => {
    expect(() =>
      resolveWagePremiumConfig({ annualScheduledWorkingHours: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      resolveWagePremiumConfig({ annualScheduledWorkingHours: Number.NaN }),
    ).toThrow(RangeError);
  });

  it("しきい値が負なら例外", () => {
    expect(() =>
      resolveWagePremiumConfig({
        annualScheduledWorkingHours: 1900,
        overtimeIncreasedRateThresholdHours: -1,
      }),
    ).toThrow(RangeError);
  });
});

describe("annualScheduledMinutesOf", () => {
  it("整数時間を分に変換する", () => {
    expect(annualScheduledMinutesOf(1900)).toBe(114_000);
  });

  it("30分単位（0.5時間）も分の整数になる", () => {
    expect(annualScheduledMinutesOf(1900.5)).toBe(114_030);
  });

  it("分の整数に落ちない値は例外", () => {
    // 1900.001h × 60 = 114000.06 分 → 非整数
    expect(() => annualScheduledMinutesOf(1900.001)).toThrow(RangeError);
  });
});
