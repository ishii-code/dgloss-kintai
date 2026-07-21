/**
 * Prisma 行 ↔ contracts ドメイン型のマッパー（純粋関数）。
 *
 * - 副作用・I/O を持たない。単体テスト（mappers.test.ts）で往復同値を保証する。
 * - ブランド型（EmployeeId / Yen / Minutes / IsoDate / IsoDateTime …）はこの境界でのみ
 *   `as` キャストする。区分 enum は schema.prisma の値をドメイン文字列リテラルと一致させて
 *   いるため、恒等的に相互代入できる（キャスト不要）。
 * - 日付・時刻は JST（Asia/Tokyo・固定 +09:00・DST なし）を前提に変換する。
 */

import type {
  ClassifiedWorkMinutes,
  Employee,
  EmployeeId,
  EmploymentContract,
  IsoDate,
  IsoDateTime,
  Minutes,
  MonthlyClosing,
  MonthlyClosingId,
  Stamp,
  StampId,
  WagePremiumBreakdown,
  WorkDay,
  WorkDayId,
  Yen,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type {
  Employee as EmployeeRow,
  EmploymentContract as EmploymentContractRow,
  MonthlyClosing as MonthlyClosingRow,
  Stamp as StampRow,
  WorkDay as WorkDayRow,
} from "@prisma/client";

/** 契約を include した従業員行。 */
export type EmployeeWithContractRow = EmployeeRow & {
  readonly contract: EmploymentContractRow;
};

// ---- 日付・時刻ヘルパー ---------------------------------------------------

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** `YYYY-MM-DD`（暦日）→ UTC 深夜の Date（Prisma `@db.Date` 表現）。 */
export function isoDateToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** UTC 深夜の Date（`@db.Date`）→ `YYYY-MM-DD`。 */
export function dateToIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** RFC3339（JST）→ その瞬間を表す Date。 */
export function isoDateTimeToDate(value: string): Date {
  return new Date(value);
}

/** Date（瞬間）→ JST の RFC3339 文字列（例 `2025-07-01T09:00:00+09:00`）。 */
export function dateToIsoDateTime(value: Date): string {
  const jst = new Date(value.getTime() + JST_OFFSET_MS);
  return `${jst.toISOString().slice(0, 19)}+09:00`;
}

// ---- Stamp ---------------------------------------------------------------

/** Prisma 行 → 打刻ドメイン型。 */
export function stampRowToDomain(row: StampRow): Stamp {
  return {
    id: row.id as StampId,
    employeeId: row.employeeId as EmployeeId,
    type: row.type,
    stampedAt: dateToIsoDateTime(row.stampedAt) as IsoDateTime,
    source: row.source,
    note: row.note,
  };
}

/** 打刻ドメイン型 → Prisma 行。 */
export function stampToRow(stamp: Stamp): StampRow {
  return {
    id: stamp.id,
    employeeId: stamp.employeeId,
    type: stamp.type,
    stampedAt: isoDateTimeToDate(stamp.stampedAt),
    source: stamp.source,
    note: stamp.note,
  };
}

// ---- WorkDay -------------------------------------------------------------

function classifiedFromRow(row: {
  nonStatutoryOvertimeMinutes: number;
  statutoryOvertimeMinutes: number;
  legalHolidayMinutes: number;
  scheduledHolidayMinutes: number;
  nightMinutes: number;
}): ClassifiedWorkMinutes {
  return {
    nonStatutoryOvertimeMinutes: row.nonStatutoryOvertimeMinutes,
    statutoryOvertimeMinutes: row.statutoryOvertimeMinutes,
    legalHolidayMinutes: row.legalHolidayMinutes,
    scheduledHolidayMinutes: row.scheduledHolidayMinutes,
    nightMinutes: row.nightMinutes,
  };
}

/** Prisma 行 → 日次勤怠ドメイン型。 */
export function workDayRowToDomain(row: WorkDayRow): WorkDay {
  return {
    id: row.id as WorkDayId,
    employeeId: row.employeeId as EmployeeId,
    date: dateToIsoDate(row.date) as IsoDate,
    dayType: row.dayType,
    scheduledStart: row.scheduledStart,
    scheduledEnd: row.scheduledEnd,
    actualWorkedMinutes: row.actualWorkedMinutes as Minutes,
    breakMinutes: row.breakMinutes as Minutes,
    absenceMinutes: row.absenceMinutes as Minutes,
    leave: row.leave,
    classified: classifiedFromRow(row),
  };
}

/** 日次勤怠ドメイン型 → Prisma 行。 */
export function workDayToRow(workDay: WorkDay): WorkDayRow {
  return {
    id: workDay.id,
    employeeId: workDay.employeeId,
    date: isoDateToDate(workDay.date),
    dayType: workDay.dayType,
    scheduledStart: workDay.scheduledStart,
    scheduledEnd: workDay.scheduledEnd,
    actualWorkedMinutes: workDay.actualWorkedMinutes,
    breakMinutes: workDay.breakMinutes,
    absenceMinutes: workDay.absenceMinutes,
    leave: workDay.leave,
    nonStatutoryOvertimeMinutes: workDay.classified.nonStatutoryOvertimeMinutes,
    statutoryOvertimeMinutes: workDay.classified.statutoryOvertimeMinutes,
    legalHolidayMinutes: workDay.classified.legalHolidayMinutes,
    scheduledHolidayMinutes: workDay.classified.scheduledHolidayMinutes,
    nightMinutes: workDay.classified.nightMinutes,
  };
}

// ---- MonthlyClosing ------------------------------------------------------

/** Prisma 行 → 月次締めドメイン型。 */
export function monthlyClosingRowToDomain(
  row: MonthlyClosingRow,
): MonthlyClosing {
  const classified: ClassifiedWorkMinutes = classifiedFromRow(row);
  const premium: WagePremiumBreakdown = {
    overtimeAllowance: row.overtimeAllowance as Yen,
    overtimeOver60Allowance: row.overtimeOver60Allowance as Yen,
    holidayAllowance: row.holidayAllowance as Yen,
    nightAllowance: row.nightAllowance as Yen,
    total: row.premiumTotal as Yen,
  };
  const period: YearMonth = { year: row.year, month: row.month };
  return {
    id: row.id as MonthlyClosingId,
    employeeId: row.employeeId as EmployeeId,
    period,
    status: row.status,
    totalWorkedMinutes: row.totalWorkedMinutes as Minutes,
    classified,
    premium,
    fixedOvertimeAdditionalPayment: row.fixedOvertimeAdditionalPayment as Yen,
    latenessDeduction: row.latenessDeduction as Yen,
    closedAt: row.closedAt === null ? null : dateToIsoDateTime(row.closedAt),
  };
}

/** 月次締めドメイン型 → Prisma 行。 */
export function monthlyClosingToRow(
  closing: MonthlyClosing,
): MonthlyClosingRow {
  return {
    id: closing.id,
    employeeId: closing.employeeId,
    year: closing.period.year,
    month: closing.period.month,
    status: closing.status,
    totalWorkedMinutes: closing.totalWorkedMinutes,
    nonStatutoryOvertimeMinutes: closing.classified.nonStatutoryOvertimeMinutes,
    statutoryOvertimeMinutes: closing.classified.statutoryOvertimeMinutes,
    legalHolidayMinutes: closing.classified.legalHolidayMinutes,
    scheduledHolidayMinutes: closing.classified.scheduledHolidayMinutes,
    nightMinutes: closing.classified.nightMinutes,
    overtimeAllowance: closing.premium.overtimeAllowance,
    overtimeOver60Allowance: closing.premium.overtimeOver60Allowance,
    holidayAllowance: closing.premium.holidayAllowance,
    nightAllowance: closing.premium.nightAllowance,
    premiumTotal: closing.premium.total,
    fixedOvertimeAdditionalPayment: closing.fixedOvertimeAdditionalPayment,
    latenessDeduction: closing.latenessDeduction,
    closedAt: closing.closedAt === null ? null : isoDateTimeToDate(closing.closedAt),
  };
}

// ---- Employee ------------------------------------------------------------

/** Prisma 契約行 → 雇用契約ドメイン型。 */
export function contractRowToDomain(
  row: EmploymentContractRow,
): EmploymentContract {
  return {
    employmentType: row.employmentType,
    workSystem: row.workSystem,
    office: row.office,
    isManagerialEmployee: row.isManagerialEmployee,
    basicSalary: row.basicSalary as Yen,
    annualScheduledWorkingHours: row.annualScheduledWorkingHours,
    fixedOvertimeAllowance: row.fixedOvertimeAllowance as Yen,
    fixedOvertimeCoverage: {
      overtime: row.coverageOvertime,
      overtimeOver60: row.coverageOvertimeOver60,
      holiday: row.coverageHoliday,
      night: row.coverageNight,
    },
  };
}

/**
 * 雇用契約ドメイン型 → Prisma 契約行。
 * @param contract 契約
 * @param employeeId 紐付く従業員 ID（FK・契約 id にも用いる）
 */
export function contractToRow(
  contract: EmploymentContract,
  employeeId: string,
): EmploymentContractRow {
  return {
    id: employeeId,
    employeeId,
    employmentType: contract.employmentType,
    workSystem: contract.workSystem,
    office: contract.office,
    isManagerialEmployee: contract.isManagerialEmployee,
    basicSalary: contract.basicSalary,
    annualScheduledWorkingHours: contract.annualScheduledWorkingHours,
    fixedOvertimeAllowance: contract.fixedOvertimeAllowance,
    coverageOvertime: contract.fixedOvertimeCoverage.overtime,
    coverageOvertimeOver60: contract.fixedOvertimeCoverage.overtimeOver60,
    coverageHoliday: contract.fixedOvertimeCoverage.holiday,
    coverageNight: contract.fixedOvertimeCoverage.night,
  };
}

/** Prisma 行（契約 include）→ 従業員ドメイン型。 */
export function employeeRowToDomain(row: EmployeeWithContractRow): Employee {
  return {
    id: row.id as EmployeeId,
    employeeCode: row.employeeCode,
    name: row.name,
    email: row.email,
    hiredOn: dateToIsoDate(row.hiredOn),
    retiredOn: row.retiredOn === null ? null : dateToIsoDate(row.retiredOn),
    contract: contractRowToDomain(row.contract),
  };
}

/** 従業員ドメイン型 → Prisma 行（契約 include）。 */
export function employeeToRow(employee: Employee): EmployeeWithContractRow {
  return {
    id: employee.id,
    employeeCode: employee.employeeCode,
    name: employee.name,
    email: employee.email,
    hiredOn: isoDateToDate(employee.hiredOn),
    retiredOn:
      employee.retiredOn === null ? null : isoDateToDate(employee.retiredOn),
    contract: contractToRow(employee.contract, employee.id),
  };
}
