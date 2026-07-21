import { describe, it, expect } from "vitest";
import { buildDemoScenarios, DEMO_PERIOD } from "./fixtures.js";

describe("buildDemoScenarios", () => {
  it("決定的: 2回呼んでも同じ内容（純粋関数）", () => {
    expect(buildDemoScenarios()).toStrictEqual(buildDemoScenarios());
  });

  it("賃金計算に効く3類型（固定残業なし/あり・管理監督者）を含む", () => {
    const scenarios = buildDemoScenarios();
    expect(scenarios).toHaveLength(3);

    const [noFixed, withFixed, managerial] = scenarios;
    // 1. 固定残業なし・非管理監督者。
    expect(noFixed?.employee.contract.fixedOvertimeAllowance).toBe(0);
    expect(noFixed?.employee.contract.isManagerialEmployee).toBe(false);
    expect(noFixed?.jinjerPremiumDelta).toBe(0);
    // 2. 固定残業あり・非管理監督者・未払い方向（jinjer が1円高い）。
    expect(withFixed?.employee.contract.fixedOvertimeAllowance).toBeGreaterThan(0);
    expect(withFixed?.employee.contract.isManagerialEmployee).toBe(false);
    expect(withFixed?.jinjerPremiumDelta).toBe(1);
    // 3. 管理監督者。
    expect(managerial?.employee.contract.isManagerialEmployee).toBe(true);
    expect(managerial?.jinjerPremiumDelta).toBe(0);
  });

  it("各従業員の WorkDay は全て当月・本人のもの", () => {
    const prefix = `${DEMO_PERIOD.year}-${String(DEMO_PERIOD.month).padStart(2, "0")}`;
    for (const s of buildDemoScenarios()) {
      expect(s.workDays.length).toBeGreaterThan(0);
      for (const wd of s.workDays) {
        expect(wd.employeeId).toBe(s.employee.id);
        expect(wd.date.startsWith(prefix)).toBe(true);
      }
    }
  });
});
