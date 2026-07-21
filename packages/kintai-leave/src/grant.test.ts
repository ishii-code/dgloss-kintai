import { describe, expect, it } from "vitest";
import { grantDaysFor } from "./grant.js";
import { DEFAULT_LEAVE_CONFIG, type LeaveConfig } from "./config.js";

describe("grantDaysFor（付与日数テーブル・労基法第39条）", () => {
  it("出勤率8割以上の各段で法定日数を返す", () => {
    // 手計算値: 6か月=10 / 1年6か月=11 / 2年6か月=12 / 3年6か月=14 /
    //           4年6か月=16 / 5年6か月=18 / 6年6か月=20
    expect(grantDaysFor(6, 1)).toBe(10);
    expect(grantDaysFor(18, 1)).toBe(11);
    expect(grantDaysFor(30, 1)).toBe(12);
    expect(grantDaysFor(42, 1)).toBe(14);
    expect(grantDaysFor(54, 1)).toBe(16);
    expect(grantDaysFor(66, 1)).toBe(18);
    expect(grantDaysFor(78, 1)).toBe(20);
  });

  it("6年6か月を超えても上限20日で頭打ち", () => {
    expect(grantDaysFor(120, 1)).toBe(20);
    expect(grantDaysFor(78, 0.8)).toBe(20);
  });

  it("段の途中の月数は直下の段の日数（切り上げず据え置き）", () => {
    // 7か月 → 6か月の段（10日）。17か月 → まだ6か月の段（10日）。
    expect(grantDaysFor(7, 1)).toBe(10);
    expect(grantDaysFor(17, 1)).toBe(10);
    expect(grantDaysFor(29, 1)).toBe(11);
  });

  it("境界: 6か月ちょうどで初回10日、6か月未満は0", () => {
    expect(grantDaysFor(6, 1)).toBe(10);
    expect(grantDaysFor(5, 1)).toBe(0);
    expect(grantDaysFor(0, 1)).toBe(0);
  });

  it("出勤率8割（0.8）ちょうどは付与あり、8割未満は付与0", () => {
    // しきい値は「以上」。0.8 は付与、0.79 は0。
    expect(grantDaysFor(6, 0.8)).toBe(10);
    expect(grantDaysFor(6, 0.79)).toBe(0);
    expect(grantDaysFor(78, 0.5)).toBe(0);
  });

  it("既定設定は法定テーブルと一致する", () => {
    expect(DEFAULT_LEAVE_CONFIG.attendanceThreshold).toBe(0.8);
    expect(DEFAULT_LEAVE_CONFIG.grantTable).toHaveLength(7);
  });

  it("会社独自の前倒し付与を config で上書きできる", () => {
    // 入社時（0か月）に10日前倒し付与する会社ルール。
    const config: LeaveConfig = {
      ...DEFAULT_LEAVE_CONFIG,
      grantTable: [{ minMonths: 0, days: 10 }, { minMonths: 12, days: 11 }],
    };
    expect(grantDaysFor(0, 1, config)).toBe(10);
    expect(grantDaysFor(12, 1, config)).toBe(11);
  });

  it("不正入力（負の月数・範囲外の出勤率）は例外", () => {
    expect(() => grantDaysFor(-1, 1)).toThrow();
    expect(() => grantDaysFor(6, 1.5)).toThrow();
    expect(() => grantDaysFor(6.5, 1)).toThrow();
  });
});
