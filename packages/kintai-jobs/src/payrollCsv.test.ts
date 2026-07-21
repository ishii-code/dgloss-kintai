import { describe, it, expect } from "vitest";
import {
  toPayrollCsvRow,
  serializePayrollCsv,
  buildPayrollCsv,
  PAYROLL_CSV_COLUMNS,
  type PayrollCsvRow,
} from "./payrollCsv.js";
import { makeEmployee } from "./testFixtures.js";
import type {
  EmployeeId,
  Minutes,
  MonthlyClosing,
  MonthlyClosingId,
  WagePremiumBreakdown,
  YearMonth,
  Yen,
} from "@dgloss-kintai/contracts";

const zeroClassified = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
};

const zeroPremium: WagePremiumBreakdown = {
  overtimeAllowance: 0 as Yen,
  overtimeOver60Allowance: 0 as Yen,
  holidayAllowance: 0 as Yen,
  nightAllowance: 0 as Yen,
  total: 0 as Yen,
};

/** テスト用 MonthlyClosing ビルダ。 */
function makeClosing(
  employeeId: string,
  period: YearMonth,
  overrides: {
    totalWorkedMinutes?: number;
    premium?: Partial<WagePremiumBreakdown>;
    fixedOvertimeAdditionalPayment?: number;
    latenessDeduction?: number;
  } = {},
): MonthlyClosing {
  const mm = String(period.month).padStart(2, "0");
  return {
    id: `${employeeId}:${period.year}-${mm}` as MonthlyClosingId,
    employeeId: employeeId as EmployeeId,
    period,
    status: "closed",
    totalWorkedMinutes: (overrides.totalWorkedMinutes ?? 0) as Minutes,
    classified: zeroClassified,
    premium: { ...zeroPremium, ...overrides.premium },
    fixedOvertimeAdditionalPayment: (overrides.fixedOvertimeAdditionalPayment ??
      0) as Yen,
    latenessDeduction: (overrides.latenessDeduction ?? 0) as Yen,
    closedAt: "2025-08-01T00:00:00+09:00",
  };
}

const period: YearMonth = { year: 2025, month: 7 };

describe("PAYROLL_CSV_COLUMNS", () => {
  it("列順（ヘッダ）が固定である", () => {
    expect(PAYROLL_CSV_COLUMNS.map((c) => c.header)).toEqual([
      "社員番号",
      "氏名",
      "対象年月",
      "総労働時間",
      "時間外勤務手当",
      "時間外60h超勤務手当",
      "休日勤務手当",
      "深夜勤務手当",
      "割増合計",
      "固定残業差額支給",
      "遅刻早退控除",
    ]);
  });
});

describe("toPayrollCsvRow", () => {
  it("締めと従業員から行データへ写像する", () => {
    const closing = makeClosing("E1", period, {
      totalWorkedMinutes: 980,
      premium: {
        overtimeAllowance: 12000 as Yen,
        overtimeOver60Allowance: 3000 as Yen,
        holidayAllowance: 4000 as Yen,
        nightAllowance: 1500 as Yen,
        total: 20500 as Yen,
      },
      fixedOvertimeAdditionalPayment: 500,
      latenessDeduction: 800,
    });
    const employee = makeEmployee("E1", {}, {
      employeeCode: "EMP-0001",
      name: "山田 太郎",
    });
    const row = toPayrollCsvRow(closing, employee);
    expect(row).toEqual<PayrollCsvRow>({
      employeeCode: "EMP-0001",
      employeeName: "山田 太郎",
      period: "2025-07",
      totalWorkedMinutes: 980,
      overtimeAllowanceYen: 12000,
      overtimeOver60AllowanceYen: 3000,
      holidayAllowanceYen: 4000,
      nightAllowanceYen: 1500,
      premiumTotalYen: 20500,
      fixedOvertimeAdditionalPaymentYen: 500,
      latenessDeductionYen: 800,
    });
  });

  it("従業員未指定なら社員番号は employeeId・氏名は空文字", () => {
    const closing = makeClosing("E9", period);
    const row = toPayrollCsvRow(closing);
    expect(row.employeeCode).toBe("E9");
    expect(row.employeeName).toBe("");
  });
});

