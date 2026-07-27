/**
 * 日次勤怠の Prisma リポジトリ実装
 * （@dgloss-kintai/api の WorkDayRepository / @dgloss-kintai/jobs の WorkDaySourcePort）。
 */

import type {
  EmployeeId,
  IsoDate,
  WorkDay,
  YearMonth,
} from "@dgloss-kintai/contracts";
import type { WorkDayRepository } from "@dgloss-kintai/api";
import type { WorkDaySourcePort } from "@dgloss-kintai/jobs";
import type { PrismaClient } from "@prisma/client";
import { isoDateToDate, workDayRowToDomain, workDayToRow } from "./mappers.js";

/** 年月の当月1日と翌月1日（排他上限）の Date を得る。 */
function monthBounds(period: YearMonth): { gte: Date; lt: Date } {
  const start = `${String(period.year).padStart(4, "0")}-${String(period.month).padStart(2, "0")}-01`;
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const next = `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`;
  return { gte: isoDateToDate(start), lt: isoDateToDate(next) };
}

/**
 * PrismaClient を DI する日次勤怠リポジトリ。
 * WorkDayRepository（範囲照会）と WorkDaySourcePort（月次締め用）の双方を満たす。
 */
export class PrismaWorkDayRepository
  implements WorkDayRepository, WorkDaySourcePort
{
  constructor(private readonly prisma: PrismaClient) {}

  /** 従業員の日次勤怠を暦日範囲（両端含む）で取得する。日付昇順。 */
  async listByEmployeeAndDateRange(
    employeeId: EmployeeId,
    from: IsoDate,
    to: IsoDate,
  ): Promise<readonly WorkDay[]> {
    const rows = await this.prisma.workDay.findMany({
      where: {
        employeeId,
        date: { gte: isoDateToDate(from), lte: isoDateToDate(to) },
      },
      orderBy: { date: "asc" },
    });
    return rows.map(workDayRowToDomain);
  }

  /** 当該従業員・当該期間（当月1日〜末日）の WorkDay を返す。日付昇順。 */
  async listWorkDays(
    employeeId: EmployeeId,
    period: YearMonth,
  ): Promise<readonly WorkDay[]> {
    const { gte, lt } = monthBounds(period);
    const rows = await this.prisma.workDay.findMany({
      where: { employeeId, date: { gte, lt } },
      orderBy: { date: "asc" },
    });
    return rows.map(workDayRowToDomain);
  }

  /** 日次勤怠を保存する（従業員×暦日で upsert・冪等）。打刻の日次化で用いる。 */
  async save(workDay: WorkDay): Promise<void> {
    const row = workDayToRow(workDay);
    await this.prisma.workDay.upsert({
      where: {
        employeeId_date: { employeeId: row.employeeId, date: row.date },
      },
      create: row,
      update: row,
    });
  }
}
