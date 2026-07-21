/**
 * デモ用の定数。
 *
 * DB 未接続（in-memory）でもデモが成立するよう、ログイン中の従業員を固定で表す。
 * サーバ側（deps.ts）はこの ID の従業員を1件シードし、クライアント（打刻画面）は
 * 打刻登録・当日照会の `employeeId` としてこの定数を参照する。
 */

import type { EmployeeId } from "@dgloss-kintai/contracts";

/** デモ用のログイン従業員 ID。サーバ側で必ずシードされる。 */
export const DEMO_EMPLOYEE_ID = "emp_demo" as EmployeeId;