describe("serializePayrollCsv", () => {
  const baseRow: PayrollCsvRow = {
    employeeCode: "EMP-0001",
    employeeName: "山田 太郎",
    period: "2025-07",
    totalWorkedMinutes: 980,
    overtimeAllowanceYen: 12000,
    overtimeOver60AllowanceYen: 3000,
    holidayAllowanceYen: 4000,
    nightAllowanceYen: 1500,
    premiumTotalYen: 20500,
    fixedOvertimeAdditionalPaymentYen: 500,
    latenessDeductionYen: 800,
  };

  const header =
    "社員番号,氏名,対象年月,総労働時間,時間外勤務手当,時間外60h超勤務手当,休日勤務手当,深夜勤務手当,割増合計,固定残業差額支給,遅刻早退控除";

  it("空配列でもヘッダ行のみを出力する", () => {
    expect(serializePayrollCsv([])).toBe(header);
  });

  it("既定は CRLF・時間は h:mm・BOM なし", () => {
    const csv = serializePayrollCsv([baseRow]);
    expect(csv).toBe(
      `${header}\r\nEMP-0001,山田 太郎,2025-07,16:20,12000,3000,4000,1500,20500,500,800`,
    );
  });

  it("timeFormat=minutes で時間を分のまま出力する", () => {
    const csv = serializePayrollCsv([baseRow], { timeFormat: "minutes" });
    expect(csv).toContain(",980,12000,");
  });

  it("newline=lf で LF 区切りにする", () => {
    const csv = serializePayrollCsv([baseRow], { newline: "lf" });
    expect(csv).toBe(
      `${header}\nEMP-0001,山田 太郎,2025-07,16:20,12000,3000,4000,1500,20500,500,800`,
    );
    expect(csv).not.toContain("\r\n");
  });

  it("bom=true で UTF-8 BOM を先頭に付与する", () => {
    const csv = serializePayrollCsv([], { bom: true });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toBe(`﻿${header}`);
  });

  it("bom 既定（false）では BOM を付けない", () => {
    const csv = serializePayrollCsv([]);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it("RFC4180: カンマ・クオート・改行を含む氏名をエスケープする", () => {
    const rows: PayrollCsvRow[] = [
      { ...baseRow, employeeName: "田中, 花子" },
      { ...baseRow, employeeName: 'あだ名 "エース"' },
      { ...baseRow, employeeName: "改行\nあり" },
    ];
    const csv = serializePayrollCsv(rows, { newline: "lf" });
    const dataLines = csv.split("\n");
    // カンマ入り → 全体を "" で囲む
    expect(dataLines[1]).toContain('"田中, 花子"');
    // クオート入り → 囲んだ上で " を "" に二重化
    expect(csv).toContain('"あだ名 ""エース"""');
    // 改行入り → フィールド内に生の改行を保持（囲みで1レコードのまま）
    expect(csv).toContain('"改行\nあり"');
  });

  it("複数行を順に出力する", () => {
    const csv = serializePayrollCsv(
      [
        { ...baseRow, employeeCode: "A" },
        { ...baseRow, employeeCode: "B" },
      ],
      { newline: "lf" },
    );
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3); // header + 2
    expect(lines[1]?.startsWith("A,")).toBe(true);
    expect(lines[2]?.startsWith("B,")).toBe(true);
  });
});

describe("buildPayrollCsv", () => {
  it("締め配列と従業員マスタを id で突合して一括生成する", () => {
    const closings = [
      makeClosing("E1", period, { totalWorkedMinutes: 600 }),
      makeClosing("E2", period, { totalWorkedMinutes: 720 }),
    ];
    const employees = [
      makeEmployee("E1", {}, { employeeCode: "EMP-0001", name: "一郎" }),
      makeEmployee("E2", {}, { employeeCode: "EMP-0002", name: "二郎" }),
    ];
    const csv = buildPayrollCsv(closings, employees, { newline: "lf" });
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]?.startsWith("EMP-0001,一郎,2025-07,10:00,")).toBe(true);
    expect(lines[2]?.startsWith("EMP-0002,二郎,2025-07,12:00,")).toBe(true);
  });

  it("突合する従業員がなければ employeeId・空氏名でフォールバックする", () => {
    const csv = buildPayrollCsv([makeClosing("E9", period)], [], {
      newline: "lf",
    });
    const lines = csv.split("\n");
    expect(lines[1]?.startsWith("E9,,2025-07,")).toBe(true);
  });
});
