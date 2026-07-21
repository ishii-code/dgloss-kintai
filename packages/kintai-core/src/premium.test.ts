import { describe, it, expect } from "vitest";
import { calculateWagePremium } from "./premium.js";
import type { WagePremiumConfig } from "./config.js";
import type {
  ClassifiedWorkMinutes,
  EmployeeWageProfile,
} from "./types.js";

/**
 * 賃金規程第20条の割増賃金計算をテストする。
 *
 * 基準データ:
 *   基本給            = 300,000 円
 *   年間所定労働時間  = 1,900 時間 → 月間平均所定 = 158.333... 時間
 *   時給相当           = 300,000 ÷ (1900/12) = 1,894.7368... 円/時
 *
 * 手当額 = 基本給 × 12 × (Σ 支給率bp × 労働分) ÷ (年間所定分 × 100) を手当ライン単位で切り上げ。
 * 本テストの期待値はすべて規程から手計算した値（reduce: yen = ceil(W × 6 / 19), W = Σ bp×分）。
 */

const CONFIG: WagePremiumConfig = { annualScheduledWorkingHours: 1900 };
const BASIC_SALARY = 300_000;

const worker: EmployeeWageProfile = {
  basicSalary: BASIC_SALARY,
  isManagerialEmployee: false,
};
const manager: EmployeeWageProfile = {
  basicSalary: BASIC_SALARY,
  isManagerialEmployee: true,
};

const NO_WORK: ClassifiedWorkMinutes = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
};

function minutes(
  partial: Partial<ClassifiedWorkMinutes>,
): ClassifiedWorkMinutes {
  return { ...NO_WORK, ...partial };
}

describe("calculateWagePremium — 時間外勤務手当（第20条3項2号(1)）", () => {
  it("法定時間外 10h（60h以内）は 1.25 で計算し切り上げる", () => {
    // W = 125bp × 600min → ceil(75000 × 6 / 19) = ceil(23684.21) = 23685
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 600 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(23_685);
    expect(result.overtimeOver60Allowance).toBe(0);
    expect(result.total).toBe(23_685);
  });

  it("法定内残業（所定外・法定内）3h は時給相当分 1.00 のみ", () => {
    // W = 100bp × 180min → ceil(18000 × 6 / 19) = ceil(5684.21) = 5685
    const result = calculateWagePremium(
      worker,
      minutes({ nonStatutoryOvertimeMinutes: 180 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(5_685);
  });

  it("法定内残業と法定時間外は同一手当ラインで合算し、ライン単位で切り上げる", () => {
    // W = 100×180 + 125×600 = 93000 → ceil(93000 × 6 / 19) = ceil(29368.42) = 29369
    // （区分ごとに丸めると 5685 + 23685 = 29370 になるが、ライン単位の切り上げが正）
    const result = calculateWagePremium(
      worker,
      minutes({ nonStatutoryOvertimeMinutes: 180, statutoryOvertimeMinutes: 600 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(29_369);
  });
});

describe("calculateWagePremium — 60時間超（第20条3項2号(1)b）", () => {
  it("法定時間外 70h を 60h(1.25) と 10h(1.50) に分割する", () => {
    // overtimeAllowance: W = 125 × 3600 = 450000 → ceil(2700000/19)=ceil(142105.26)=142106
    // over60:           W = 150 × 600  = 90000  → ceil(540000/19)=ceil(28421.05)=28422
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 70 * 60 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(142_106);
    expect(result.overtimeOver60Allowance).toBe(28_422);
    expect(result.total).toBe(142_106 + 28_422);
  });

  it("ちょうど 60h では 60h超手当は発生しない（境界）", () => {
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 60 * 60 }),
      CONFIG,
    );
    expect(result.overtimeOver60Allowance).toBe(0);
  });

  it("60h + 1分 で 60h超手当が 1 分から発生する（境界）", () => {
    // over60: W = 150 × 1 = 150 → ceil(900/19) = ceil(47.36) = 48
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 60 * 60 + 1 }),
      CONFIG,
    );
    expect(result.overtimeOver60Allowance).toBe(48);
  });

  it("60h超しきい値は config で変更できる", () => {
    // しきい値 45h に変更 → 50h のうち 5h が超過扱い
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 50 * 60 }),
      { annualScheduledWorkingHours: 1900, overtimeIncreasedRateThresholdHours: 45 },
    );
    // within: W = 125 × 2700 = 337500 → ceil(2025000/19)=ceil(106578.94)=106579
    // over:   W = 150 × 300  = 45000  → ceil(270000/19)=ceil(14210.52)=14211
    expect(result.overtimeAllowance).toBe(106_579);
    expect(result.overtimeOver60Allowance).toBe(14_211);
  });
});

