/**
 * {@link ShadowAttendanceSource} のインメモリ実装（デモ用）。
 *
 * 実 DB アダプタの代わりに、従業員 ID → その月の {@link WorkDay}[] のマップを保持して返す。
 * 実 DB 実装はアダプタ層の責務であり、本パッケージには置かない（この実装を差し替える）。
 */

import type {
  EmployeeId,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";

import type { ShadowAttendanceSource } from "../verify.js";

/** 従業員 ID をキーに WorkDay[] を返すインメモリ勤怠ソース。 */
export class InMemoryAttendanceSource implements ShadowAttendanceSource {
  readonly #byEmployee: ReadonlyMap<string, readonly WorkDay[]>;

  /**
   * @param byEmployee 従業員 ID → 当月の WorkDay[]
   */
  constructor(byEmployee: ReadonlyMap<string, readonly WorkDay[]>) {
    this.#byEmployee = byEmployee;
  }

  /** 当該従業員の WorkDay[] を返す（未登録なら空配列）。period は絞り込みに使わない（締め側が絞る）。 */
  listWorkDays(
    employeeId: EmployeeId,
    _period: YearMonth,
  ): Promise<readonly WorkDay[]> {
    return Promise.resolve(this.#byEmployee.get(employeeId) ?? []);
  }
}
