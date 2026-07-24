/**
 * 給与 CSV 生成（純粋関数）のユニットテスト。
 * ヘッダ・行数・RFC4180 エスケープ・BOM を確認する。
 */

import { describe, it, expect } from "vitest";
import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  Yen,
} from "@dgloss-kintai/contracts";

import { buildPayrollCsv, PAYROLL_CSV_COLUMNS } from "./payrollCsv";

const EMP_ID = "emp_demo" as EmployeeId;

function makeClosing(): MonthlyClosing {
  return {
    id: "mc_1" as MonthlyClosing["id"],
    employeeId: EMP_ID,
    period: { year: 2026, month: 6 },
    status: "closed",
    totalWorkedMinutes: 9_600 as MonthlyClosing["totalWorkedMinutes"],
    classified: {
      nonStatutoryOvertimeMinutes: 1_200,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 240,
      scheduledHolidayMinutes: 0,
      nightMinutes: 120,
    },
    premium: {
      overtimeAllowance: 45_000 as Yen,
      overtimeOver60Allowance: 0 as Yen,
      holidayAllowance: 12_000 as Yen,
      nightAllowance: 3_000 as Yen,
      total: 60_000 as Yen,
    },
    fixedOvertimeAdditionalPayment: 0 as Yen,
    latenessDeduction: 1_500 as Yen,
    closedAt: "2026-06-28T18:00:00+09:00",
  };
}

function makeEmployee(name: string): Employee {
  return {
    id: EMP_ID,
    employeeCode: "0001",
    name,
    email: null,
    hiredOn: "2024-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300_000 as Yen,
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: 0 as Yen,
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

describe("buildPayrollCsv", () => {
  it("ヘッダ行＋データ行を出力する", () => {
    const csv = buildPayrollCsv([makeClosing()], [makeEmployee("デモ 太郎")]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(PAYROLL_CSV_COLUMNS.map((c) => c.header).join(","));
    expect(lines[1]).toContain("0001");
    expect(lines[1]).toContain("デモ 太郎");
    expect(lines[1]).toContain("2026-06");
  });

  it("カンマを含む氏名は RFC4180 でクオートされる", () => {
    const csv = buildPayrollCsv([makeClosing()], [makeEmployee("山田, 花子")]);
    expect(csv).toContain('"山田, 花子"');
  });

  it("BOM 付きオプションで先頭に U+FEFF を付与する", () => {
    const csv = buildPayrollCsv([makeClosing()], [], { bom: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });
});
