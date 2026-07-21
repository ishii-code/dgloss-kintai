/**
 * テスト用のドメインオブジェクト生成ヘルパー。
 * ブランド型を最小の記述で組み立てるためのファクトリを提供する。
 */

import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  ShadowComparison,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** テスト用従業員を作る（計算値は代表値で埋める）。 */
export function makeEmployee(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id: id as EmployeeId,
    employeeCode: `EMP-${id}`,
    name: `従業員 ${id}`,
    email: null,
    hiredOn: "2020-04-01",
    retiredOn: null,
    contract: {
      employmentType: "regular",
      workSystem: "fixed",
      office: "headquarters",
      isManagerialEmployee: false,
      basicSalary: 300000 as Employee["contract"]["basicSalary"],
      annualScheduledWorkingHours: 1900,
      fixedOvertimeAllowance: 0 as Employee["contract"]["fixedOvertimeAllowance"],
      fixedOvertimeCoverage: {
        overtime: false,
        overtimeOver60: false,
        holiday: false,
        night: false,
      },
    },
    ...overrides,
  };
}

/** テスト用日次勤怠を作る。 */
export function makeWorkDay(
  employeeId: string,
  date: string,
  overrides: Partial<WorkDay> = {},
): WorkDay {
  return {
    id: `wd-${employeeId}-${date}` as WorkDay["id"],
    employeeId: employeeId as EmployeeId,
    date: date as WorkDay["date"],
    dayType: "workday",
    scheduledStart: "09:00",
    scheduledEnd: "18:00",
    actualWorkedMinutes: 480 as WorkDay["actualWorkedMinutes"],
    breakMinutes: 60 as WorkDay["breakMinutes"],
    absenceMinutes: 0 as WorkDay["absenceMinutes"],
    leave: null,
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
    ...overrides,
  };
}

/** テスト用月次締めを作る。 */
export function makeMonthlyClosing(
  employeeId: string,
  period: YearMonth,
  overrides: Partial<MonthlyClosing> = {},
): MonthlyClosing {
  return {
    id: `mc-${employeeId}-${period.year}${period.month}` as MonthlyClosing["id"],
    employeeId: employeeId as EmployeeId,
    period,
    status: "closed",
    totalWorkedMinutes: 9600 as MonthlyClosing["totalWorkedMinutes"],
    classified: {
      nonStatutoryOvertimeMinutes: 0,
      statutoryOvertimeMinutes: 0,
      legalHolidayMinutes: 0,
      scheduledHolidayMinutes: 0,
      nightMinutes: 0,
    },
    premium: {
      overtimeAllowance: 0 as MonthlyClosing["premium"]["overtimeAllowance"],
      overtimeOver60Allowance:
        0 as MonthlyClosing["premium"]["overtimeOver60Allowance"],
      holidayAllowance: 0 as MonthlyClosing["premium"]["holidayAllowance"],
      nightAllowance: 0 as MonthlyClosing["premium"]["nightAllowance"],
      total: 0 as MonthlyClosing["premium"]["total"],
    },
    fixedOvertimeAdditionalPayment:
      0 as MonthlyClosing["fixedOvertimeAdditionalPayment"],
    latenessDeduction: 0 as MonthlyClosing["latenessDeduction"],
    closedAt: "2025-08-01T00:00:00+09:00",
    ...overrides,
  };
}

/** テスト用 Shadow 突合結果を作る。 */
export function makeShadowComparison(
  employeeId: string,
  period: YearMonth,
  overrides: Partial<ShadowComparison> = {},
): ShadowComparison {
  return {
    employeeId: employeeId as EmployeeId,
    period,
    ownPremiumTotal: 12000 as ShadowComparison["ownPremiumTotal"],
    jinjerPremiumTotal: 12000 as ShadowComparison["jinjerPremiumTotal"],
    premiumDiff: 0,
    workedMinutesDiff: 0,
    matched: true,
    ...overrides,
  };
}
