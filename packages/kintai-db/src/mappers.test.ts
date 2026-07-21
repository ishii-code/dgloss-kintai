/**
 * マッパー（純粋関数）の単体テスト。
 *
 * Prisma 行相当のオブジェクト（Date を持つ）とドメイン型の往復同値を検証する。
 * 実 DB 接続は要ライブ DB のため本パッケージのスコープ外（統合テストは別途）。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  IsoDate,
  IsoDateTime,
  Minutes,
  MonthlyClosing,
  MonthlyClosingId,
  Stamp,
  StampId,
  WorkDay,
  WorkDayId,
  Yen,
} from "@dgloss-kintai/contracts";
import type {
  Employee as EmployeeRow,
  EmploymentContract as EmploymentContractRow,
  MonthlyClosing as MonthlyClosingRow,
  Stamp as StampRow,
  WorkDay as WorkDayRow,
} from "@prisma/client";
import {
  dateToIsoDate,
  dateToIsoDateTime,
  employeeRowToDomain,
  employeeToRow,
  isoDateTimeToDate,
  isoDateToDate,
  monthlyClosingRowToDomain,
  monthlyClosingToRow,
  stampRowToDomain,
  stampToRow,
  workDayRowToDomain,
  workDayToRow,
} from "./mappers.js";

describe("日付・時刻ヘルパー", () => {
  it("IsoDate ↔ Date（@db.Date）を往復する", () => {
    expect(dateToIsoDate(isoDateToDate("2025-07-01"))).toBe("2025-07-01");
    expect(isoDateToDate("2025-07-01").toISOString()).toBe(
      "2025-07-01T00:00:00.000Z",
    );
  });

  it("IsoDateTime（JST）↔ Date を往復する", () => {
    const iso = "2025-07-01T09:00:00+09:00";
    expect(dateToIsoDateTime(isoDateTimeToDate(iso))).toBe(iso);
    // JST 09:00 は UTC 00:00 の瞬間。
    expect(isoDateTimeToDate(iso).toISOString()).toBe(
      "2025-07-01T00:00:00.000Z",
    );
  });

  it("日跨ぎの JST 深夜も正しく整形する", () => {
    const iso = "2025-07-01T00:30:00+09:00";
    expect(dateToIsoDateTime(isoDateTimeToDate(iso))).toBe(iso);
  });
});

describe("Stamp マッパー", () => {
  const stamp: Stamp = {
    id: "stamp-1" as StampId,
    employeeId: "emp-1" as EmployeeId,
    type: "clock_in",
    stampedAt: "2025-07-01T09:00:00+09:00" as IsoDateTime,
    source: "ic_card",
    note: "本社入館",
  };

  it("domain → row → domain で同値", () => {
    expect(stampRowToDomain(stampToRow(stamp))).toEqual(stamp);
  });

  it("row → domain → row で同値", () => {
    const row: StampRow = {
      id: "stamp-9",
      employeeId: "emp-9",
      type: "clock_out",
      stampedAt: new Date("2025-07-01T09:30:00.000Z"),
      source: "manual",
      note: null,
    };
    expect(stampToRow(stampRowToDomain(row))).toEqual(row);
  });
});

describe("WorkDay マッパー", () => {
  const workDay: WorkDay = {
    id: "wd-1" as WorkDayId,
    employeeId: "emp-1" as EmployeeId,
    date: "2025-07-01" as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: 480 as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 30,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 15,
    },
  };

  it("domain → row → domain で同値", () => {
    expect(workDayRowToDomain(workDayToRow(workDay))).toEqual(workDay);
  });

  it("休暇・休日（null 項目あり）でも往復する", () => {
    const holiday: WorkDay = {
      ...workDay,
      dayType: "legal_holiday",
      scheduledStart: null,
      scheduledEnd: null,
      leave: "paid_half",
    };
    expect(workDayRowToDomain(workDayToRow(holiday))).toEqual(holiday);
  });

  it("row → domain → row で同値", () => {
    const row: WorkDayRow = {
      id: "wd-9",
      employeeId: "emp-9",
      date: new Date("2025-07-15T00:00:00.000Z"),
      dayType: "scheduled_holiday",
      scheduledStart: null,
      scheduledEnd: null,
      actualWorkedMinutes: 0,
      breakMinutes: 0,
      absenceMinutes: 0,
      leave: "absence",
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    };
    expect(workDayToRow(workDayRowToDomain(row))).toEqual(row);
  });
});

describe("MonthlyClosing マッパー", () => {
  const closing: MonthlyClosing = {
    id: "mc-1" as MonthlyClosingId,
    employeeId: "emp-1" as EmployeeId,
    period: { year: 2025, month: 7 },
    status: "closed",
    totalWorkedMinutes: 9600 as Minutes,
    classified: {
      nonStatutoryOvertimeMinutes: 600,
      statutoryOvertimeMinutes: 120,
      legalHolidayMinutes: 480,
      scheduledHolidayMinutes: 0,
      nightMinutes: 90,
    },
    premium: {
      overtimeAllowance: 15000 as Yen,
      overtimeOver60Allowance: 0 as Yen,
      holidayAllowance: 8000 as Yen,
      nightAllowance: 2000 as Yen,
      total: 25000 as Yen,
    },
    fixedOvertimeAdditionalPayment: 3000 as Yen,
    latenessDeduction: 1500 as Yen,
    closedAt: "2025-08-01T10:00:00+09:00",
  };

  it("domain → row → domain で同値（closed）", () => {
    expect(monthlyClosingRowToDomain(monthlyClosingToRow(closing))).toEqual(
      closing,
    );
  });

  it("open（closedAt=null）でも往復する", () => {
    const open: MonthlyClosing = {
      ...closing,
      status: "open",
      closedAt: null,
    };
    expect(monthlyClosingRowToDomain(monthlyClosingToRow(open))).toEqual(open);
  });

  it("row → domain → row で同値", () => {
    const row: MonthlyClosingRow = {
      id: "mc-9",
      employeeId: "emp-9",
      year: 2025,
      month: 12,
      status: "open",
      totalWorkedMinutes: 8000,
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
      overtimeAllowance: 0,
      overtimeOver60Allowance: 0,
      holidayAllowance: 0,
      nightAllowance: 0,
      premiumTotal: 0,
      fixedOvertimeAdditionalPayment: 0,
      latenessDeduction: 0,
      closedAt: null,
    };
    expect(monthlyClosingToRow(monthlyClosingRowToDomain(row))).toEqual(row);
  });
});

describe("Employee マッパー", () => {
  const employee: Employee = {
    id: "emp-1" as EmployeeId,
    employeeCode: "EMP-001",
    name: "山田 太郎",
    email: "taro@example.com",
    hiredOn: "2020-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "flex",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300000 as Yen,
      annualScheduledWorkingHours: 1920,
      fixedOvertimeAllowance: 45000 as Yen,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: false,
        holiday: false,
        night: true,
      },
    },
  };

  it("domain → row → domain で同値", () => {
    expect(employeeRowToDomain(employeeToRow(employee))).toEqual(employee);
  });

  it("退職者（retiredOn あり・email null）でも往復する", () => {
    const retired: Employee = {
      ...employee,
      email: null,
      retiredOn: "2025-03-31",
    };
    expect(employeeRowToDomain(employeeToRow(retired))).toEqual(retired);
  });

  it("row（契約 include）→ domain で読める", () => {
    const contractRow: EmploymentContractRow = {
      id: "emp-9",
      employeeId: "emp-9",
      employmentType: "regular",
      workSystem: "fixed",
      office: "corporate_sales",
      isManagerialEmployee: true,
      basicSalary: 400000,
      annualScheduledWorkingHours: 2000,
      fixedOvertimeAllowance: 0,
      coverageOvertime: false,
      coverageOvertimeOver60: false,
      coverageHoliday: false,
      coverageNight: false,
    };
    const row: EmployeeRow & { contract: EmploymentContractRow } = {
      id: "emp-9",
      employeeCode: "EMP-009",
      name: "佐藤 花子",
      email: null,
      hiredOn: new Date("2019-10-01T00:00:00.000Z"),
      retiredOn: null,
      contract: contractRow,
    };
    const domain = employeeRowToDomain(row);
    expect(domain.contract.isManagerialEmployee).toBe(true);
    expect(domain.hiredOn).toBe("2019-10-01");
    expect(domain.contract.office).toBe("corporate_sales");
  });
});
