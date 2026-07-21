import { describe, it, expect } from "vitest";
import type {
  ClassifiedWorkMinutes,
  Employee,
  EmployeeId,
  EmploymentContract,
  IsoDate,
  IsoDateTime,
  Minutes,
  MonthlyClosing,
  WorkDay,
  WorkDayId,
  Yen,
  YearMonth,
} from "@dgloss-kintai/contracts";
import { runMonthlyClosing, fixedClock } from "@dgloss-kintai/jobs";
import type { JinjerTransport, JinjerRequest } from "./transport.js";
import { JinjerConnector } from "./pull.js";
import { runShadowVerification } from "./verify.js";
import type { ShadowAttendanceSource } from "./verify.js";

const period: YearMonth = { year: 2025, month: 7 };
const occurredAt = "2025-08-01T00:00:00+09:00" as IsoDateTime;
const clock = fixedClock(new Date("2025-08-01T00:00:00+09:00"));

const zeroClassified: ClassifiedWorkMinutes = {
  nonStatutoryOvertimeMinutes: 0,
  statutoryOvertimeMinutes: 0,
  legalHolidayMinutes: 0,
  scheduledHolidayMinutes: 0,
  nightMinutes: 0,
};

/** テスト用の雇用契約。 */
function makeContract(): EmploymentContract {
  return {
    employmentType: "regular",
    workSystem: "fixed",
    office: "headquarters",
    isManagerialEmployee: false,
    basicSalary: 300000 as Yen,
    annualScheduledWorkingHours: 2000,
    fixedOvertimeAllowance: 0 as Yen,
    fixedOvertimeCoverage: {
      overtime: false,
      overtimeOver60: false,
      holiday: false,
      night: false,
    },
  };
}

/** テスト用の従業員。 */
function makeEmployee(id: string): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: `EMP-${id}`,
    name: `従業員 ${id}`,
    email: null,
    hiredOn: "2020-04-01" as IsoDate,
    retiredOn: null,
    contract: makeContract(),
  };
}

/** 残業を含む WorkDay を1件作る（自作側で割増が発生する）。 */
function makeWorkDay(
  employeeId: string,
  date: string,
  overtimeMinutes: number,
): WorkDay {
  return {
    id: `${employeeId}-${date}` as WorkDayId,
    employeeId: employeeId as EmployeeId,
    date: date as IsoDate,
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: (480 + overtimeMinutes) as Minutes,
    breakMinutes: 60 as Minutes,
    absenceMinutes: 0 as Minutes,
    leave: null,
    classified: {
      ...zeroClassified,
      statutoryOvertimeMinutes: overtimeMinutes,
    },
  };
}

/** 従業員ごとの WorkDay を返すインメモリ勤怠ソース。 */
function inMemorySource(
  byEmployee: Record<string, readonly WorkDay[]>,
): ShadowAttendanceSource {
  return {
    listWorkDays(employeeId): Promise<readonly WorkDay[]> {
      return Promise.resolve(byEmployee[employeeId] ?? []);
    },
  };
}

/** path=monthly_closings に固定レスポンスを返すスタブ transport（実ネットワークを呼ばない）。 */
function stubConnector(result: readonly unknown[]): JinjerConnector {
  const transport: JinjerTransport = {
    request(req: JinjerRequest): Promise<unknown> {
      if (req.path !== "monthly_closings") {
        return Promise.reject(new Error(`no stub for ${req.path}`));
      }
      return Promise.resolve({ code: 200, result });
    },
  };
  return new JinjerConnector(transport);
}

/** 自作締めの実結果を得る（jinjer スタブを組み立てる基準にする）。 */
function ownClosing(employee: Employee, workDays: readonly WorkDay[]): MonthlyClosing {
  return runMonthlyClosing({ employee, workDays, period }, { clock });
}

/** 自作締めに一致する jinjer 月次締め DTO を組み立てる。premiumDelta で乖離を注入する。 */
function jinjerEntry(own: MonthlyClosing, premiumDelta = 0): unknown {
  return {
    staff_code: own.employeeId,
    year: period.year,
    month: period.month,
    total_working_minutes: own.totalWorkedMinutes,
    classified: {
      non_statutory_overtime_minutes: 0,
      statutory_overtime_minutes: 0,
      legal_holiday_minutes: 0,
      scheduled_holiday_minutes: 0,
      night_minutes: 0,
    },
    allowances: {
      overtime_allowance: own.premium.total + premiumDelta,
      overtime_over60_allowance: 0,
      holiday_allowance: 0,
      night_allowance: 0,
    },
  };
}

