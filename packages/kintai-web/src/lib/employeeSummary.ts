/**
 * 従業員の公開サマリ。
 *
 * ログイン画面の選択肢や打刻画面のヘッダ表示に必要な最小限の情報のみを持つ。
 * 契約・給与などの機密はここに含めず、クライアントへは決して渡さない。
 */

import type { Employee, EmployeeId } from "@dgloss-kintai/contracts";

/** クライアントに渡してよい従業員の公開情報。 */
export interface EmployeeSummary {
  readonly id: EmployeeId;
  readonly name: string;
  /** 社員番号（表示・識別用）。 */
  readonly employeeCode: string;
}

/** ドメインの従業員から公開サマリを取り出す（機密を落とす）。 */
export function toEmployeeSummary(employee: Employee): EmployeeSummary {
  return {
    id: employee.id,
    name: employee.name,
    employeeCode: employee.employeeCode,
  };
}