describe("calculateWagePremium — 休日勤務手当（第20条3項2号(2)）", () => {
  it("法定休日 8h は 1.35（0.35 + 時給相当分 1.00）", () => {
    // W = 135 × 480 = 64800 → ceil(388800/19) = ceil(20463.15) = 20464
    const result = calculateWagePremium(
      worker,
      minutes({ legalHolidayMinutes: 480 }),
      CONFIG,
    );
    expect(result.holidayAllowance).toBe(20_464);
  });

  it("所定休日 8h は 1.25（0.25 + 時給相当分 1.00）", () => {
    // W = 125 × 480 = 60000 → ceil(360000/19) = ceil(18947.36) = 18948
    const result = calculateWagePremium(
      worker,
      minutes({ scheduledHolidayMinutes: 480 }),
      CONFIG,
    );
    expect(result.holidayAllowance).toBe(18_948);
  });

  it("法定休日と所定休日は同一手当ラインで合算する", () => {
    // W = 135×480 + 125×240 = 64800 + 30000 = 94800 → ceil(568800/19)=ceil(29936.84)=29937
    const result = calculateWagePremium(
      worker,
      minutes({ legalHolidayMinutes: 480, scheduledHolidayMinutes: 240 }),
      CONFIG,
    );
    expect(result.holidayAllowance).toBe(29_937);
  });
});

describe("calculateWagePremium — 深夜勤務手当（第20条3項2号(3)）", () => {
  it("深夜 5h は割増分 0.25 のみ加算する", () => {
    // W = 25 × 300 = 7500 → ceil(45000/19) = ceil(2368.42) = 2369
    const result = calculateWagePremium(
      worker,
      minutes({ nightMinutes: 300 }),
      CONFIG,
    );
    expect(result.nightAllowance).toBe(2_369);
  });

  it("深夜は時間外と重複計上され、深夜割増は別ラインで加算される（スタック）", () => {
    // 法定時間外 10h がすべて深夜帯: OT=23685, 深夜=25×600=15000→ceil(90000/19)=4737
    const result = calculateWagePremium(
      worker,
      minutes({ statutoryOvertimeMinutes: 600, nightMinutes: 600 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(23_685);
    expect(result.nightAllowance).toBe(4_737);
    expect(result.total).toBe(23_685 + 4_737);
  });
});

describe("calculateWagePremium — 管理監督者の例外（第20条3項4号）", () => {
  it("管理監督者には深夜勤務手当のみ支給する", () => {
    const result = calculateWagePremium(
      manager,
      minutes({
        nonStatutoryOvertimeMinutes: 120,
        statutoryOvertimeMinutes: 70 * 60,
        legalHolidayMinutes: 480,
        scheduledHolidayMinutes: 240,
        nightMinutes: 300,
      }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(0);
    expect(result.overtimeOver60Allowance).toBe(0);
    expect(result.holidayAllowance).toBe(0);
    expect(result.nightAllowance).toBe(2_369);
    expect(result.total).toBe(2_369);
  });
});

describe("calculateWagePremium — 端数処理と境界", () => {
  it("労働時間が 0 のときはすべて 0 円", () => {
    const result = calculateWagePremium(worker, NO_WORK, CONFIG);
    expect(result).toEqual({
      overtimeAllowance: 0,
      overtimeOver60Allowance: 0,
      holidayAllowance: 0,
      nightAllowance: 0,
      total: 0,
    });
  });

  it("1円未満の端数は必ず切り上げる（1分でも 1 円以上）", () => {
    // 深夜 1 分: W = 25 → ceil(150/19) = ceil(7.89) = 8
    const result = calculateWagePremium(
      worker,
      minutes({ nightMinutes: 1 }),
      CONFIG,
    );
    expect(result.nightAllowance).toBe(8);
  });

  it("割り切れる場合は切り上げず、そのままの整数額になる", () => {
    // 基本給を 19 の倍数寄りに設定して割り切れるケースを作る。
    // 時間外 60min, W = 125 × 60 = 7500, 基本給 X:
    // yen = X × 12 × 7500 / (114000 × 100) = X × 90000 / 11400000 = X / 126.66..
    // 割り切れるように基本給 = 380,000, 年間所定 1900h:
    // yen = 380000 × 12 × 7500 / 11400000 = 34,200,000,000 / 11,400,000 = 3000（整数）
    const result = calculateWagePremium(
      { basicSalary: 380_000, isManagerialEmployee: false },
      minutes({ statutoryOvertimeMinutes: 60 }),
      CONFIG,
    );
    expect(result.overtimeAllowance).toBe(3_000);
  });
});

describe("calculateWagePremium — 入力バリデーション", () => {
  it("基本給が負なら例外", () => {
    expect(() =>
      calculateWagePremium(
        { basicSalary: -1, isManagerialEmployee: false },
        NO_WORK,
        CONFIG,
      ),
    ).toThrow(RangeError);
  });

  it("労働時間が非整数なら例外（分単位の整数を要求）", () => {
    expect(() =>
      calculateWagePremium(
        worker,
        minutes({ statutoryOvertimeMinutes: 1.5 }),
        CONFIG,
      ),
    ).toThrow(RangeError);
  });

  it("労働時間が負なら例外", () => {
    expect(() =>
      calculateWagePremium(worker, minutes({ nightMinutes: -1 }), CONFIG),
    ).toThrow(RangeError);
  });

  it("年間所定労働時間が 0 以下なら例外", () => {
    expect(() =>
      calculateWagePremium(worker, NO_WORK, { annualScheduledWorkingHours: 0 }),
    ).toThrow(RangeError);
  });
});
