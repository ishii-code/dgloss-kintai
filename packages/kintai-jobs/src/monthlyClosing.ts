/**
 * 月次締めオーケストレーション（賃金規程第6条: 当月1日〜末日）。
 *
 * 従業員1名について、月間合算した区分別労働時間から
 *  - 割増賃金（第20条, core: calculateWagePremium）
 *  - 固定時間外勤務手当との差額支給（第20条4項, core: settleWithFixedOvertime）
 *  - 遅刻早退等の控除（第21条, core: calculateLatenessDeduction）
 * を算定し、MonthlyClosing（contracts）にまとめる純粋関数。
 *
 * データ取得は行わない（呼び出し側が WorkDay[] を渡す）。時刻のみ Clock で注入する。
 */

import {
  calculateWagePremium,
  calculateLatenessDeduction,
  settleWithFixedOvertime,
  type WagePremiumConfig,
  type EmployeeWageProfile,
  type FixedOvertimeContract,
} from "@dgloss-kintai/core";
import type {
  Employee,
  EmploymentContract,
  MonthlyClosing,
  MonthlyClosingId,
  WagePremiumBreakdown,
  WorkDay,
  YearMonth,
  Yen,
  Minutes,
} from "@dgloss-kintai/contracts";
import {
  yearMonthSchema,
  employmentContractSchema,
} from "@dgloss-kintai/contracts";
import type { Clock } from "./ports.js";
import { systemClock } from "./ports.js";
import {
  selectWorkDaysForPeriod,
  summarizeMonthlyAttendance,
} from "./summarize.js";

/** runMonthlyClosing の入力。従業員1名分。 */
export interface MonthlyClosingInput {
  /** 締め対象の従業員（雇用契約を含む）。 */
  readonly employee: Employee;
  /** 締め期間に取得した WorkDay（期間外・他従業員が混じっていても内部で絞り込む）。 */
  readonly workDays: readonly WorkDay[];
  /** 締め期間（年月）。 */
  readonly period: YearMonth;
}

/** runMonthlyClosing の任意オプション。 */
export interface MonthlyClosingOptions {
  /** 締め確定時刻を供給する時計（既定はシステム時計）。 */
  readonly clock?: Clock;
}

const asYen = (n: number): Yen => n as Yen;
const asMinutes = (n: number): Minutes => n as Minutes;

/** 雇用契約から割増計算プロフィール（第20条）を組み立てる。 */
function toWageProfile(contract: EmploymentContract): EmployeeWageProfile {
  return {
    basicSalary: contract.basicSalary,
    isManagerialEmployee: contract.isManagerialEmployee,
  };
}

/** 雇用契約から割増計算 config（第20条3項1号: 年間所定労働時間）を組み立てる。 */
function toWageConfig(contract: EmploymentContract): WagePremiumConfig {
  return {
    annualScheduledWorkingHours: contract.annualScheduledWorkingHours,
  };
}

/** 雇用契約から固定時間外勤務手当の設定（第18条2項）を組み立てる。 */
function toFixedOvertimeContract(
  contract: EmploymentContract,
): FixedOvertimeContract {
  return {
    fixedOvertimeAllowance: contract.fixedOvertimeAllowance,
    coveredComponents: {
      overtime: contract.fixedOvertimeCoverage.overtime,
      overtimeOver60: contract.fixedOvertimeCoverage.overtimeOver60,
      holiday: contract.fixedOvertimeCoverage.holiday,
      night: contract.fixedOvertimeCoverage.night,
    },
  };
}

/** core の WagePremiumBreakdown（number）を contracts の Yen ブランド型に写す。 */
function toContractPremium(premium: {
  overtimeAllowance: number;
  overtimeOver60Allowance: number;
  holidayAllowance: number;
  nightAllowance: number;
  total: number;
}): WagePremiumBreakdown {
  return {
    overtimeAllowance: asYen(premium.overtimeAllowance),
    overtimeOver60Allowance: asYen(premium.overtimeOver60Allowance),
    holidayAllowance: asYen(premium.holidayAllowance),
    nightAllowance: asYen(premium.nightAllowance),
    total: asYen(premium.total),
  };
}

/** 締め ID を決定論的に組み立てる（employeeId + 期間）。 */
function buildClosingId(employeeId: string, period: YearMonth): MonthlyClosingId {
  const mm = String(period.month).padStart(2, "0");
  return `${employeeId}:${period.year}-${mm}` as MonthlyClosingId;
}

/**
 * 固定時間外勤務手当との差額支給額を求める（第20条4項）。
 * 管理監督者には固定時間外勤務手当を支給しない（第18条2項）ため 0 を返す。
 * 固定額 0（設定なし）の場合も差額調整は発生しないため 0。
 */
function resolveFixedOvertimeAdditionalPayment(
  premium: WagePremiumBreakdown,
  contract: EmploymentContract,
): number {
  if (contract.isManagerialEmployee) {
    return 0;
  }
  if (contract.fixedOvertimeAllowance <= 0) {
    return 0;
  }
  const settled = settleWithFixedOvertime(
    {
      overtimeAllowance: premium.overtimeAllowance,
      overtimeOver60Allowance: premium.overtimeOver60Allowance,
      holidayAllowance: premium.holidayAllowance,
      nightAllowance: premium.nightAllowance,
      total: premium.total,
    },
    toFixedOvertimeContract(contract),
  );
  return settled.additionalPayment;
}

/**
 * 従業員1名の月次締めを実行する（賃金規程第6条）。純粋関数。
 *
 * @param input   従業員・WorkDay[]・期間
 * @param options 時計（既定はシステム時計）
 * @returns 確定した MonthlyClosing（status="closed"）
 */
export function runMonthlyClosing(
  input: MonthlyClosingInput,
  options: MonthlyClosingOptions = {},
): MonthlyClosing {
  const clock = options.clock ?? systemClock;

  // 外部入力を zod で検証する（期間・雇用契約）。
  const period = yearMonthSchema.parse(input.period) as YearMonth;
  employmentContractSchema.parse(input.employee.contract);
  const contract = input.employee.contract;
  const employeeId = input.employee.id;

  // 当月1日〜末日・当該従業員の WorkDay を抽出して月間合算する。
  const scoped = selectWorkDaysForPeriod(input.workDays, employeeId, period);
  const summary = summarizeMonthlyAttendance(scoped);

  // 割増賃金（第20条）。
  const calculated = calculateWagePremium(
    toWageProfile(contract),
    summary.classified,
    toWageConfig(contract),
  );
  const premium = toContractPremium(calculated);

  // 固定時間外勤務手当との差額支給（第20条4項）。
  const fixedOvertimeAdditionalPayment = resolveFixedOvertimeAdditionalPayment(
    premium,
    contract,
  );

  // 遅刻早退等の控除（第21条）。
  const latenessDeduction = calculateLatenessDeduction(
    { basicSalary: contract.basicSalary },
    summary.totalAbsenceMinutes,
    toWageConfig(contract),
  );

  const closedAt = clock.now().toISOString();

  return {
    id: buildClosingId(employeeId, period),
    employeeId,
    period,
    status: "closed",
    totalWorkedMinutes: asMinutes(summary.totalWorkedMinutes),
    classified: summary.classified,
    premium,
    fixedOvertimeAdditionalPayment: asYen(fixedOvertimeAdditionalPayment),
    latenessDeduction: asYen(latenessDeduction),
    closedAt,
  };
}
