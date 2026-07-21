import { describe, it, expect } from "vitest";
import {
  calculateWagePremium,
  calculateLatenessDeduction,
  settleWithFixedOvertime,
} from "@dgloss-kintai/core";
import type { YearMonth } from "@dgloss-kintai/contracts";
import { runMonthlyClosing } from "./monthlyClosing.js";
import { fixedClock } from "./ports.js";
import { makeEmployee, makeWorkDay } from "./testFixtures.js";

const period: YearMonth = { year: 2025, month: 7 };
const clock = fixedClock(new Date("2025-08-01T00:00:00.000Z"));

describe("runMonthlyClosing", () => {
  it("非管理監督者・固定残業なし: 割増を算定し closing を確定する", () => {
    // basicSalary 300000 / 年間2000h。時間外20h(1200分)のみ。
    const employee = makeEmployee("E1");
    const days = [
      makeWorkDay("E1", "2025-07-10", {
        classified: { statutoryOvertimeMinutes: 1200 },
      }),
    ];

    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });

    // ハンド計算アンカー: 300000×12×(125×1200) ÷ (120000×100) = 45000
    expect(closing.premium.overtimeAllowance).toBe(45000);
    expect(closing.premium.total).toBe(45000);
    expect(closing.fixedOvertimeAdditionalPayment).toBe(0);
    expect(closing.latenessDeduction).toBe(0);
    expect(closing.status).toBe("closed");
    expect(closing.closedAt).toBe("2025-08-01T00:00:00.000Z");
    expect(closing.id).toBe("E1:2025-07");
    expect(closing.employeeId).toBe("E1");
    expect(closing.totalWorkedMinutes).toBe(480);

    // core と整合。
    expect(closing.premium.total).toBe(
      calculateWagePremium(
        { basicSalary: 300000, isManagerialEmployee: false },
        closing.classified,
        { annualScheduledWorkingHours: 2000 },
      ).total,
    );
  });

  it("管理監督者: 深夜のみ支給、他区分は 0、固定残業差額も 0", () => {
    const employee = makeEmployee("M1", {
      isManagerialEmployee: true,
      fixedOvertimeAllowance: 30000,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: true,
        holiday: true,
        night: true,
      },
    });
    const days = [
      makeWorkDay("M1", "2025-07-10", {
        classified: {
          statutoryOvertimeMinutes: 1200,
          legalHolidayMinutes: 480,
          nightMinutes: 600, // 深夜10h
        },
      }),
    ];

    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });

    // 深夜のみ: 300000×12×(25×600) ÷ 12,000,000 = 4500
    expect(closing.premium.nightAllowance).toBe(4500);
    expect(closing.premium.overtimeAllowance).toBe(0);
    expect(closing.premium.holidayAllowance).toBe(0);
    expect(closing.premium.overtimeOver60Allowance).toBe(0);
    expect(closing.premium.total).toBe(4500);
    // 管理監督者には固定時間外勤務手当を支給しない（第18条2項）。
    expect(closing.fixedOvertimeAdditionalPayment).toBe(0);
  });

  it("固定残業あり(充当>固定額): 差額を支給する（第20条4項）", () => {
    const employee = makeEmployee("F1", {
      fixedOvertimeAllowance: 30000,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    });
    const days = [
      makeWorkDay("F1", "2025-07-10", {
        classified: { statutoryOvertimeMinutes: 1200 }, // overtimeAllowance=45000
      }),
    ];

    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });

    // covered(overtime)=45000, fixed=30000 → 差額 15000
    expect(closing.premium.overtimeAllowance).toBe(45000);
    expect(closing.fixedOvertimeAdditionalPayment).toBe(15000);

    // core と整合。
    const settled = settleWithFixedOvertime(
      {
        overtimeAllowance: 45000,
        overtimeOver60Allowance: 0,
        holidayAllowance: 0,
        nightAllowance: 0,
        total: 45000,
      },
      {
        fixedOvertimeAllowance: 30000,
        coveredComponents: {
          overtime: true,
          overtimeOver60: false,
          holiday: false,
          night: false,
        },
      },
    );
    expect(closing.fixedOvertimeAdditionalPayment).toBe(settled.additionalPayment);
  });

  it("固定残業あり(固定額>=充当): 差額は 0", () => {
    const employee = makeEmployee("F2", {
      fixedOvertimeAllowance: 50000,
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    });
    const days = [
      makeWorkDay("F2", "2025-07-10", {
        classified: { statutoryOvertimeMinutes: 1200 }, // 45000 < 50000
      }),
    ];
    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });
    expect(closing.fixedOvertimeAdditionalPayment).toBe(0);
  });

  it("遅刻早退控除: absenceMinutes 合計から控除を算定する（第21条）", () => {
    const employee = makeEmployee("L1");
    const days = [
      makeWorkDay("L1", "2025-07-10", { absenceMinutes: 60 }),
      makeWorkDay("L1", "2025-07-11", { absenceMinutes: 60 }),
    ];
    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });

    // 300000×12×120 ÷ 120000 = 3600（切り捨て）
    expect(closing.latenessDeduction).toBe(3600);
    expect(closing.latenessDeduction).toBe(
      calculateLatenessDeduction({ basicSalary: 300000 }, 120, {
        annualScheduledWorkingHours: 2000,
      }),
    );
  });

  it("労働ゼロ月: 全額 0 で closing を確定する（境界）", () => {
    const employee = makeEmployee("Z1");
    const closing = runMonthlyClosing(
      { employee, workDays: [], period },
      { clock },
    );
    expect(closing.totalWorkedMinutes).toBe(0);
    expect(closing.premium.total).toBe(0);
    expect(closing.fixedOvertimeAdditionalPayment).toBe(0);
    expect(closing.latenessDeduction).toBe(0);
    expect(closing.status).toBe("closed");
    expect(closing.closedAt).toBe("2025-08-01T00:00:00.000Z");
    expect(closing.classified).toEqual({
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    });
  });

  it("期間外・他従業員の WorkDay は締めに含めない", () => {
    const employee = makeEmployee("E1");
    const days = [
      makeWorkDay("E1", "2025-07-10", { classified: { statutoryOvertimeMinutes: 1200 } }),
      makeWorkDay("E1", "2025-08-10", { classified: { statutoryOvertimeMinutes: 6000 } }), // 期間外
      makeWorkDay("E2", "2025-07-10", { classified: { statutoryOvertimeMinutes: 6000 } }), // 他従業員
    ];
    const closing = runMonthlyClosing({ employee, workDays: days, period }, { clock });
    expect(closing.classified.statutoryOvertimeMinutes).toBe(1200);
    expect(closing.premium.overtimeAllowance).toBe(45000);
  });

  it("不正な年間所定労働時間は例外を投げる", () => {
    const employee = makeEmployee("B1", { annualScheduledWorkingHours: 0 });
    expect(() =>
      runMonthlyClosing({ employee, workDays: [], period }, { clock }),
    ).toThrow();
  });
});
