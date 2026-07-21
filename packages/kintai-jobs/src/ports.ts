/**
 * 締めバッチのデータアクセス境界（port）。
 *
 * オーケストレーションは純粋関数を中心にし、DB 等の副作用は本ファイルの interface を
 * 通じて注入する。実 DB 実装（Prisma 等）はこのパッケージには置かない。
 * raw SQL は禁止（永続化は上位のアダプタ層の責務）。
 */

import type {
  Employee,
  EmployeeId,
  MonthlyClosing,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";

/** 締め対象の従業員を列挙する port。 */
export interface EmployeeDirectoryPort {
  /**
   * 当該期間に締め対象となる従業員を返す（在籍判定・雇用契約の解決はアダプタ側の責務）。
   */
  listEmployeesForClosing(period: YearMonth): Promise<readonly Employee[]>;
}

/** 従業員1名分の日次勤怠を取得する port。 */
export interface WorkDaySourcePort {
  /** 当該従業員・当該期間（当月1日〜末日）の WorkDay を返す。 */
  listWorkDays(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<readonly WorkDay[]>;
}

/** 締め結果を永続化する port（任意）。 */
export interface MonthlyClosingSinkPort {
  /** 確定した月次締めを保存する。 */
  save(closing: MonthlyClosing): Promise<void>;
}

/** 締め確定時刻を供給する時計 port（テストで固定するために注入する）。 */
export interface Clock {
  now(): Date;
}

/** システム時計。実行時の既定実装。 */
export const systemClock: Clock = {
  now: () => new Date(),
};

/**
 * 固定時刻を返す時計を生成する（テスト・再実行用）。
 * @param fixed 返し続ける時刻
 */
export function fixedClock(fixed: Date): Clock {
  return { now: () => new Date(fixed.getTime()) };
}
