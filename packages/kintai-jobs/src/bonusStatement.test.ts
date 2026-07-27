/**
 * buildBonusStatement のテスト（賞与明細・総支給まで）。
 */

import { describe, expect, it } from "vitest";
import { buildBonusStatement } from "./bonusStatement.js";
import { makeEmployee } from "./testFixtures.js";

const params = {
  monthsMultiplier: 200, // 2.0月
  evaluationRate: 110, // 110%
  attendanceRate: 100,
  adjustment: 0,
};

describe("buildBonusStatement", () => {
  it("正社員: 基本賞与＋評価調整で総支給を確定する", () => {
    const employee = makeEmployee("A", { basicSalary: 300_000 });
    const s = buildBonusStatement(employee, params, "2026年 夏季賞与");
    expect(s.eligible).toBe(true);
    expect(s.label).toBe("2026年 夏季賞与");
    // 600,000 × 1.10 = 660,000
    expect(s.grossBonus).toBe(660_000);
    expect(s.lines.map((l) => l.label)).toEqual(["基本賞与", "評価調整"]);
    expect(s.lines[0]?.amount).toBe(600_000);
    expect(s.lines[1]?.amount).toBe(60_000);
  });

  it("在籍按分・調整額があれば内訳に出る", () => {
    const employee = makeEmployee("B", { basicSalary: 300_000 });
    const s = buildBonusStatement(
      employee,
      { monthsMultiplier: 200, evaluationRate: 100, attendanceRate: 50, adjustment: 10_000 },
      "夏季",
    );
    expect(s.lines.map((l) => l.label)).toEqual([
      "基本賞与",
      "在籍按分調整",
      "その他調整",
    ]);
    // 600,000 × 0.5 = 300,000 → +10,000 = 310,000
    expect(s.grossBonus).toBe(310_000);
  });

  it("評価100%・按分100%・調整0なら基本賞与のみ", () => {
    const employee = makeEmployee("C", { basicSalary: 250_000 });
    const s = buildBonusStatement(
      employee,
      { monthsMultiplier: 100, evaluationRate: 100, attendanceRate: 100, adjustment: 0 },
      "冬季",
    );
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]?.label).toBe("基本賞与");
    expect(s.grossBonus).toBe(250_000);
  });

  it("非正規は賞与なし（eligible=false・総支給0）", () => {
    const employee = makeEmployee("D", {
      basicSalary: 300_000,
      employmentType: "non_regular",
    });
    const s = buildBonusStatement(employee, params, "夏季");
    expect(s.eligible).toBe(false);
    expect(s.grossBonus).toBe(0);
    expect(s.lines[0]?.label).toBe("賞与対象外");
  });

  it("所得税・社保（賞与分）は未計上プレースホルダとして出す", () => {
    const employee = makeEmployee("E", { basicSalary: 300_000 });
    const s = buildBonusStatement(employee, params, "夏季");
    expect(s.statutoryPlaceholders.map((l) => l.label)).toEqual([
      "所得税（賞与）",
      "社会保険料（賞与）",
    ]);
    expect(s.statutoryPlaceholders.every((l) => l.amount === 0)).toBe(true);
  });
});
