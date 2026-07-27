/**
 * calculateBonus のテスト（賞与計算・1円単位厳密）。
 * 基本給×支給月数×評価係数×在籍按分＋調整、非正規0、端数四捨五入を検証する。
 */

import { describe, expect, it } from "vitest";
import { calculateBonus } from "./bonus.js";
import { roundDiv } from "./money.js";

const regular = { basicSalary: 300_000, employmentType: "regular" as const };

describe("calculateBonus", () => {
  it("基本給×支給月数（評価100%・按分100%・調整0）", () => {
    const r = calculateBonus(regular, {
      monthsMultiplier: 250, // 2.5月
      evaluationRate: 100,
      attendanceRate: 100,
      adjustment: 0,
    });
    expect(r.eligible).toBe(true);
    // 300,000 × 2.5 = 750,000
    expect(r.baseAmount).toBe(750_000);
    expect(r.evaluationAdjustment).toBe(0);
    expect(r.attendanceAdjustment).toBe(0);
    expect(r.grossBonus).toBe(750_000);
  });

  it("評価係数を反映する（110%）", () => {
    const r = calculateBonus(regular, {
      monthsMultiplier: 200, // 2.0月 → 600,000
      evaluationRate: 110,
      attendanceRate: 100,
      adjustment: 0,
    });
    expect(r.baseAmount).toBe(600_000);
    // 600,000 × 1.10 = 660,000（評価調整 +60,000）
    expect(r.evaluationAdjustment).toBe(60_000);
    expect(r.grossBonus).toBe(660_000);
  });

  it("在籍按分（中途入社50%）を反映する", () => {
    const r = calculateBonus(regular, {
      monthsMultiplier: 200,
      evaluationRate: 100,
      attendanceRate: 50, // 50%
      adjustment: 0,
    });
    // 600,000 × 0.5 = 300,000（按分調整 −300,000）
    expect(r.attendanceAdjustment).toBe(-300_000);
    expect(r.grossBonus).toBe(300_000);
  });

  it("調整額（加算・減算）を反映する", () => {
    const plus = calculateBonus(regular, {
      monthsMultiplier: 100,
      evaluationRate: 100,
      attendanceRate: 100,
      adjustment: 25_000,
    });
    expect(plus.grossBonus).toBe(325_000);

    const minus = calculateBonus(regular, {
      monthsMultiplier: 100,
      evaluationRate: 100,
      attendanceRate: 100,
      adjustment: -50_000,
    });
    expect(minus.grossBonus).toBe(250_000);
  });

  it("調整で負になっても総支給は0で下げ止まる", () => {
    const r = calculateBonus(regular, {
      monthsMultiplier: 100,
      evaluationRate: 100,
      attendanceRate: 100,
      adjustment: -500_000,
    });
    expect(r.grossBonus).toBe(0);
  });

  it("非正規は賞与なし（就業規則第72条・総支給0・eligible=false）", () => {
    const r = calculateBonus(
      { basicSalary: 300_000, employmentType: "non_regular" },
      { monthsMultiplier: 300, evaluationRate: 120, attendanceRate: 100, adjustment: 50_000 },
    );
    expect(r.eligible).toBe(false);
    expect(r.baseAmount).toBe(0);
    expect(r.grossBonus).toBe(0);
  });

  it("端数は四捨五入する（各段階で円に丸め）", () => {
    // 基本給 333,333 × 1.5月 = 499,999.5 → 四捨五入 500,000
    const r = calculateBonus(
      { basicSalary: 333_333, employmentType: "regular" },
      { monthsMultiplier: 150, evaluationRate: 100, attendanceRate: 100, adjustment: 0 },
    );
    expect(r.baseAmount).toBe(500_000);
    // roundDiv の一致確認（333333 × 150 / 100）
    expect(r.baseAmount).toBe(Number(roundDiv(333_333n * 150n, 100n)));
  });

  it("不正な入力は RangeError", () => {
    expect(() =>
      calculateBonus(regular, {
        monthsMultiplier: -100,
        evaluationRate: 100,
        attendanceRate: 100,
        adjustment: 0,
      }),
    ).toThrow(RangeError);
    expect(() =>
      calculateBonus(
        { basicSalary: 1.5, employmentType: "regular" },
        { monthsMultiplier: 100, evaluationRate: 100, attendanceRate: 100, adjustment: 0 },
      ),
    ).toThrow(RangeError);
  });
});
