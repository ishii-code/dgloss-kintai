/**
 * 開発・デモ用フォールバック定数。
 *
 * 本番では従業員は簡易ログイン（/login で選択→cookie セッション）で決まるため不要。
 * DB 未接続（in-memory）時に deps.ts がシードするデモ従業員の代表 ID で、
 * 結合テストの既定ログイン先としても使う。UI から打刻の employeeId を指定する用途は廃止した。
 */

import type { EmployeeId } from "@dgloss-kintai/contracts";

/** デモ用の代表従業員 ID（in-memory シードに必ず含まれる）。 */
export const DEMO_EMPLOYEE_ID = "emp_demo" as EmployeeId;
