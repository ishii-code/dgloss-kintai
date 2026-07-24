/**
 * ユースケース: データベースサマリ（従業員マスタの集計）。
 *
 * 総数・在籍／退職・雇用区分別・勤務体系別・所属別・管理監督者数などを集計する純粋関数と、
 * リポジトリから取得して集計する use-case ラッパを提供する。機密の実額（給与等）は含めない。
 */

import type { Employee } from "@dgloss-kintai/contracts";
import {
  OFFICE_DIVISIONS,
  WORK_SYSTEMS,
} from "@dgloss-kintai/contracts";
import type {
  EmploymentType,
  OfficeDivision,
  WorkSystem,
} from "@dgloss-kintai/contracts";
import type { EmployeeRepository } from "./ports.js";
import { ok, type Result } from "./result.js";

/** 雇用区分の全値（集計キーの初期化に用いる）。 */
const EMPLOYMENT_TYPES: readonly EmploymentType[] = ["regular", "non_regular"];

/** データベースサマリ（従業員マスタの集計結果）。 */
export interface EmployeeDatabaseSummary {
  /** 総従業員数。 */
  readonly total: number;
  /** 在籍数（退職日が未設定）。 */
  readonly active: number;
  /** 退職数（退職日あり）。 */
  readonly retired: number;
  /** 管理監督者数（労基法41条2号該当）。 */
  readonly managerialCount: number;
  /** 雇用区分別の人数。 */
  readonly byEmploymentType: Readonly<Record<EmploymentType, number>>;
  /** 勤務体系別の人数。 */
  readonly byWorkSystem: Readonly<Record<WorkSystem, number>>;
  /** 所属別の人数。 */
  readonly byOffice: Readonly<Record<OfficeDivision, number>>;
}

/** ゼロ初期化した区分別レコードを作る。 */
function zeroCount<K extends string>(keys: readonly K[]): Record<K, number> {
  const acc = {} as Record<K, number>;
  for (const k of keys) {
    acc[k] = 0;
  }
  return acc;
}

/**
 * 従業員配列を集計してデータベースサマリを作る（純粋関数・副作用なし）。
 *
 * @param employees 集計対象の従業員
 * @returns 集計結果
 */
export function summarizeEmployees(
  employees: readonly Employee[],
): EmployeeDatabaseSummary {
  const byEmploymentType = zeroCount(EMPLOYMENT_TYPES);
  const byWorkSystem = zeroCount(WORK_SYSTEMS);
  const byOffice = zeroCount(OFFICE_DIVISIONS);
  let active = 0;
  let retired = 0;
  let managerialCount = 0;

  for (const e of employees) {
    if (e.retiredOn === null) {
      active += 1;
    } else {
      retired += 1;
    }
    if (e.contract.isManagerialEmployee) {
      managerialCount += 1;
    }
    byEmploymentType[e.contract.employmentType] += 1;
    byWorkSystem[e.contract.workSystem] += 1;
    byOffice[e.contract.office] += 1;
  }

  return {
    total: employees.length,
    active,
    retired,
    managerialCount,
    byEmploymentType,
    byWorkSystem,
    byOffice,
  };
}

/** employeeSummary の依存。 */
export interface EmployeeSummaryDeps {
  readonly employees: EmployeeRepository;
}

/**
 * 全従業員を取得してデータベースサマリを返す。
 *
 * @param deps リポジトリ port
 * @returns 集計結果（常に成功）
 */
export async function employeeSummary(
  deps: EmployeeSummaryDeps,
): Promise<Result<EmployeeDatabaseSummary>> {
  const employees = await deps.employees.list();
  return ok(summarizeEmployees(employees));
}
