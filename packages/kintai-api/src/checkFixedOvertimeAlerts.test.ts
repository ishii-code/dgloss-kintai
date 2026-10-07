/**
 * checkFixedOvertimeAlerts ユースケースのテスト。
 * 事業部絞り込み・固定残業超過判定・初回のみ通知（冪等）を検証する。
 */

import { describe, expect, it } from "vitest";
import type {
  Employee,
  EmployeeId,
  IsoDateTime,
  Minutes,
  WorkDay,
  Yen,
} from "@dgloss-kintai/contracts";
import { checkFixedOvertimeAlerts } from "./checkFixedOvertimeAlerts.js";
import {
  CollectingOvertimeAlertNotifier,
  FixedClock,
  InMemoryEmployeeRepository,
  InMemoryOvertimeAlertStateRepository,
  InMemoryWorkDayRepository,
} from "./inMemory.js";

const asYen = (n: number): Yen => n as Yen;

interface EmpOpts {
  readonly department?: string | null;
  readonly fixedOvertimeAllowance?: number;
  readonly isManagerialEmployee?: boolean;
}

function employee(id: string, code: string, opts: EmpOpts = {}): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: code,
    name: `従業員 ${code}`,
    email: null,
    hiredOn: "2020-04-01",
    retiredOn: null,
    department: opts.department ?? null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: opts.isManagerialEmployee ?? false,
      basicSalary: asYen(300_000),
      annualScheduledWorkingHours: 1900,
      fixedOvertimeAllowance: asYen(opts.fixedOvertimeAllowance ?? 0),
      fixedOvertimeCoverage: {
        overtime: true,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
  };
}

function workDay(employeeId: string, date: string, overtimeMin: number): WorkDay {
  return {
    id: `wd_${employeeId}_${date}` as WorkDay["id"],
    employeeId: employeeId as EmployeeId,
    date: date as WorkDay["date"],
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: (480 + overtimeMin) as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: overtimeMin,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
  };
}

const INPUT = {
  period: { year: 2026, month: 7 },
  asOf: "2026-07-20",
  departments: ["パートナー事業部", "AIテレアポ事業部"],
};

function makeDeps(employees: readonly Employee[], workDays: readonly WorkDay[]) {
  return {
    employees: new InMemoryEmployeeRepository(employees),
    workDays: new InMemoryWorkDayRepository(workDays),
    alertState: new InMemoryOvertimeAlertStateRepository(),
    notifier: new CollectingOvertimeAlertNotifier(),
    clock: new FixedClock("2026-07-20T19:00:00+09:00" as IsoDateTime),
  };
}

describe("checkFixedOvertimeAlerts", () => {
  it("対象事業部で固定残業を超過した従業員を検出し通知する", async () => {
    const emps = [
      employee("emp_1", "0001", {
        department: "パートナー事業部",
        fixedOvertimeAllowance: 1_000,
      }),
    ];
    // 1,000 円の固定枠に対し 20h の時間外 → 割増は固定枠を大きく超過する。
    const wds = [
      workDay("emp_1", "2026-07-01", 600),
      workDay("emp_1", "2026-07-02", 600),
    ];
    const deps = makeDeps(emps, wds);
    const result = await checkFixedOvertimeAlerts(INPUT, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggeredCount).toBe(1);
    expect(result.value.alerts[0]?.employeeCode).toBe("0001");
    expect(result.value.alerts[0]?.additionalPayment).toBeGreaterThan(0);
    expect(result.value.alerts[0]?.department).toBe("パートナー事業部");
    expect(deps.notifier.sent).toHaveLength(1);
  });

  it("同一従業員・同一年月は二度通知しない（冪等）", async () => {
    const emps = [
      employee("emp_1", "0001", {
        department: "AIテレアポ事業部",
        fixedOvertimeAllowance: 1_000,
      }),
    ];
    const wds = [workDay("emp_1", "2026-07-01", 1_200)];
    const deps = makeDeps(emps, wds);

    const first = await checkFixedOvertimeAlerts(INPUT, deps);
    const second = await checkFixedOvertimeAlerts(INPUT, deps);
    expect(first.ok && first.value.triggeredCount).toBe(1);
    expect(second.ok && second.value.triggeredCount).toBe(0);
    expect(second.ok && second.value.alreadyNotifiedCount).toBe(1);
    // 通知は初回の1回だけ。
    expect(deps.notifier.sent).toHaveLength(1);
  });

  it("管理監督者・固定残業なし・対象外事業部は判定対象にしない", async () => {
    const emps = [
      // 管理監督者（固定残業ありでも対象外）。
      employee("emp_m", "9001", {
        department: "パートナー事業部",
        fixedOvertimeAllowance: 1_000,
        isManagerialEmployee: true,
      }),
      // 固定残業なし（差額の概念が無い）。
      employee("emp_z", "9002", {
        department: "パートナー事業部",
        fixedOvertimeAllowance: 0,
      }),
      // 対象外事業部。
      employee("emp_o", "9003", {
        department: "管理本部",
        fixedOvertimeAllowance: 1_000,
      }),
    ];
    const wds = [
      workDay("emp_m", "2026-07-01", 1_200),
      workDay("emp_z", "2026-07-01", 1_200),
      workDay("emp_o", "2026-07-01", 1_200),
    ];
    const deps = makeDeps(emps, wds);
    const result = await checkFixedOvertimeAlerts(INPUT, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkedCount).toBe(0);
    expect(result.value.triggeredCount).toBe(0);
    expect(deps.notifier.sent).toHaveLength(0);
  });

  it("超過していなければ通知しない", async () => {
    const emps = [
      employee("emp_1", "0001", {
        department: "パートナー事業部",
        fixedOvertimeAllowance: 500_000, // 現実的な時間外では超えない大きな固定枠。
      }),
    ];
    const wds = [workDay("emp_1", "2026-07-01", 60)];
    const deps = makeDeps(emps, wds);
    const result = await checkFixedOvertimeAlerts(INPUT, deps);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.checkedCount).toBe(1);
    expect(result.value.triggeredCount).toBe(0);
  });

  it("事業部の指定が空なら validation エラー", async () => {
    const deps = makeDeps([], []);
    const result = await checkFixedOvertimeAlerts(
      { ...INPUT, departments: [] },
      deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("validation_error");
  });

  it("事業部名は前後空白・全半角の揺れを吸収して一致する", async () => {
    const emps = [
      employee("emp_1", "0001", {
        department: " ＡＩテレアポ事業部 ", // 全角英字・前後空白。
        fixedOvertimeAllowance: 1_000,
      }),
    ];
    const wds = [workDay("emp_1", "2026-07-01", 1_200)];
    const deps = makeDeps(emps, wds);
    const result = await checkFixedOvertimeAlerts(INPUT, deps);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.triggeredCount).toBe(1);
  });
});
