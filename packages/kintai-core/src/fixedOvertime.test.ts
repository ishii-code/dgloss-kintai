import { describe, it, expect } from "vitest";
import { settleWithFixedOvertime } from "./fixedOvertime.js";
import type {
  FixedOvertimeContract,
  FixedOvertimeCoveredComponents,
} from "./fixedOvertime.js";
import type { WagePremiumBreakdown } from "./types.js";

/**
 * 賃金規程第20条4項・第18条 固定時間外勤務手当との差額調整をテストする。
 * 支給額 = max(固定額, 充当対象の算出合計) + 固定が充当しない区分の全額。
 */

const breakdown: WagePremiumBreakdown = {
  overtimeAllowance: 23_685,
  overtimeOver60Allowance: 0,
  holidayAllowance: 0,
  nightAllowance: 2_369,
  total: 26_054,
};

const coverOvertimeOnly: FixedOvertimeCoveredComponents = {
  overtime: true,
  overtimeOver60: true,
  holiday: true,
  night: false,
};

const coverAll: FixedOvertimeCoveredComponents = {
  overtime: true,
  overtimeOver60: true,
  holiday: true,
  night: true,
};

describe("settleWithFixedOvertime — 第20条4項", () => {
  it("固定額が算出額を上回るとき差額支給は 0、固定額を原則支給する", () => {
    const contract: FixedOvertimeContract = {
      fixedOvertimeAllowance: 30_000,
      coveredComponents: coverOvertimeOnly,
    };
    const settled = settleWithFixedOvertime(breakdown, contract);
    expect(settled.coveredCalculatedTotal).toBe(23_685);
    expect(settled.additionalPayment).toBe(0);
    // 固定が充当しない深夜は全額別途支給
    expect(settled.uncoveredPayment).toBe(2_369);
    // 30000（原則支給） + 0（差額） + 2369（深夜） = 32369
    expect(settled.totalPaid).toBe(32_369);
  });

  it("算出額が固定額を上回るとき超過分（差額）を支給する", () => {
    const contract: FixedOvertimeContract = {
      fixedOvertimeAllowance: 20_000,
      coveredComponents: coverOvertimeOnly,
    };
    const settled = settleWithFixedOvertime(breakdown, contract);
    expect(settled.coveredCalculatedTotal).toBe(23_685);
    expect(settled.additionalPayment).toBe(3_685);
    expect(settled.uncoveredPayment).toBe(2_369);
    // 20000 + 3685 + 2369 = 26054
    expect(settled.totalPaid).toBe(26_054);
  });

  it("固定が深夜も充当する場合、深夜も含めて差額判定する", () => {
    const contract: FixedOvertimeContract = {
      fixedOvertimeAllowance: 20_000,
      coveredComponents: coverAll,
    };
    const settled = settleWithFixedOvertime(breakdown, contract);
    expect(settled.coveredCalculatedTotal).toBe(26_054);
    expect(settled.additionalPayment).toBe(6_054);
    expect(settled.uncoveredPayment).toBe(0);
    expect(settled.totalPaid).toBe(26_054);
  });

  it("固定額が 0 のときは算出額を全額支給する", () => {
    const contract: FixedOvertimeContract = {
      fixedOvertimeAllowance: 0,
      coveredComponents: coverAll,
    };
    const settled = settleWithFixedOvertime(breakdown, contract);
    expect(settled.totalPaid).toBe(26_054);
  });

  it("固定額が負なら例外", () => {
    expect(() =>
      settleWithFixedOvertime(breakdown, {
        fixedOvertimeAllowance: -1,
        coveredComponents: coverAll,
      }),
    ).toThrow(RangeError);
  });
});
