/**
 * buildPayslip のテスト（賃金規程・要件定義 v0.1）。
 *
 * 検証観点:
 *  - 総支給額（grossPay）= 支給項目の合計、差引支給額 = 総支給 − 自社控除
 *  - 固定残業なし: 基本給 + 実割増内訳（非ゼロのみ）
 *  - 固定残業あり: 基本給 + 固定時間外勤務手当 + 差額（二重計上しない）
 *  - 管理監督者: 深夜割増のみ（固定残業対象外）
 *  - 所得税・社保は金額0の未計上プレースホルダ
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  MonthlyClosing,
  WagePremiumBreakdown,
  Yen,
} from "@dgloss-kintai/contracts";
import { buildPayslip } from "./payslip.js";
import { makeEmployee } from "./testFixtures.js";

const asYen = (n: number): Yen => n as Yen;

/** テスト用の割増内訳（total は自動合算）。 */
function premium(
  parts: Partial<Omit<WagePremiumBreakdown, "total">> = {},
): WagePremiumBreakdown {
  const overtimeAllowance = asYen(parts.overtimeAllowance ?? 0);
  const overtimeOver60Allowance = asYen(parts.overtimeOver60Allowance ?? 0);
  const holidayAllowance = asYen(parts.holidayAllowance ?? 0);
  const nightAllowance = asYen(parts.nightAllowance ?? 0);
  return {
    overtimeAllowance,
    overtimeOver60Allowance,
    holidayAllowance,
    nightAllowance,
    total: asYen(
      overtimeAllowance +
        overtimeOver60Allowance +
        holidayAllowance +
        nightAllowance,
    ),
  };
}

/** テスト用の月次締めを組み立てる。 */
function makeClosing(
  employee: Employee,
  overrides: {
    premium?: WagePremiumBreakdown;
    fixedOvertimeAdditionalPayment?: number;
    latenessDeduction?: number;
  } = {},
): MonthlyClosing {
  return {
    id: `${employee.id}:2026-07` as MonthlyClosing["id"],
    employeeId: employee.id,
    period: { year: 2026, month: 7 },
    status: "closed",
    totalWorkedMinutes: 9600 as MonthlyClosing["totalWorkedMinutes"],
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
    premium: overrides.premium ?? premium(),
    fixedOvertimeAdditionalPayment: asYen(
      overrides.fixedOvertimeAdditionalPayment ?? 0,
    ),
    latenessDeduction: asYen(overrides.latenessDeduction ?? 0),
    closedAt: "2026-07-31T18:00:00+09:00",
  };
}

