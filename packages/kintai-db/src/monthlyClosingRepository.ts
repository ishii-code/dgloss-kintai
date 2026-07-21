/**
 * 月次締めの Prisma リポジトリ実装
 * （@dgloss-kintai/api の MonthlyClosingRepository / @dgloss-kintai/jobs の MonthlyClosingSinkPort）。
 */

import type {
  EmployeeId,
  MonthlyClosing,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type { MonthlyClosingRepository } from "@dgloss-kintai/api";
import type { MonthlyClosingSinkPort } from "@dgloss-kintai/jobs";
import type { PrismaClient } from "@prisma/client";
import {
  monthlyClosingRowToDomain,
  monthlyClosingToRow,
} from "./mappers.js";

/**
 * PrismaClient を DI する月次締めリポジトリ。
 * 照会（MonthlyClosingRepository）と保存（MonthlyClosingSinkPort）の双方を満たす。
 */
export class PrismaMonthlyClosingRepository
  implements MonthlyClosingRepository, MonthlyClosingSinkPort
{
  constructor(private readonly prisma: PrismaClient) {}

  /** 従業員・年月で月次締めを取得する。なければ null。 */
  async findByEmployeeAndPeriod(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<MonthlyClosing | null> {
    const row = await this.prisma.monthlyClosing.findUnique({
      where: {
        employeeId_year_month: {
          employeeId,
          year: period.year,
          month: period.month,
        },
      },
    });
    return row === null ? null : monthlyClosingRowToDomain(row);
  }

  /** 確定した月次締めを保存する（従業員×年月で upsert・冪等）。 */
  async save(closing: MonthlyClosing): Promise<void> {
    const row = monthlyClosingToRow(closing);
    await this.prisma.monthlyClosing.upsert({
      where: {
        employeeId_year_month: {
          employeeId: row.employeeId,
          year: row.year,
          month: row.month,
        },
      },
      create: row,
      update: row,
    });
  }
}
