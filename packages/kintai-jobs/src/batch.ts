/**
 * 複数従業員の月次締めバッチ（賃金規程第6条）。
 *
 * runMonthlyClosingBatch は純粋関数（データは呼び出し側が用意）。
 * runMonthlyClosingJob は port（EmployeeDirectoryPort / WorkDaySourcePort /
 * MonthlyClosingSinkPort）から取得・保存する薄いオーケストレータで、実 DB 実装は含まない。
 */

import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type {
  Clock,
  EmployeeDirectoryPort,
  MonthlyClosingSinkPort,
  WorkDaySourcePort,
} from "./ports.js";
import { systemClock } from "./ports.js";
import { runMonthlyClosing } from "./monthlyClosing.js";

/**
 * 従業員ごとの WorkDay を引く供給元。
 * Map<EmployeeId, WorkDay[]> か、キーを従業員 ID とする Record を受け付ける。
 */
export type WorkDaysByEmployee =
  | ReadonlyMap<EmployeeId, readonly WorkDay[]>
  | Readonly<Record<string, readonly WorkDay[]>>;

/** runMonthlyClosingBatch / Job の任意オプション。 */
export interface BatchOptions {
  /** 締め確定時刻を供給する時計（既定はシステム時計）。 */
  readonly clock?: Clock;
}

function lookupWorkDays(
  source: WorkDaysByEmployee,
  employeeId: EmployeeId,
): readonly WorkDay[] {
  if (source instanceof Map) {
    return source.get(employeeId) ?? [];
  }
  const record = source as Readonly<Record<string, readonly WorkDay[]>>;
  return record[employeeId] ?? [];
}

/**
 * 複数従業員の月次締めを実行する（純粋関数）。
 * 入力の従業員順で MonthlyClosing[] を返す。
 *
 * @param employees          締め対象の従業員
 * @param workDaysByEmployee 従業員 ID → その月の WorkDay[]
 * @param period             締め期間（年月）
 * @param options            時計
 */
export function runMonthlyClosingBatch(
  employees: readonly Employee[],
  workDaysByEmployee: WorkDaysByEmployee,
  period: YearMonth,
  options: BatchOptions = {},
): MonthlyClosing[] {
  const clock = options.clock ?? systemClock;
  return employees.map((employee) =>
    runMonthlyClosing(
      {
        employee,
        workDays: lookupWorkDays(workDaysByEmployee, employee.id),
        period,
      },
      { clock },
    ),
  );
}

/** runMonthlyClosingJob が使う port 一式。sink は任意。 */
export interface MonthlyClosingJobDeps {
  readonly employeeDirectory: EmployeeDirectoryPort;
  readonly workDaySource: WorkDaySourcePort;
  readonly sink?: MonthlyClosingSinkPort;
  readonly clock?: Clock;
}

/**
 * port からデータを取得して月次締めを実行する薄いオーケストレータ。
 * 実 DB 実装は注入する（このパッケージには持たない）。
 *
 * @param period 締め期間（年月）
 * @param deps   データアクセス port 一式
 * @returns 確定した MonthlyClosing[]（従業員列挙順）
 */
export async function runMonthlyClosingJob(
  period: YearMonth,
  deps: MonthlyClosingJobDeps,
): Promise<MonthlyClosing[]> {
  const clock = deps.clock ?? systemClock;
  const employees = await deps.employeeDirectory.listEmployeesForClosing(period);

  const results: MonthlyClosing[] = [];
  for (const employee of employees) {
    const workDays = await deps.workDaySource.listWorkDays(employee.id, period);
    const closing = runMonthlyClosing(
      { employee, workDays, period },
      { clock },
    );
    if (deps.sink) {
      await deps.sink.save(closing);
    }
    results.push(closing);
  }
  return results;
}
