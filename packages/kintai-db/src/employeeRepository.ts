/**
 * 従業員マスタの Prisma リポジトリ実装
 * （@dgloss-kintai/api の EmployeeRepository / @dgloss-kintai/jobs の EmployeeDirectoryPort）。
 */

import type { Employee, EmployeeId, YearMonth } from "@dgloss-kintai/contracts";
import type { EmployeeRepository } from "@dgloss-kintai/api";
import type { EmployeeDirectoryPort } from "@dgloss-kintai/jobs";
import type { PrismaClient } from "@prisma/client";
import { employeeRowToDomain, isoDateToDate } from "./mappers.js";

/** 年月の当月1日と末日の Date を得る。 */
function monthEdges(period: YearMonth): { first: Date; last: Date } {
  const first = isoDateToDate(
    `${String(period.year).padStart(4, "0")}-${String(period.month).padStart(2, "0")}-01`,
  );
  const nextYear = period.month === 12 ? period.year + 1 : period.year;
  const nextMonth = period.month === 12 ? 1 : period.month + 1;
  const firstOfNext = isoDateToDate(
    `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
  );
  // 末日 = 翌月1日の前日。
  const last = new Date(firstOfNext.getTime() - 24 * 60 * 60 * 1000);
  return { first, last };
}

/**
 * PrismaClient を DI する従業員リポジトリ。
 * 単体照会（EmployeeRepository）と締め対象列挙（EmployeeDirectoryPort）の双方を満たす。
 */
export class PrismaEmployeeRepository
  implements EmployeeRepository, EmployeeDirectoryPort
{
  constructor(private readonly prisma: PrismaClient) {}

  /** ID で従業員を取得する。存在しない、または契約未登録なら null。 */
  async findById(employeeId: EmployeeId): Promise<Employee | null> {
    const row = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { contract: true },
    });
    if (row === null || row.contract === null) {
      return null;
    }
    return employeeRowToDomain({ ...row, contract: row.contract });
  }

  /**
   * 当該期間に在籍し締め対象となる従業員を返す。
   * 在籍判定: 入社日 <= 当月末日 かつ（退職日が null または 退職日 >= 当月1日）。
   * 契約未登録の従業員は対象外。社員番号昇順。
   */
  async listEmployeesForClosing(
    period: YearMonth,
  ): Promise<readonly Employee[]> {
    const { first, last } = monthEdges(period);
    const rows = await this.prisma.employee.findMany({
      where: {
        hiredOn: { lte: last },
        OR: [{ retiredOn: null }, { retiredOn: { gte: first } }],
        contract: { isNot: null },
      },
      include: { contract: true },
      orderBy: { employeeCode: "asc" },
    });
    return rows.flatMap((row) =>
      row.contract === null
        ? []
        : [employeeRowToDomain({ ...row, contract: row.contract })],
    );
  }
}
