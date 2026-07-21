import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROPORTIONAL_LEAVE_CONFIG,
  grantDaysForSchedule,
  proportionalGrantDaysFor,
  weeklyEquivalentFromAnnualDays,
  type ProportionalLeaveConfig,
  type WorkSchedule,
} from "./proportional.js";

describe("proportionalGrantDaysFor（比例付与テーブル・労基法第39条第3項）", () => {
  // 手計算値（列 = 6M/18M/30M/42M/54M/66M/78M〜）:
  //   週4日: 7, 8, 9, 10, 12, 13, 15
  //   週3日: 5, 6, 6, 8, 9, 10, 11
  //   週2日: 3, 4, 4, 5, 6, 6, 7
  //   週1日: 1, 2, 2, 2, 3, 3, 3
  const tiers = [6, 18, 30, 42, 54, 66, 78];

  it("週4日の各勤続段で法定日数を返す", () => {
    const expected = [7, 8, 9, 10, 12, 13, 15];
    tiers.forEach((m, i) => {
      expect(proportionalGrantDaysFor(4, m, 1)).toBe(expected[i]);
    });
  });

  it("週3日の各勤続段で法定日数を返す", () => {
    const expected = [5, 6, 6, 8, 9, 10, 11];
    tiers.forEach((m, i) => {
      expect(proportionalGrantDaysFor(3, m, 1)).toBe(expected[i]);
    });
  });

  it("週2日の各勤続段で法定日数を返す", () => {
    const expected = [3, 4, 4, 5, 6, 6, 7];
    tiers.forEach((m, i) => {
      expect(proportionalGrantDaysFor(2, m, 1)).toBe(expected[i]);
    });
  });

  it("週1日の各勤続段で法定日数を返す", () => {
    const expected = [1, 2, 2, 2, 3, 3, 3];
    tiers.forEach((m, i) => {
      expect(proportionalGrantDaysFor(1, m, 1)).toBe(expected[i]);
    });
  });

  it("6か月以上で頭打ち（78か月超も最終段）", () => {
    expect(proportionalGrantDaysFor(4, 120, 1)).toBe(15);
    expect(proportionalGrantDaysFor(1, 999, 1)).toBe(3);
  });

  it("段の途中は直下の段の日数（据え置き）", () => {
    // 週4日: 7か月→6か月段(7)、17か月→まだ6か月段(7)、29か月→18か月段(8)。
    expect(proportionalGrantDaysFor(4, 7, 1)).toBe(7);
    expect(proportionalGrantDaysFor(4, 17, 1)).toBe(7);
    expect(proportionalGrantDaysFor(4, 29, 1)).toBe(8);
  });

  it("境界: 6か月ちょうどで初回付与、6か月未満は0", () => {
    expect(proportionalGrantDaysFor(3, 6, 1)).toBe(5);
    expect(proportionalGrantDaysFor(3, 5, 1)).toBe(0);
    expect(proportionalGrantDaysFor(3, 0, 1)).toBe(0);
  });

  it("出勤率0.8ちょうどは付与あり、8割未満は0", () => {
    expect(proportionalGrantDaysFor(4, 6, 0.8)).toBe(7);
    expect(proportionalGrantDaysFor(4, 6, 0.79)).toBe(0);
    expect(proportionalGrantDaysFor(1, 78, 0.5)).toBe(0);
  });

  it("比例テーブルを config で上書きできる", () => {
    const config: ProportionalLeaveConfig = {
      ...DEFAULT_PROPORTIONAL_LEAVE_CONFIG,
      proportionalGrantTable: [
        {
          weeklyDays: 4,
          annualDaysMin: 169,
          annualDaysMax: 216,
          grantTable: [{ minMonths: 0, days: 7 }],
        },
      ],
    };
    // 入社時（0か月）に前倒し付与する上書き。
    expect(proportionalGrantDaysFor(4, 0, 1, config)).toBe(7);
    // テーブルに無い週日数は0。
    expect(proportionalGrantDaysFor(3, 6, 1, config)).toBe(0);
  });

  it("不正入力（範囲外の週日数・負の月数・範囲外の出勤率）は例外", () => {
    expect(() => proportionalGrantDaysFor(0, 6, 1)).toThrow();
    expect(() => proportionalGrantDaysFor(5, 6, 1)).toThrow();
    expect(() => proportionalGrantDaysFor(4, -1, 1)).toThrow();
    expect(() => proportionalGrantDaysFor(4, 6, 1.5)).toThrow();
    expect(() => proportionalGrantDaysFor(2.5, 6, 1)).toThrow();
  });
});