describe("buildPayslip", () => {
  it("固定残業なし: 基本給 + 実割増内訳、総支給・差引支給を確定する", () => {
    const employee = makeEmployee("A", { basicSalary: 300_000 });
    // 割増合計 26,054 円、遅刻早退控除 2,842 円。
    const closing = makeClosing(employee, {
      premium: premium({
        overtimeAllowance: 20_000,
        holidayAllowance: 4_054,
        nightAllowance: 2_000,
      }),
      latenessDeduction: 2_842,
    });

    const slip = buildPayslip(closing, employee);

    // 支給: 基本給 + 時間外 + 休日 + 深夜（60h超はゼロなので出さない）。
    expect(slip.earnings.map((l) => l.label)).toEqual([
      "基本給",
      "時間外勤務手当",
      "休日勤務手当",
      "深夜勤務手当",
    ]);
    expect(slip.grossPay).toBe(326_054);
    expect(slip.totalDeductions).toBe(2_842);
    expect(slip.netBeforeStatutory).toBe(323_212);
  });

  it("割増ゼロなら支給は基本給のみ・控除ゼロ", () => {
    const employee = makeEmployee("B", { basicSalary: 250_000 });
    const closing = makeClosing(employee);

    const slip = buildPayslip(closing, employee);

    expect(slip.earnings).toHaveLength(1);
    expect(slip.earnings[0]?.label).toBe("基本給");
    expect(slip.grossPay).toBe(250_000);
    expect(slip.deductions).toHaveLength(0);
    expect(slip.totalDeductions).toBe(0);
    expect(slip.netBeforeStatutory).toBe(250_000);
  });

  it("固定残業あり: 基本給 + 固定時間外勤務手当 + 差額（実割増を二重計上しない）", () => {
    const employee = makeEmployee("C", {
      basicSalary: 300_000,
      fixedOvertimeAllowance: 45_000,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: true,
        holiday: true,
        night: true,
      },
    });
    // 実割増 60,000 円 → 固定 45,000 を超過し差額 15,000 円が支給される想定。
    const closing = makeClosing(employee, {
      premium: premium({ overtimeAllowance: 60_000 }),
      fixedOvertimeAdditionalPayment: 15_000,
    });

    const slip = buildPayslip(closing, employee);

    expect(slip.earnings.map((l) => l.label)).toEqual([
      "基本給",
      "固定時間外勤務手当",
      "時間外勤務手当（差額）",
    ]);
    // 300,000 + 45,000 + 15,000。実割増 60,000 をそのまま足さない（＝345,000+差額）。
    expect(slip.grossPay).toBe(360_000);
  });

  it("固定残業あり・差額ゼロ: 固定時間外勤務手当のみ（差額行は出さない）", () => {
    const employee = makeEmployee("D", {
      basicSalary: 300_000,
      fixedOvertimeAllowance: 45_000,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: true,
        holiday: true,
        night: true,
      },
    });
    const closing = makeClosing(employee, {
      premium: premium({ overtimeAllowance: 30_000 }),
      fixedOvertimeAdditionalPayment: 0,
    });

    const slip = buildPayslip(closing, employee);

    expect(slip.earnings.map((l) => l.label)).toEqual([
      "基本給",
      "固定時間外勤務手当",
    ]);
    expect(slip.grossPay).toBe(345_000);
  });

  it("管理監督者: 深夜割増のみ（固定残業対象外・時間外は出さない）", () => {
    const employee = makeEmployee("E", {
      basicSalary: 500_000,
      isManagerialEmployee: true,
      // 管理監督者でも固定額が設定されていても支給しない。
      fixedOvertimeAllowance: 45_000,
    });
    const closing = makeClosing(employee, {
      premium: premium({ nightAllowance: 8_000 }),
    });

    const slip = buildPayslip(closing, employee);

    expect(slip.earnings.map((l) => l.label)).toEqual([
      "基本給",
      "深夜勤務手当",
    ]);
    expect(slip.grossPay).toBe(508_000);
  });

  it("通勤手当を総支給に含める", () => {
    const employee = makeEmployee("F", { basicSalary: 300_000 });
    const closing = makeClosing(employee);

    const slip = buildPayslip(closing, employee, {
      commuteAllowance: asYen(12_400),
    });

    expect(slip.earnings.map((l) => l.label)).toEqual(["基本給", "通勤手当"]);
    expect(slip.grossPay).toBe(312_400);
  });

  it("所得税・社会保険料は金額0の未計上プレースホルダとして出す", () => {
    const employee = makeEmployee("G", { basicSalary: 300_000 });
    const closing = makeClosing(employee);

    const slip = buildPayslip(closing, employee);

    expect(slip.statutoryPlaceholders.map((l) => l.label)).toEqual([
      "所得税",
      "社会保険料",
    ]);
    expect(slip.statutoryPlaceholders.every((l) => l.amount === 0)).toBe(true);
    // 差引支給額は法定控除を差し引く前の額に一致する。
    expect(slip.netBeforeStatutory).toBe(slip.grossPay);
  });

  it("従業員・期間は締めから引き継ぐ", () => {
    const employee = makeEmployee("H");
    const closing = makeClosing(employee);

    const slip = buildPayslip(closing, employee);

    expect(slip.employeeId).toBe(employee.id);
    expect(slip.period).toEqual({ year: 2026, month: 7 });
  });
});
