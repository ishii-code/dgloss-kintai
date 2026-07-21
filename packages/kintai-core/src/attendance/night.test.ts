import { describe, it, expect } from "vitest";
import { nightOverlapMinutes } from "./night.js";

/**
 * 深夜(22:00-5:00)の重なり算定をテストする。
 * 時刻はその日の 00:00 からの絶対分（翌 6:00 = 1800）で表す。半開区間 [start, end)。
 */

const at = (h: number, m = 0): number => h * 60 + m;

describe("nightOverlapMinutes — 深夜帯の重なり", () => {
  it("日中のみ（9:00-18:00）は深夜 0 分", () => {
    expect(nightOverlapMinutes(at(9), at(18))).toBe(0);
  });

  it("21:00-24:00 は深夜 120 分（22:00-24:00）", () => {
    expect(nightOverlapMinutes(at(21), at(24))).toBe(120);
  });

  it("22:00-翌6:00 は深夜 420 分（22:00-翌5:00 の 7h）", () => {
    // 翌6:00 = 30:00 = 1800 分
    expect(nightOverlapMinutes(at(22), at(30))).toBe(420);
  });

  it("早朝 3:00-8:00 は深夜 120 分（3:00-5:00）", () => {
    expect(nightOverlapMinutes(at(3), at(8))).toBe(120);
  });

  it("22:00-翌8:00 は深夜 420 分（深夜帯は 5:00 で終端）", () => {
    expect(nightOverlapMinutes(at(22), at(32))).toBe(420);
  });

  it("ちょうど 5:00 終わり（0:00-5:00）は深夜 300 分（境界は半開で含む）", () => {
    expect(nightOverlapMinutes(at(0), at(5))).toBe(300);
  });

  it("5:00 開始（5:00-9:00）は深夜 0 分（境界 5:00 は含めない）", () => {
    expect(nightOverlapMinutes(at(5), at(9))).toBe(0);
  });

  it("22:00 ちょうど開始前（21:59-22:00）は深夜 0 分（境界 22:00 は含めない側）", () => {
    expect(nightOverlapMinutes(at(21, 59), at(22))).toBe(0);
  });

  it("22:00-22:01 は深夜 1 分（境界 22:00 は含む側）", () => {
    expect(nightOverlapMinutes(at(22), at(22, 1))).toBe(1);
  });

  it("深夜を丸ごと含む終日勤務（0:00-翌0:00）は深夜 420 分（0-5 と 22-24）", () => {
    expect(nightOverlapMinutes(at(0), at(24))).toBe(300 + 120);
  });

  it("end <= start は 0 分", () => {
    expect(nightOverlapMinutes(at(22), at(22))).toBe(0);
  });
});
