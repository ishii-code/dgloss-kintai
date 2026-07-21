/**
 * 打刻の Prisma リポジトリ実装（@dgloss-kintai/api の StampRepository port）。
 */

import type {
  EmployeeId,
  IsoDateTime,
  Stamp,
} from "@dgloss-kintai/contracts";
import type { StampRepository } from "@dgloss-kintai/api";
import type { PrismaClient } from "@prisma/client";
import { isoDateTimeToDate, stampRowToDomain, stampToRow } from "./mappers.js";

/** PrismaClient を DI する打刻リポジトリ。 */
export class PrismaStampRepository implements StampRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** 打刻を保存する（id で upsert・冪等）。 */
  async save(stamp: Stamp): Promise<void> {
    const row = stampToRow(stamp);
    await this.prisma.stamp.upsert({
      where: { id: row.id },
      create: row,
      update: row,
    });
  }

  /** 従業員の打刻を時刻範囲（両端含む）で取得する。時刻昇順。 */
  async listByEmployeeAndRange(
    employeeId: EmployeeId,
    from: IsoDateTime,
    to: IsoDateTime,
  ): Promise<readonly Stamp[]> {
    const rows = await this.prisma.stamp.findMany({
      where: {
        employeeId,
        stampedAt: {
          gte: isoDateTimeToDate(from),
          lte: isoDateTimeToDate(to),
        },
      },
      orderBy: { stampedAt: "asc" },
    });
    return rows.map(stampRowToDomain);
  }
}
