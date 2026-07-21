/**
 * ドメインイベント。パッケージ間・ジョブ間の連携に用いる。
 */

import type { YearMonth } from "./common.js";
import type { EmployeeId, IsoDateTime, StampId } from "./common.js";

interface DomainEventBase<TType extends string> {
  readonly type: TType;
  readonly occurredAt: IsoDateTime;
}

/** 打刻が登録された。 */
export interface StampRegistered extends DomainEventBase<"stamp.registered"> {
  readonly stampId: StampId;
  readonly employeeId: EmployeeId;
}

/** 日次勤怠が確定した。 */
export interface DailyAttendanceClosed
  extends DomainEventBase<"attendance.daily_closed"> {
  readonly employeeId: EmployeeId;
  readonly date: string;
}

/** 月次締めが完了した。 */
export interface MonthlyClosingCompleted
  extends DomainEventBase<"closing.monthly_completed"> {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
}

/** Shadow 突合で不一致が検出された（未払いリスクの警告）。 */
export interface ShadowComparisonMismatch
  extends DomainEventBase<"shadow.mismatch"> {
  readonly employeeId: EmployeeId;
  readonly period: YearMonth;
  readonly premiumDiff: number;
}

/** すべてのドメインイベントの合併型。 */
export type DomainEvent =
  | StampRegistered
  | DailyAttendanceClosed
  | MonthlyClosingCompleted
  | ShadowComparisonMismatch;