describe("weeklyEquivalentFromAnnualDays（年間所定→週相当日数）", () => {
  it("各年間範囲を週相当日数に対応づける", () => {
    expect(weeklyEquivalentFromAnnualDays(216)).toBe(4);
    expect(weeklyEquivalentFromAnnualDays(169)).toBe(4);
    expect(weeklyEquivalentFromAnnualDays(168)).toBe(3);
    expect(weeklyEquivalentFromAnnualDays(121)).toBe(3);
    expect(weeklyEquivalentFromAnnualDays(120)).toBe(2);
    expect(weeklyEquivalentFromAnnualDays(73)).toBe(2);
    expect(weeklyEquivalentFromAnnualDays(72)).toBe(1);
    expect(weeklyEquivalentFromAnnualDays(48)).toBe(1);
    // 48日未満も最下段（週1日相当）に丸める。
    expect(weeklyEquivalentFromAnnualDays(10)).toBe(1);
  });
});

describe("grantDaysForSchedule（判定ディスパッチャ・非正規社員就業規則 第59条②）", () => {
  it("週30時間未満かつ週4日は比例付与（週4日テーブル）", () => {
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 28,
      weeklyScheduledDays: 4,
    };
    expect(grantDaysForSchedule(schedule, 6, 1)).toBe(7);
    expect(grantDaysForSchedule(schedule, 78, 1)).toBe(15);
  });

  it("週30時間未満かつ週2日は比例付与（週2日テーブル）", () => {
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 16,
      weeklyScheduledDays: 2,
    };
    expect(grantDaysForSchedule(schedule, 6, 1)).toBe(3);
    expect(grantDaysForSchedule(schedule, 42, 1)).toBe(5);
  });

  it("週30時間以上は週日数が少なくても通常付与へフォールバック", () => {
    // 週32時間・週4日 → 通常付与（6か月=10日）。
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 32,
      weeklyScheduledDays: 4,
    };
    expect(grantDaysForSchedule(schedule, 6, 1)).toBe(10);
    expect(grantDaysForSchedule(schedule, 78, 1)).toBe(20);
  });

  it("週5日以上は通常付与へフォールバック（週30時間未満でも）", () => {
    // 週24時間・週5日（短時間だが週5日）→ 通常付与。
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 24,
      weeklyScheduledDays: 5,
    };
    expect(grantDaysForSchedule(schedule, 6, 1)).toBe(10);
  });

  it("境界: 週30時間ちょうどは通常付与、29時間は比例付与", () => {
    const at30: WorkSchedule = { weeklyScheduledHours: 30, weeklyScheduledDays: 4 };
    const at29: WorkSchedule = { weeklyScheduledHours: 29, weeklyScheduledDays: 4 };
    expect(grantDaysForSchedule(at30, 6, 1)).toBe(10); // 通常付与
    expect(grantDaysForSchedule(at29, 6, 1)).toBe(7); // 比例付与（週4日）
  });

  it("年間所定労働日数で判定: 216日は比例、217日は通常付与", () => {
    // 週日数を範囲外(週5日)にして年間所定で判定させる。
    const at216: WorkSchedule = {
      weeklyScheduledHours: 28,
      weeklyScheduledDays: 5,
      annualScheduledDays: 216,
    };
    const at217: WorkSchedule = {
      weeklyScheduledHours: 28,
      weeklyScheduledDays: 5,
      annualScheduledDays: 217,
    };
    // 年216日 → 週4日相当の比例付与（6か月=7日）。
    expect(grantDaysForSchedule(at216, 6, 1)).toBe(7);
    // 年217日 → 比例対象外 → 通常付与（6か月=10日）。
    expect(grantDaysForSchedule(at217, 6, 1)).toBe(10);
  });

  it("週日数が1〜4なら週日数を優先し、年間所定は行選択に使わない", () => {
    // 週2日（比例対象）だが年間所定は週4日相当の値 → 週2日テーブルを使う。
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 16,
      weeklyScheduledDays: 2,
      annualScheduledDays: 200,
    };
    expect(grantDaysForSchedule(schedule, 6, 1)).toBe(3); // 週2日=3日
  });

  it("出勤率8割未満は比例付与でも0", () => {
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 28,
      weeklyScheduledDays: 4,
    };
    expect(grantDaysForSchedule(schedule, 6, 0.79)).toBe(0);
  });

  it("config でしきい値・テーブルを上書きできる", () => {
    const schedule: WorkSchedule = {
      weeklyScheduledHours: 28,
      weeklyScheduledDays: 4,
    };
    const days = grantDaysForSchedule(schedule, 6, 1, {
      proportional: {
        ...DEFAULT_PROPORTIONAL_LEAVE_CONFIG,
        proportionalGrantTable: [
          {
            weeklyDays: 4,
            annualDaysMin: 169,
            annualDaysMax: 216,
            grantTable: [{ minMonths: 6, days: 99 }],
          },
        ],
      },
    });
    expect(days).toBe(99);
  });

  it("不正な所定労働（負の日数・負の時間）は例外", () => {
    expect(() =>
      grantDaysForSchedule(
        { weeklyScheduledHours: -1, weeklyScheduledDays: 4 },
        6,
        1,
      ),
    ).toThrow();
    expect(() =>
      grantDaysForSchedule(
        { weeklyScheduledHours: 28, weeklyScheduledDays: -1 },
        6,
        1,
      ),
    ).toThrow();
  });
});