describe("runShadowVerification", () => {
  it("全一致: 全員 matched、hasMismatch=false、乖離0", async () => {
    const e1 = makeEmployee("E001");
    const e2 = makeEmployee("E002");
    const w1 = [makeWorkDay("E001", "2025-07-01", 120)];
    const w2 = [makeWorkDay("E002", "2025-07-02", 200)];
    const own1 = ownClosing(e1, w1);
    const own2 = ownClosing(e2, w2);

    const result = await runShadowVerification({
      period,
      employees: [e1, e2],
      attendanceSource: inMemorySource({ E001: w1, E002: w2 }),
      connector: stubConnector([jinjerEntry(own1), jinjerEntry(own2)]),
      clock,
      occurredAt,
    });

    expect(result.total).toBe(2);
    expect(result.matchedCount).toBe(2);
    expect(result.mismatchedCount).toBe(0);
    expect(result.missingCount).toBe(0);
    expect(result.hasMismatch).toBe(false);
    expect(result.maxAbsolutePremiumDiff).toBe(0);
    expect(result.mismatchEvents).toHaveLength(0);
    // runMonthlyClosing の実割増が正であることを確認（テストが空回りしていない）。
    expect(own1.premium.total).toBeGreaterThan(0);
  });

  it("一部1円不一致（未払い方向 own < jinjer）を検出し強調する", async () => {
    const e1 = makeEmployee("E001");
    const w1 = [makeWorkDay("E001", "2025-07-01", 120)];
    const own1 = ownClosing(e1, w1);

    const result = await runShadowVerification({
      period,
      employees: [e1],
      attendanceSource: inMemorySource({ E001: w1 }),
      // jinjer を own より 1 円多くする → own − jinjer = -1（未払い方向）。
      connector: stubConnector([jinjerEntry(own1, 1)]),
      clock,
      occurredAt,
    });

    expect(result.hasMismatch).toBe(true);
    expect(result.mismatchedCount).toBe(1);
    expect(result.underpaymentCount).toBe(1);
    expect(result.overpaymentCount).toBe(0);
    expect(result.maxAbsolutePremiumDiff).toBe(1);
    expect(result.mismatches[0]?.premiumDiff).toBe(-1);
    expect(result.mismatchEvents).toHaveLength(1);
    expect(result.mismatchEvents[0]?.type).toBe("shadow.mismatch");
    expect(result.mismatchEvents[0]?.occurredAt).toBe(occurredAt);
  });

  it("複数従業員: 一致・不一致（過払い）が混在", async () => {
    const e1 = makeEmployee("E001");
    const e2 = makeEmployee("E002");
    const w1 = [makeWorkDay("E001", "2025-07-01", 120)];
    const w2 = [makeWorkDay("E002", "2025-07-02", 200)];
    const own1 = ownClosing(e1, w1);
    const own2 = ownClosing(e2, w2);

    const result = await runShadowVerification({
      period,
      employees: [e1, e2],
      attendanceSource: inMemorySource({ E001: w1, E002: w2 }),
      // E001 は一致、E002 は own が 500 円多い（過払い方向）。
      connector: stubConnector([jinjerEntry(own1), jinjerEntry(own2, -500)]),
      clock,
      occurredAt,
    });

    expect(result.total).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.mismatchedCount).toBe(1);
    expect(result.overpaymentCount).toBe(1);
    expect(result.underpaymentCount).toBe(0);
    expect(result.maxAbsolutePremiumDiff).toBe(500);
    expect(result.mismatches[0]?.employeeId).toBe("E002");
  });

  it("jinjer 側欠損（該当者なし）は missing に集計され突合しない", async () => {
    const e1 = makeEmployee("E001");
    const e2 = makeEmployee("E002");
    const w1 = [makeWorkDay("E001", "2025-07-01", 120)];
    const w2 = [makeWorkDay("E002", "2025-07-02", 200)];
    const own1 = ownClosing(e1, w1);

    const result = await runShadowVerification({
      period,
      employees: [e1, e2],
      attendanceSource: inMemorySource({ E001: w1, E002: w2 }),
      // E002 の締めは jinjer 側に存在しない。
      connector: stubConnector([jinjerEntry(own1)]),
      clock,
      occurredAt,
    });

    expect(result.total).toBe(2);
    expect(result.matchedCount).toBe(1);
    expect(result.missingCount).toBe(1);
    expect(result.missing[0]?.employeeId).toBe("E002");
    expect(result.comparisons).toHaveLength(1);
    expect(result.hasMismatch).toBe(false);
  });

  it("runMonthlyClosing の実結果と compareShadow の整合（same 入力なら matched）", async () => {
    const e1 = makeEmployee("E001");
    const w1 = [
      makeWorkDay("E001", "2025-07-01", 120),
      makeWorkDay("E001", "2025-07-02", 60),
    ];
    const own1 = ownClosing(e1, w1);

    const result = await runShadowVerification({
      period,
      employees: [e1],
      attendanceSource: inMemorySource({ E001: w1 }),
      connector: stubConnector([jinjerEntry(own1)]),
      clock,
      occurredAt,
    });

    const c = result.comparisons[0];
    expect(c?.ownPremiumTotal).toBe(own1.premium.total);
    expect(c?.workedMinutesDiff).toBe(0);
    expect(c?.matched).toBe(true);
  });
});
