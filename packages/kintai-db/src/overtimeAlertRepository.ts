/**
 * 固定残業超過アラートの通知済み状態の Prisma 永続化
 * （@dgloss-kintai/api の OvertimeAlertStateRepository port）。
 *
 * 従業員×年月で1回だけ通知するための冪等キーを保持する。raw SQL は使わない。
 *
 * フェイルセーフ方針: マイグレーション未適用（テーブル無し・P2021）の場合は
 * 「通知済み」とみなして（wasNotified=true・markNotified=noop）通知を止める。
 * 状態を記録できない環境で毎日重複通知してしまう事故を防ぐため、安全側に倒す。
 */

import type { EmployeeId, IsoDateTime, YearMonth } from "@dgloss-kintai/contracts";
import type {
  OvertimeAlertRecord,
  OvertimeAlertStateRepository,
} from "@dgloss-kintai/api";
import type { PrismaClient } from "@prisma/client";
import { isoDateTimeToDate } from "./mappers.js";
import { isMissingTableError } from "./errors.js";

/** `${employeeId}:${year}-${MM}` のキーを作る。 */
function alertId(employeeId: EmployeeId, period: YearMonth): string {
  return `${employeeId}:${period.year}-${String(period.month).padStart(2, "0")}`;
}

/** 固定残業超過アラート状態の Prisma 実装。 */
export class PrismaOvertimeAlertStateRepository
  implements OvertimeAlertStateRepository
{
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * 当該従業員・年月が通知済みかを返す。
   * テーブル未作成（マイグレーション未適用）のときは true（＝通知を抑止）を返す。
   */
  async wasNotified(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<boolean> {
    try {
      const row = await this.prisma.overtimeAlert.findUnique({
        where: { id: alertId(employeeId, period) },
      });
      return row !== null;
    } catch (error) {
      if (isMissingTableError(error)) {
        return true; // 記録できない環境では重複通知を避けるため抑止する。
      }
      throw error;
    }
  }

  /** 通知済みとして記録する（冪等 upsert）。テーブル未作成時は何もしない。 */
  async markNotified(record: OvertimeAlertRecord): Promise<void> {
    const id = alertId(record.employeeId, record.period);
    const notifiedAt = isoDateTimeToDate(record.notifiedAt as IsoDateTime);
    const data = {
      employeeId: record.employeeId,
      periodYear: record.period.year,
      periodMonth: record.period.month,
      additionalPayment: record.additionalPayment,
      notifiedAt,
    };
    try {
      await this.prisma.overtimeAlert.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    } catch (error) {
      if (isMissingTableError(error)) {
        return;
      }
      throw error;
    }
  }
}
