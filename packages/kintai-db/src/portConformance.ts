/**
 * ポート interface 適合の型レベル保証。
 *
 * 各リポジトリクラスは実装側で `implements` 宣言しているが、ここでも
 * 「クラスのインスタンス型がポート型の部分型である」ことを明示的に固定する。
 * ランタイムには一切影響しない（型のみ）。tsc の typecheck で検証される。
 */

import type {
  EmployeeRepository,
  MonthlyClosingRepository,
  StampRepository,
  WorkDayRepository,
} from "@dgloss-kintai/api";
import type {
  EmployeeDirectoryPort,
  MonthlyClosingSinkPort,
  WorkDaySourcePort,
} from "@dgloss-kintai/jobs";
import type { PrismaEmployeeRepository } from "./employeeRepository.js";
import type { PrismaMonthlyClosingRepository } from "./monthlyClosingRepository.js";
import type { PrismaStampRepository } from "./stampRepository.js";
import type { PrismaWorkDayRepository } from "./workDayRepository.js";

/** `T` が `true` に等しいことを要求する（不一致ならコンパイルエラー）。 */
type Assert<T extends true> = T;

// api の repository port
export type _StampRepo = Assert<
  PrismaStampRepository extends StampRepository ? true : false
>;
export type _WorkDayRepo = Assert<
  PrismaWorkDayRepository extends WorkDayRepository ? true : false
>;
export type _MonthlyClosingRepo = Assert<
  PrismaMonthlyClosingRepository extends MonthlyClosingRepository ? true : false
>;
export type _EmployeeRepo = Assert<
  PrismaEmployeeRepository extends EmployeeRepository ? true : false
>;

// jobs の port
export type _EmployeeDirectory = Assert<
  PrismaEmployeeRepository extends EmployeeDirectoryPort ? true : false
>;
export type _WorkDaySource = Assert<
  PrismaWorkDayRepository extends WorkDaySourcePort ? true : false
>;
export type _MonthlyClosingSink = Assert<
  PrismaMonthlyClosingRepository extends MonthlyClosingSinkPort ? true : false
>;
