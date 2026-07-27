/**
 * buildComplianceReport のテスト（労基法第36条・上限規制）。
 * 月次締めの区分別労働時間から時間外を集計し、上限評価が反映されることを検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  ClassifiedWorkMinutes,
  MonthlyClosing,
  Minutes,
  Yen,
} from "@dgloss-kintai/contracts";
import { buildComplianceReport } from "./complianceReport.js";

const asYen = (n: number): Yen => n as Yen;

function closing(
  year: number,
  month: number,
  classified: Partial<ClassifiedWorkMinutes>,
): MonthlyClosing {
  return {
    id: `emp_1:${year}-${month}` as MonthlyClosing["id"],
    employeeId: "emp_1" as MonthlyClosing["employeeId"],
    period: { year, month },
    status: "closed",
    totalWorkedMinutes: 0 as Minutes,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
      ...classified,
    },
    premium: {
      overtimeAllowance: asYen(0),
      overtimeOver60Allowance: asYen(0),
      holidayAllowance: asYen(0),
      nightAllowance: asYen(0),
      total: asYen(0),
    },
    fixedOvertimeAdditionalPayment: asYen(0),
    latenessDeduction: asYen(0),
    closedAt: null,
  };
}

describe("buildComplianceReport", () => {
  it("時間外が上限内なら違反なし（ok）", () => {
    const result = buildComplianceReport([
      closing(2026, 4, { statutoryOvertimeMinutes: 30 * 60 }),
      closing(2026, 5, { statutoryOvertimeMinutes: 20 * 60 }),
    ]);
    expect(result.report.hasViolation).toBe(false);
    expect(result.monthly).toHaveLength(2);
    expect(result.monthly[0]?.overtimeMinutes).toBe(30 * 60);
  });

  it("単月の時間外が45時間を超えたら超過（exceeded）を検知する", () => {
    const result = buildComplianceReport([
      closing(2026, 4, { statutoryOvertimeMinutes: 50 * 60 }),
    ]);
    expect(result.report.hasViolation).toBe(true);
    const monthly = result.report.alerts.find(
      (a) => a.check === "monthly_overtime",
    );
    expect(monthly?.level).toBe("exceeded");
  });

  it("時間外＋休日が単月100時間以上なら超過を検知する", () => {
    const result = buildComplianceReport([
      closing(2026, 4, {
        statutoryOvertimeMinutes: 60 * 60,
        legalHolidayMinutes: 45 * 60,
      }),
    ]);
    const withHoliday = result.report.alerts.find(
      (a) => a.check === "monthly_with_holiday",
    );
    expect(withHoliday?.level).toBe("exceeded");
    expect(result.report.hasViolation).toBe(true);
  });

  it("空の系列は違反なし", () => {
    const result = buildComplianceReport([]);
    expect(result.report.hasViolation).toBe(false);
    expect(result.report.worstLevel).toBe("ok");
  });
});
